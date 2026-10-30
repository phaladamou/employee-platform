//! emp-sandbox: strict subprocess runner with a JSON report.
//!
//! ```sh
//! emp-sandbox --timeout-ms 10000 --max-output-bytes 200000 \
//!   --work-dir /sandbox [--keep-env] [--env KEY=VALUE ...] \
//!   -- program [args...]
//! ```
//!
//! Exit 0 with one JSON line on stdout for every completed sandbox run
//! (child failure, timeout and truncation are fields, not errors):
//! `{"exit_code":0|null,"stdout":"..","stderr":"..",
//!   "timed_out":bool,"output_truncated":bool}`.
//! Exit 2 (message on stderr) for sandbox-side errors: bad arguments,
//! missing work dir, spawn failure. Streams are lossy UTF-8 by design
//! (matches the `run_shell` text contract).

use employee_native::sandbox::{run_sandboxed, SandboxLimits};
use serde::Serialize;
use std::path::PathBuf;
use std::time::Duration;

const USAGE: &str = "usage: emp-sandbox --timeout-ms <ms> --max-output-bytes <n> [--work-dir <dir>] [--keep-env] [--env KEY=VAL ...] -- <program> [args...]";

#[derive(Debug, PartialEq, Eq)]
struct Cli {
    timeout_ms: u64,
    max_output_bytes: usize,
    work_dir: Option<PathBuf>,
    keep_env: bool,
    extra_env: Vec<(String, String)>,
    program: String,
    args: Vec<String>,
}

fn parse_u64(flag: &str, value: Option<&String>) -> Result<u64, String> {
    let raw = value.ok_or_else(|| format!("{flag} requires a value"))?;
    let parsed: u64 = raw
        .parse()
        .map_err(|_| format!("{flag} requires a positive integer, got {raw:?}"))?;
    if parsed == 0 {
        return Err(format!("{flag} must be >= 1"));
    }
    Ok(parsed)
}

fn parse_args(argv: &[String]) -> Result<Cli, String> {
    let mut timeout_ms: Option<u64> = None;
    let mut max_output_bytes: Option<u64> = None;
    let mut work_dir: Option<PathBuf> = None;
    let mut keep_env = false;
    let mut extra_env: Vec<(String, String)> = Vec::new();

    let mut rest = argv.iter().peekable();
    // Skip argv[0].
    rest.next();

    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--" => break,
            "-h" | "--help" => return Err("help".to_string()),
            "--timeout-ms" => timeout_ms = Some(parse_u64("--timeout-ms", rest.next())?),
            "--max-output-bytes" => {
                max_output_bytes = Some(parse_u64("--max-output-bytes", rest.next())?);
            }
            "--work-dir" => {
                let dir = rest
                    .next()
                    .ok_or_else(|| "--work-dir requires a value".to_string())?;
                work_dir = Some(PathBuf::from(dir));
            }
            "--keep-env" => keep_env = true,
            "--env" => {
                let pair = rest
                    .next()
                    .ok_or_else(|| "--env requires KEY=VALUE".to_string())?;
                let (key, value) = pair
                    .split_once('=')
                    .ok_or_else(|| format!("--env requires KEY=VALUE, got {pair:?}"))?;
                if key.is_empty() {
                    return Err("--env key cannot be empty".to_string());
                }
                extra_env.push((key.to_string(), value.to_string()));
            }
            unknown if unknown.starts_with('-') => {
                return Err(format!("unknown flag {unknown:?}\n{USAGE}"));
            }
            positional => {
                return Err(format!(
                    "unexpected positional argument {positional:?} (missing -- separator?)\n{USAGE}"
                ));
            }
        }
    }

    let program = rest
        .next()
        .ok_or_else(|| format!("missing <program> after --\n{USAGE}"))?;
    let timeout_ms =
        timeout_ms.ok_or_else(|| format!("missing --timeout-ms\n{USAGE}"))?;
    let max_output_bytes =
        max_output_bytes.ok_or_else(|| format!("missing --max-output-bytes\n{USAGE}"))?;
    let max_output_bytes: usize = max_output_bytes
        .try_into()
        .map_err(|_| "--max-output-bytes too large".to_string())?;

    Ok(Cli {
        timeout_ms,
        max_output_bytes,
        work_dir,
        keep_env,
        extra_env,
        program: program.clone(),
        args: rest.cloned().collect(),
    })
}

