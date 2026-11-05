//! Filesystem confinement for sandboxed commands (Landlock, Linux only).
//!
//! Two-sided API, split around `fork`:
//!
//! - parent side ([`prepare_fs_policy`]): canonicalize the workspace,
//!   probe the kernel ABI, compute the restriction mask. May allocate
//!   and return rich errors — it runs before `spawn`;
//! - child side ([`apply_fs_policy_in_child`]): called from a `pre_exec`
//!   hook, after `fork`, before `exec`. Strictly allocation-free (every
//!   failure is a raw `errno`): the child may be forked from a
//!   multi-threaded test process where the allocator lock is unsafe.
//!
//! Policy: the workspace is writable, a minimal system view (`/bin`,
//! `/usr`, `/lib*`, `/etc`) is read-only, everything else (`/tmp`,
//! `/home`, `/proc`, sibling workspaces, raw devices) is denied by the
//! kernel — including through symlinks and `..` (no TOCTOU: the check
//! happens at every filesystem access, not once before use).
//!
//! This is the enforcement behind the `run_shell` workspace contract:
//! `emp-sandbox` passes `--work-dir` as `confine_fs_to`, so the shell
//! cannot escape even with `cd ..` or absolute paths.
//!
//! Fail-closed rules:
//!
//! - no Landlock in the kernel (pre-5.13, or LSM disabled) → the spawn
//!   is refused before it happens, the command never runs;
//! - kernel ABI newer than [`MAX_SUPPORTED_ABI`] → refused: a newer ABI
//!   may carry access rights this binary does not know, and unknown
//!   rights cannot be restricted. Upgrade `emp-sandbox` instead of
//!   running partially confined;
//! - missing workspace directory → refused (the TypeScript side creates
//!   it with `EmployeeWorkspaces.acquire` before spawning).
//!
//! Non-Linux Unix (macOS, …) has no Landlock: preparing still validates
//! the directory, but applying is a no-op and `run_shell` stays
//! cwd-only there. Production deployments that need shell confinement
//! must run on Linux and set `EMPLOYEE_SANDBOX_BIN` (see
//! `docs/OPERATIONS.md`).
//!
//! Raw syscalls (`libc::syscall`) on purpose: zero new dependencies,
//! and the constants below are stable kernel ABI (bits 0-14 from
//! `linux/landlock.h` as of Linux 6.8, `IOCTL_DEV` bit 15 from the
//! current uapi header).

use std::io;
use std::path::Path;

/// Highest Landlock ABI this binary understands. V4 (Linux 6.7) added
/// only *network* rights (`LANDLOCK_ACCESS_NET_*`, a separate ruleset
/// field this FS-only policy does not use); V5 (Linux 6.10) added
/// `LANDLOCK_ACCESS_FS_IOCTL_DEV` (device ioctl, handled below); V6
/// (scopes), V7 (audit flags) and V8 (TSYNC) added no filesystem
/// rights. Refuse to run on anything newer (fail-closed, see module
/// docs).
const MAX_SUPPORTED_ABI: i32 = 8;

// `landlock_create_ruleset` flags (linux/landlock.h).
#[cfg(target_os = "linux")]
const LANDLOCK_CREATE_RULESET_VERSION: u64 = 1 << 0;
// `enum landlock_rule_type`: PATH_BENEATH = 1 (absent from libc 0.2,
// stable kernel ABI since 5.13).
#[cfg(target_os = "linux")]
const LANDLOCK_RULE_PATH_BENEATH: u64 = 1;

// Access rights, ABI V1 (bits 0-12).
const FS_EXECUTE: u64 = 1 << 0;
const FS_WRITE_FILE: u64 = 1 << 1;
const FS_READ_FILE: u64 = 1 << 2;
const FS_READ_DIR: u64 = 1 << 3;
const FS_REMOVE_DIR: u64 = 1 << 4;
const FS_REMOVE_FILE: u64 = 1 << 5;
const FS_MAKE_CHAR: u64 = 1 << 6;
const FS_MAKE_DIR: u64 = 1 << 7;
const FS_MAKE_REG: u64 = 1 << 8;
const FS_MAKE_SOCK: u64 = 1 << 9;
const FS_MAKE_FIFO: u64 = 1 << 10;
const FS_MAKE_BLOCK: u64 = 1 << 11;
const FS_MAKE_SYM: u64 = 1 << 12;
// ABI V2 adds refer (link/rename across boundaries), V3 adds truncate,
// V5 adds ioctl on character/block devices (V4 and V6-V8 add no FS
// rights: network, scopes, audit flags, TSYNC).
const FS_REFER: u64 = 1 << 13;
const FS_TRUNCATE: u64 = 1 << 14;
const FS_IOCTL_DEV: u64 = 1 << 15;

