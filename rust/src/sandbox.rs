//! Strict subprocess sandbox (native only: processes cannot exist in
//! WASM). Guarantees, enforced even against hostile children:
//!
//! - argv-direct spawn (no shell, no string interpolation),
//! - wall-clock timeout with SIGKILL on breach,
//! - stdout/stderr caps with kill on overflow (concurrent draining,
//!   so a child flooding a pipe can neither deadlock nor OOM us),
//! - stdin `/dev/null`, optional clean environment and work dir,
//! - Unix extras via `pre_exec`: RLIMIT_CPU + RLIMIT_FSIZE, plus its
//!   own process group so timeout/overflow kills reach grandchildren
//!   (a killed shell must not orphan a pipe-holding `sleep`).
//!
//! Non-goal: fork-bomb containment (RLIMIT_NPROC would apply to the
//! whole host user, not the sandbox). Cap total abuse with the Docker
//! CPU/memory envelope instead (defense in depth).

use std::io::{self, Read};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct SandboxLimits {
    /// Hard wall-clock budget. Must be >= 1.
    pub timeout: Duration,
    /// Max captured bytes per stream (stdout, stderr). Must be >= 1.
    /// Past the cap the child is killed and `output_truncated` is set.
    pub max_output_bytes: usize,
    /// Run inside this directory (created by nobody: must exist).
    pub work_dir: Option<PathBuf>,
    /// Drop the parent environment instead of inheriting it.
    pub clear_env: bool,
    /// Explicit variables, applied after clearing (never inherited).
    pub extra_env: Vec<(String, String)>,
}

impl Default for SandboxLimits {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(10),
            max_output_bytes: 1_000_000,
            work_dir: None,
            clear_env: true,
            extra_env: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SandboxResult {
    /// Exit code when the child exited by itself (`None` = killed).
    pub exit_code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    /// True when the timeout fired (child was killed).
    pub timed_out: bool,
    /// True when a stream exceeded the cap (child was killed).
    pub output_truncated: bool,
}

/// Spawn `program` with `args` under `limits`. The program path is
/// used verbatim (PATH lookup only if it contains no `/`, per OS
/// rules); arguments are never joined into a shell string.
pub fn run_sandboxed(
    program: &str,
    args: &[&str],
    limits: &SandboxLimits,
) -> io::Result<SandboxResult> {
    if limits.timeout.is_zero() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "sandbox timeout must be >= 1ms",
        ));
    }
    if limits.max_output_bytes == 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "sandbox output cap must be >= 1 byte",
        ));
    }

    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if limits.clear_env {
        command.env_clear();
    }
    for (key, value) in &limits.extra_env {
        command.env(key, value);
    }
    if let Some(dir) = &limits.work_dir {
        command.current_dir(dir);
    }
    // SAFETY: pre_exec runs after fork, before exec. Only async-signal-safe
    // libc calls (setrlimit, setpgid), no allocation, no locks.
    #[cfg(unix)]
    unsafe {
        let cpu_secs = limits.timeout.as_secs().saturating_add(2);
        let max_file = limits.max_output_bytes.saturating_mul(4) as u64;
        command.pre_exec(move || {
            // Own process group: kill_tree() below reaches grandchildren.
            if libc::setpgid(0, 0) != 0 {
                return Err(io::Error::last_os_error());
            }
            let cpu = libc::rlimit {
                rlim_cur: cpu_secs,
                rlim_max: cpu_secs,
            };
            if libc::setrlimit(libc::RLIMIT_CPU, &cpu) != 0 {
                return Err(io::Error::last_os_error());
            }
            let fsize = libc::rlimit {
                rlim_cur: max_file,
                rlim_max: max_file,
            };
            if libc::setrlimit(libc::RLIMIT_FSIZE, &fsize) != 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }

    let mut child = command.spawn()?;
    let deadline = Instant::now() + limits.timeout;
    let cap = limits.max_output_bytes;

    // Concurrent draining: without it a child writing past the pipe
    // buffer (~64 KiB) would block forever while we wait for exit.
    // ChildStdout/ChildStderr are distinct types, hence the generic.
    let overflowed = Arc::new(AtomicBool::new(false));
    fn drain_pipe<R: Read + Send + 'static>(
        pipe: R,
        cap: usize,
        hit_cap: Arc<AtomicBool>,
    ) -> thread::JoinHandle<Vec<u8>> {
        thread::spawn(move || {
            let mut boxed: Box<dyn Read> = Box::new(pipe);
            let mut collected = Vec::new();
            let mut chunk = [0u8; 8192];
            loop {
                let read = match boxed.read(&mut chunk) {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(_) => break,
                };
                if collected.len() + read > cap {
                    hit_cap.store(true, Ordering::Relaxed);
                    break;
                }
                collected.extend_from_slice(&chunk[..read]);
            }
            collected
        })
    }
    let stdout_handle = drain_pipe(child.stdout.take().unwrap(), cap, Arc::clone(&overflowed));
    let stderr_handle = drain_pipe(child.stderr.take().unwrap(), cap, Arc::clone(&overflowed));

    let mut timed_out = false;
    let exit_code = loop {
        if overflowed.load(Ordering::Relaxed) {
            kill_tree(&mut child);
            break None;
        }
        match child.try_wait()? {
            Some(status) => break status.code(),
            None => {
                if Instant::now() >= deadline {
                    timed_out = true;
                    kill_tree(&mut child);
                    // Reap after kill so we never leak a zombie.
                    let _ = child.wait();
                    break None;
                }
                thread::sleep(Duration::from_millis(1));
            }
        }
    };

    let stdout = stdout_handle.join().unwrap_or_default();
    let stderr = stderr_handle.join().unwrap_or_default();
    let output_truncated = overflowed.load(Ordering::Relaxed);

    Ok(SandboxResult {
        exit_code,
        stdout,
        stderr,
        timed_out,
        output_truncated,
    })
}

