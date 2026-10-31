//! Full-chain Landlock proof through the real `emp-sandbox` binary.
//!
//! Each test spawns the freshly built binary with `--work-dir` (which
//! doubles as the Landlock root) and asserts on the JSON report plus
//! the filesystem aftermath. On kernels without Landlock the tests
//! skip loudly — never a silent pass.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn sandbox_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_emp-sandbox"))
}

struct Report {
    exit_code: Option<i64>,
    stdout: String,
    stderr: String,
}

fn run_confined(work_dir: &Path, program: &str, args: &[&str]) -> Report {
    let output = Command::new(sandbox_bin())
        .args([
            "--timeout-ms",
            "10000",
            "--max-output-bytes",
            "100000",
            "--work-dir",
        ])
        .arg(work_dir)
        .arg("--")
        .arg(program)
        .args(args)
        .output()
        .expect("spawn emp-sandbox");
    assert!(
        output.status.success(),
        "emp-sandbox itself failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("valid JSON report");
    Report {
        exit_code: json["exit_code"].as_i64(),
        stdout: json["stdout"].as_str().unwrap_or("").to_string(),
        stderr: json["stderr"].as_str().unwrap_or("").to_string(),
    }
}

fn sh(work_dir: &Path, script: &str) -> Report {
    run_confined(work_dir, "/bin/sh", &["-c", script])
}

struct World {
    root: PathBuf,
    ws: PathBuf,
}

impl World {
    fn create(tag: &str) -> World {
        let id = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "emp-ll-{}-{}-{}",
            tag,
            std::process::id(),
            id
        ));
        let ws = root.join("ws");
        std::fs::create_dir_all(&ws).unwrap();
        // Sibling secret: the escape target for every test.
        std::fs::write(root.join("secret.txt"), "TOP-SECRET\n").unwrap();
        World { root, ws }
    }
}

impl Drop for World {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.root).ok();
    }
}

/// Loud skip when this kernel cannot prove confinement. Linux-only by
/// design (Landlock does not exist elsewhere); on Linux, a trivial
/// confined run decides.
fn require_landlock() -> bool {
    if !cfg!(target_os = "linux") {
        eprintln!("SKIP: Landlock confinement needs Linux");
        return false;
    }
    // Unique per call: tests run in parallel and must not share (and
    // delete under each other) the probe directory.
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    let probe_root =
        std::env::temp_dir().join(format!("emp-ll-probe-{}-{}", std::process::id(), id));
    std::fs::create_dir_all(&probe_root).unwrap();
    let output = Command::new(sandbox_bin())
        .args([
            "--timeout-ms",
            "5000",
            "--max-output-bytes",
            "1000",
            "--work-dir",
        ])
        .arg(&probe_root)
        .args(["--", "/bin/true"])
        .output()
        .expect("spawn emp-sandbox");
    std::fs::remove_dir_all(&probe_root).ok();
    if output.status.success() {
        return true;
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("landlock"),
        "unexpected emp-sandbox failure: {stderr}"
    );
    eprintln!("SKIP: {stderr}");
    false
}

#[test]
fn writes_and_reads_inside_workspace() {
    if !require_landlock() {
        return;
    }
    let world = World::create("inside");
    let report = sh(&world.ws, "echo inside-ok > note.txt; cat note.txt");
    assert_eq!(report.exit_code, Some(0));
    assert!(report.stdout.contains("inside-ok"), "stdout: {}", report.stdout);
    let stored = std::fs::read_to_string(world.ws.join("note.txt")).unwrap();
    assert!(stored.contains("inside-ok"));
}

#[test]
fn blocks_relative_escape_read() {
    if !require_landlock() {
        return;
    }
    let world = World::create("read-escape");
    let report = sh(&world.ws, "cat ../secret.txt");
    assert_ne!(report.exit_code, Some(0));
    assert!(
        report.stderr.contains("Permission denied") || report.stderr.contains("denied"),
        "stderr: {}",
        report.stderr
    );
    assert!(
        !report.stdout.contains("TOP-SECRET"),
        "secret leaked: {}",
        report.stdout
    );
}

#[test]
fn blocks_relative_escape_write() {
    if !require_landlock() {
        return;
    }
    let world = World::create("write-escape");
    let report = sh(&world.ws, "echo pwned > ../evil.txt");
    assert_ne!(report.exit_code, Some(0));
    assert!(
        !world.root.join("evil.txt").exists(),
        "escape write landed outside the workspace"
    );
}

#[test]
fn blocks_absolute_escape() {
    if !require_landlock() {
        return;
    }
    let world = World::create("abs-escape");
    let target = world.root.join("secret.txt");
    let report = sh(&world.ws, &format!("cat {}", target.display()));
    assert_ne!(report.exit_code, Some(0));
    assert!(!report.stdout.contains("TOP-SECRET"));
}

#[test]
fn blocks_symlink_escape() {
    if !require_landlock() {
        return;
    }
    let world = World::create("link-escape");
    #[cfg(unix)]
    std::os::unix::fs::symlink(world.root.join("secret.txt"), world.ws.join("sneaky.txt"))
        .unwrap();
    let report = sh(&world.ws, "cat sneaky.txt");
    assert_ne!(report.exit_code, Some(0));
    assert!(
        !report.stdout.contains("TOP-SECRET"),
        "secret leaked through symlink: {}",
        report.stdout
    );
}

#[test]
fn keeps_system_binaries_usable() {
    if !require_landlock() {
        return;
    }
    // Direct exec (no shell): proves the read-only system view maps
    // the loader, libc and /bin itself.
    let world = World::create("system-ro");
    let report = run_confined(&world.ws, "/bin/echo", &["system-ok"]);
    assert_eq!(report.exit_code, Some(0));
    assert!(report.stdout.contains("system-ok"));
}

#[test]
fn tmpdir_points_inside_workspace() {
    if !require_landlock() {
        return;
    }
    let world = World::create("tmpdir");
    let report = sh(&world.ws, "echo $TMPDIR");
    assert_eq!(report.exit_code, Some(0));
    let expected = world.ws.canonicalize().unwrap();
    let actual = Path::new(report.stdout.trim());
    assert_eq!(actual, expected.as_path());
}

#[test]
fn dev_null_is_usable_but_the_rest_of_dev_stays_denied() {
    if !require_landlock() {
        return;
    }
    // Shells redirect here constantly and test runners (pytest fd
    // capture) open it at startup: denying it breaks legitimate
    // tools. The exception covers this one file only.
    let world = World::create("devnull");
    let report = sh(
        &world.ws,
        "echo hi > /dev/null && cat /dev/null && echo devnull-ok",
    );
    assert_eq!(report.exit_code, Some(0));
    assert!(
        report.stdout.contains("devnull-ok"),
        "stdout: {}",
        report.stdout
    );
    let report = sh(&world.ws, "cat /dev/zero");
    assert_ne!(report.exit_code, Some(0));
}