// All thirteen V1 rights, spelled out so the mask stays reviewable.
const V1_ALL: u64 = FS_EXECUTE
    | FS_WRITE_FILE
    | FS_READ_FILE
    | FS_READ_DIR
    | FS_REMOVE_DIR
    | FS_REMOVE_FILE
    | FS_MAKE_CHAR
    | FS_MAKE_DIR
    | FS_MAKE_REG
    | FS_MAKE_SOCK
    | FS_MAKE_FIFO
    | FS_MAKE_BLOCK
    | FS_MAKE_SYM;

/// Read-only view granted on system directories: execute binaries,
/// read files and list directories. No creation, removal, rename or
/// truncation — and no `REFER` (nothing may be linked in or out).
const SYSTEM_RO: u64 = FS_EXECUTE | FS_READ_FILE | FS_READ_DIR;

/// System directories mapped read-only. Deliberately minimal:
/// - no `/dev` as a directory (a read-only `/dev` would still allow
///   reading raw devices); single exception: `/dev/null` is allowed
///   as one file rule (reads EOF, writes discarded) because shells
///   and test runners open it constantly;
/// - no `/proc` or `/sys` (would leak other processes' cmdlines and
///   environment through `/proc/<pid>/*`);
/// - no `/tmp` (`emp-sandbox` points `TMPDIR` at the workspace, so
///   well-behaved tools use confined temporary files).
#[cfg(target_os = "linux")]
const SYSTEM_RO_DIRS: &[&std::ffi::CStr] =
    &[c"/bin", c"/sbin", c"/usr", c"/lib", c"/lib64", c"/etc"];

/// Full restriction mask for a probed ABI version. `None` means
/// "newer than understood" → the caller must refuse to run.
fn handled_mask(abi: i32) -> Option<u64> {
    if abi > MAX_SUPPORTED_ABI || abi < 1 {
        return None;
    }
    let mut mask = V1_ALL;
    if abi >= 2 {
        mask |= FS_REFER;
    }
    if abi >= 3 {
        mask |= FS_TRUNCATE;
    }
    if abi >= 5 {
        mask |= FS_IOCTL_DEV;
    }
    Some(mask)
}

#[repr(C)]
struct RulesetAttr {
    handled_access_fs: u64,
}

#[repr(C)]
struct PathBeneathAttr {
    allowed_access: u64,
    parent_fd: i32,
}

/// Canonical workspace path, NUL-terminated in a fixed buffer, ready
/// to cross `fork` into the allocation-free child hook.
pub struct FsPolicy {
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    workspace: [u8; FsPolicy::PATH_LEN],
    #[cfg(target_os = "linux")]
    handled: u64,
}

impl FsPolicy {
    const PATH_LEN: usize = 4096 + 1;

    #[cfg(target_os = "linux")]
    fn as_ptr(&self) -> *const core::ffi::c_char {
        self.workspace.as_ptr() as *const core::ffi::c_char
    }
}

/// Parent side: validate `work_dir` and freeze the policy. Runs before
/// `spawn`, so rich errors are fine here.
pub fn prepare_fs_policy(work_dir: &Path) -> Result<FsPolicy, String> {
    let canonical = work_dir
        .canonicalize()
        .map_err(|error| format!("workspace is not a directory: {}: {error}", work_dir.display()))?;
    if !canonical.is_dir() {
        return Err(format!(
            "workspace is not a directory: {}",
            work_dir.display()
        ));
    }
    let bytes = canonical.as_os_str().as_encoded_bytes();
    if bytes.len() >= FsPolicy::PATH_LEN {
        return Err(format!(
            "workspace path is {} bytes, over the {} limit",
            bytes.len(),
            FsPolicy::PATH_LEN - 1
        ));
    }
    if bytes.contains(&0) {
        return Err(format!(
            "workspace path contains NUL: {}",
            work_dir.display()
        ));
    }
    let mut workspace = [0u8; FsPolicy::PATH_LEN];
    workspace[..bytes.len()].copy_from_slice(bytes);

    #[cfg(target_os = "linux")]
    let handled = {
        let abi = probe_abi()?;
        handled_mask(abi).ok_or_else(|| {
            format!(
                "kernel Landlock ABI is v{abi}, newer than this emp-sandbox understands (v{MAX_SUPPORTED_ABI}); refusing to run partially confined — upgrade emp-sandbox"
            )
        })?
    };
    #[cfg(target_os = "linux")]
    return Ok(FsPolicy { workspace, handled });
    // No Landlock off Linux: the directory stays validated, apply is
    // a no-op there.
    #[cfg(not(target_os = "linux"))]
    return Ok(FsPolicy { workspace });
}