/// Kill the child AND its process group (Unix): grandchildren that
/// inherited the pipes must die too, otherwise the drain threads
/// block forever on still-open writers. Best-effort, never fails.
#[cfg(unix)]
fn kill_tree(child: &mut std::process::Child) {
    // SAFETY: killpg with a live pid is async-signal-safe; ESRCH
    // (already gone) and EPERM are ignored by design.
    unsafe {
        libc::killpg(child.id() as i32, libc::SIGKILL);
    }
    let _ = child.kill();
}

/// Non-Unix: single kill (no process groups).
#[cfg(not(unix))]
fn kill_tree(child: &mut std::process::Child) {
    let _ = child.kill();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limits() -> SandboxLimits {
        SandboxLimits {
            extra_env: Vec::new(),
            timeout: Duration::from_secs(5),
            max_output_bytes: 64_000,
            work_dir: None,
            clear_env: true,
        }
    }

    #[test]
    fn runs_and_captures_output() {
        let result = run_sandboxed("echo", &["hello"], &limits()).unwrap();
        assert_eq!(result.exit_code, Some(0));
        assert_eq!(result.stdout, b"hello\n");
        assert!(!result.timed_out);
        assert!(!result.output_truncated);
    }

    #[test]
    fn kills_on_timeout() {
        let started = Instant::now();
        let result = run_sandboxed(
            "sleep",
            &["30"],
            &SandboxLimits {
                timeout: Duration::from_millis(150),
                ..limits()
            },
        )
        .unwrap();
        assert!(result.timed_out);
        assert_eq!(result.exit_code, None);
        assert!(started.elapsed() < Duration::from_secs(10));
    }

    #[test]
    fn kills_grandchildren_holding_pipes_open() {
        // sh spawns sleep: killing sh alone would orphan sleep with the
        // pipes open and hang the drain threads. Guarded join so a
        // regression FAILS (timeout) instead of hanging the suite.
        let done = std::sync::mpsc::channel();
        thread::spawn(move || {
            let result = run_sandboxed(
                "sh",
                &["-c", "sleep 30"],
                &SandboxLimits {
                    timeout: Duration::from_millis(200),
                    ..limits()
                },
            )
            .unwrap();
            let _ = done.0.send(result);
        });
        let result = done
            .1
            .recv_timeout(Duration::from_secs(10))
            .expect("sandbox hung on grandchild pipes");
        assert!(result.timed_out);
        assert_eq!(result.exit_code, None);
    }

    #[test]
    fn kills_on_output_overflow() {
        // `yes` floods stdout forever; the cap must stop it fast.
        let result = run_sandboxed(
            "yes",
            &[],
            &SandboxLimits {
                timeout: Duration::from_secs(10),
                max_output_bytes: 4096,
                ..limits()
            },
        )
        .unwrap();
        assert!(result.output_truncated);
        assert!(!result.timed_out);
        assert!(result.stdout.len() <= 4096);
    }

    #[test]
    fn reports_missing_program_as_io_error() {
        let result = run_sandboxed("emp-definitely-missing-binary", &[], &limits());
        assert!(result.is_err());
    }

    #[test]
    fn rejects_empty_limits() {
        let zero_time = SandboxLimits {
            timeout: Duration::ZERO,
            ..limits()
        };
        assert!(run_sandboxed("echo", &["x"], &zero_time).is_err());
        let zero_cap = SandboxLimits {
            max_output_bytes: 0,
            ..limits()
        };
        assert!(run_sandboxed("echo", &["x"], &zero_cap).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn clears_environment_when_asked() {
        std::env::set_var("EMP_NATIVE_TEST_MARKER", "leak-me");
        let result = run_sandboxed("printenv", &["EMP_NATIVE_TEST_MARKER"], &limits()).unwrap();
        // printenv exits 1 and prints nothing when the variable is absent.
        assert_eq!(result.exit_code, Some(1));
        assert!(result.stdout.is_empty());
        std::env::remove_var("EMP_NATIVE_TEST_MARKER");
    }
}