#[derive(Debug, Serialize)]
struct JsonReport {
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    timed_out: bool,
    output_truncated: bool,
}

fn run() -> Result<(), String> {
    let argv: Vec<String> = std::env::args().collect();
    let cli = parse_args(&argv).map_err(|message| {
        if message == "help" {
            println!("{USAGE}");
            std::process::exit(0);
        }
        message
    })?;

    if let Some(dir) = &cli.work_dir {
        if !dir.is_dir() {
            return Err(format!("work dir is not a directory: {}", dir.display()));
        }
    }

    let result = run_sandboxed(
        &cli.program,
        &cli.args.iter().map(String::as_str).collect::<Vec<_>>(),
        &SandboxLimits {
            timeout: Duration::from_millis(cli.timeout_ms),
            max_output_bytes: cli.max_output_bytes,
            work_dir: cli.work_dir,
            clear_env: !cli.keep_env,
            extra_env: cli.extra_env,
        },
    )
    .map_err(|error| format!("sandbox error: {error}"))?;

    let report = JsonReport {
        exit_code: result.exit_code,
        stdout: String::from_utf8_lossy(&result.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&result.stderr).into_owned(),
        timed_out: result.timed_out,
        output_truncated: result.output_truncated,
    };
    println!(
        "{}",
        serde_json::to_string(&report).map_err(|error| format!("JSON error: {error}"))?
    );
    Ok(())
}

fn main() {
    if let Err(message) = run() {
        eprintln!("emp-sandbox: {message}");
        std::process::exit(2);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(words: &[&str]) -> Vec<String> {
        std::iter::once("emp-sandbox")
            .chain(words.iter().copied())
            .map(String::from)
            .collect()
    }

    #[test]
    fn parses_full_command_line() {
        let cli = parse_args(&argv(&[
            "--timeout-ms",
            "1500",
            "--max-output-bytes",
            "4096",
            "--work-dir",
            "/tmp/w",
            "--env",
            "A=1",
            "--env",
            "B=x=y",
            "--",
            "/bin/echo",
            "hi",
        ]))
        .unwrap();
        assert_eq!(
            cli,
            Cli {
                timeout_ms: 1500,
                max_output_bytes: 4096,
                work_dir: Some(PathBuf::from("/tmp/w")),
                keep_env: false,
                extra_env: vec![
                    ("A".to_string(), "1".to_string()),
                    ("B".to_string(), "x=y".to_string()),
                ],
                program: "/bin/echo".to_string(),
                args: vec!["hi".to_string()],
            }
        );
    }

    #[test]
    fn rejects_bad_input() {
        for words in [
            vec!["--", "echo"],                                     // missing limits
            vec!["--timeout-ms", "0", "--max-output-bytes", "8", "--", "echo"],
            vec!["--timeout-ms", "x", "--max-output-bytes", "8", "--", "echo"],
            vec!["--timeout-ms", "5", "--max-output-bytes", "8"],   // missing --
            vec!["--timeout-ms", "5", "--max-output-bytes", "8", "--"],
            vec!["--timeout-ms", "5", "--max-output-bytes", "8", "--env", "NOEQ", "--", "echo"],
            vec!["--bogus", "5", "--", "echo"],
            vec!["positional", "--", "echo"],
        ] {
            assert!(parse_args(&argv(&words)).is_err(), "{words:?} must fail");
        }
    }

    #[test]
    fn json_report_shape_is_stable() {
        let report = JsonReport {
            exit_code: Some(3),
            stdout: "oops\n".to_string(),
            stderr: String::new(),
            timed_out: false,
            output_truncated: false,
        };
        let json: serde_json::Value =
            serde_json::from_str(&serde_json::to_string(&report).unwrap()).unwrap();
        assert_eq!(json["exit_code"], 3);
        assert_eq!(json["stdout"], "oops\n");
        assert_eq!(json["timed_out"], false);
        assert_eq!(json["output_truncated"], false);
    }
}