/// Highest Landlock ABI supported by the running kernel, or an error
/// when Landlock is absent (pre-5.13 kernels fail with ENOSYS here).
/// Parent side only (see [`apply_fs_policy_in_child`]).
#[cfg(target_os = "linux")]
fn probe_abi() -> Result<i32, String> {
    // landlock_create_ruleset(NULL, 0, LANDLOCK_CREATE_RULESET_VERSION)
    // returns the ABI version instead of creating a ruleset.
    let version = unsafe {
        libc::syscall(
            libc::SYS_landlock_create_ruleset as libc::c_long,
            std::ptr::null::<RulesetAttr>(),
            0usize,
            LANDLOCK_CREATE_RULESET_VERSION as libc::c_long,
        )
    };
    if version < 0 {
        let errno = io::Error::last_os_error();
        if errno.raw_os_error() == Some(libc::ENOSYS) {
            return Err("landlock not supported by this kernel (needs Linux >= 5.13 with the landlock LSM enabled); refusing to run unconfined".to_string());
        }
        return Err(format!("landlock ABI probe failed: {errno}"));
    }
    Ok(version as i32)
}

/// Child side (`pre_exec`, after `fork`, before `exec`): build the
/// ruleset from the frozen policy and restrict this process.
///
/// # Safety
///
/// Call only from a `pre_exec` hook: the body is allocation-free (raw
/// syscalls, stack data, static paths), so it is safe even when forked
/// from a multi-threaded parent. Every failure aborts the spawn with
/// its `errno` — fail-closed, the command never runs.
#[cfg(target_os = "linux")]
pub unsafe fn apply_fs_policy_in_child(policy: &FsPolicy) -> io::Result<()> {
    unsafe {
        // restrict_self requires no_new_privs (or CAP_SYS_ADMIN, which
        // a service account never has). Set it before the ruleset.
        if libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1u64, 0u64, 0u64, 0u64) != 0 {
            return Err(io::Error::last_os_error());
        }

        let attr = RulesetAttr {
            handled_access_fs: policy.handled,
        };
        let ruleset = libc::syscall(
            libc::SYS_landlock_create_ruleset as libc::c_long,
            &attr as *const RulesetAttr,
            std::mem::size_of::<RulesetAttr>(),
            0u32,
        );
        if ruleset < 0 {
            return Err(io::Error::last_os_error());
        }

        // System view first (read-only), then the workspace (full
        // rights). A missing system dir (e.g. `/lib64` on some layouts)
        // is skipped: least privilege prefers a smaller view over a
        // hard failure — the ruleset still confines everything else.
        for dir in SYSTEM_RO_DIRS {
            let fd = libc::open(dir.as_ptr(), libc::O_PATH | libc::O_CLOEXEC);
            if fd < 0 {
                let errno = io::Error::last_os_error();
                if errno.raw_os_error() == Some(libc::ENOENT) {
                    continue;
                }
                return Err(errno);
            }
            if add_rule(ruleset, fd, SYSTEM_RO) != 0 {
                return Err(io::Error::last_os_error());
            }
        }
        // Single-file exception: /dev/null (reads EOF, writes
        // discarded, no device access). Shells redirect here
        // constantly (`>/dev/null`) and test runners open it
        // (pytest fd capture) — denying it breaks legitimate
        // tools, while the rest of /dev stays denied.
        let null_fd = libc::open(c"/dev/null".as_ptr(), libc::O_PATH | libc::O_CLOEXEC);
        if null_fd < 0 {
            let errno = io::Error::last_os_error();
            if errno.raw_os_error() != Some(libc::ENOENT) {
                return Err(errno);
            }
        } else if add_rule(ruleset, null_fd, FS_READ_FILE | FS_WRITE_FILE) != 0 {
            return Err(io::Error::last_os_error());
        }
        // The workspace was validated by the parent: any failure here
        // is a hard error (fail-closed).
        let workspace_fd = libc::open(policy.as_ptr(), libc::O_PATH | libc::O_CLOEXEC);
        if workspace_fd < 0 {
            return Err(io::Error::last_os_error());
        }
        if add_rule(ruleset, workspace_fd, policy.handled) != 0 {
            return Err(io::Error::last_os_error());
        }

        // Fds are O_CLOEXEC: exec closes them. No explicit close needed
        // (and none possible without allocation-free wrappers — close
        // itself is fine, but there is no leak to fix: the child either
        // execs now or exits with the spawn error).
        let rc = libc::syscall(
            libc::SYS_landlock_restrict_self as libc::c_long,
            ruleset as libc::c_long,
            0u32,
        );
        if rc != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }
}

/// Single `landlock_add_rule` path-beneath rule. Returns the raw
/// syscall status (0 = ok) so the caller keeps its `errno`.
#[cfg(target_os = "linux")]
unsafe fn add_rule(ruleset: i64, dir_fd: i32, allowed: u64) -> i64 {
    let attr = PathBeneathAttr {
        allowed_access: allowed,
        parent_fd: dir_fd,
    };
    unsafe {
        libc::syscall(
            libc::SYS_landlock_add_rule as libc::c_long,
            ruleset as libc::c_long,
            LANDLOCK_RULE_PATH_BENEATH as libc::c_long,
            &attr as *const PathBeneathAttr,
            0u32,
        )
    }
}

/// No Landlock outside Linux: documented no-op (cwd-only confinement
/// applies, see module docs). Production shell confinement needs Linux.
#[cfg(not(target_os = "linux"))]
pub unsafe fn apply_fs_policy_in_child(_policy: &FsPolicy) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_cover_each_known_abi() {
        assert_eq!(handled_mask(1), Some(0x1fff));
        assert_eq!(handled_mask(2), Some(0x1fff | FS_REFER));
        assert_eq!(handled_mask(3), Some(0x1fff | FS_REFER | FS_TRUNCATE));
        assert_eq!(handled_mask(0), None);
        // V4: same filesystem mask as V3 (network rights only).
        assert_eq!(handled_mask(4), handled_mask(3));
        // V5 adds the device-ioctl right; V6-V8 add no FS rights.
        assert_eq!(
            handled_mask(5),
            Some(0x1fff | FS_REFER | FS_TRUNCATE | FS_IOCTL_DEV)
        );
        assert_eq!(handled_mask(6), handled_mask(5));
        assert_eq!(handled_mask(7), handled_mask(5));
        assert_eq!(handled_mask(8), handled_mask(5));
        assert_eq!(handled_mask(9), None);
        assert_eq!(handled_mask(99), None);
    }

    #[test]
    fn system_view_is_read_only() {
        assert_eq!(SYSTEM_RO & FS_WRITE_FILE, 0);
        assert_eq!(SYSTEM_RO & FS_TRUNCATE, 0);
        assert_eq!(SYSTEM_RO & FS_REFER, 0);
        assert_eq!(SYSTEM_RO & FS_REMOVE_FILE, 0);
        assert_eq!(SYSTEM_RO & FS_MAKE_REG, 0);
        assert_ne!(SYSTEM_RO & FS_EXECUTE, 0);
        assert_ne!(SYSTEM_RO & FS_READ_FILE, 0);
        assert_ne!(SYSTEM_RO & FS_READ_DIR, 0);
    }

    #[test]
    fn missing_workspace_is_rejected() {
        let missing = Path::new("/no/such/employee/workspace");
        assert!(prepare_fs_policy(missing).is_err());
    }

    #[test]
    fn existing_directory_freezes_to_nul_terminated_path() {
        let dir = std::env::temp_dir().join(format!("emp-fs-policy-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let policy = prepare_fs_policy(&dir).unwrap();
        let bytes = canonicalize_bytes(&dir);
        assert_eq!(&policy.workspace[..bytes.len()], bytes.as_slice());
        assert_eq!(policy.workspace[bytes.len()], 0);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[cfg(unix)]
    fn canonicalize_bytes(dir: &Path) -> Vec<u8> {
        use std::os::unix::ffi::OsStrExt;
        dir.canonicalize().unwrap().as_os_str().as_bytes().to_vec()
    }

    #[cfg(not(unix))]
    fn canonicalize_bytes(dir: &Path) -> Vec<u8> {
        dir.canonicalize()
            .unwrap()
            .to_string_lossy()
            .into_owned()
            .into_bytes()
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn kernel_reports_a_supported_abi() {
        match probe_abi() {
            Ok(abi) => assert!(
                (1..=MAX_SUPPORTED_ABI).contains(&abi),
                "unexpected Landlock ABI v{abi}"
            ),
            // Non-Landlock kernels (older than 5.13, LSM disabled):
            // the unit suite cannot prove confinement here; the
            // integration test skips the same way. Never a silent
            // pass — the message names the gap.
            Err(error) => eprintln!("SKIP kernel_reports_a_supported_abi: {error}"),
        }
    }
}
