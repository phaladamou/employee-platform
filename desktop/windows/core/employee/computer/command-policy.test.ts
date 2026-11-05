import { describe, expect, it } from "vitest";

import {
  assertBinariesAllowed,
  firstBinaryOfSegment,
  invokedBinaries,
  splitShellSegments,
  withMemoryLimit,
} from "./command-policy";

const ATLAS = ["python3", "pip", "pytest", "ls", "cat", "echo"] as const;
const NOVA = ["docker", "git", "ls", "cat", "echo"] as const;

describe("splitShellSegments", () => {
  it("splits on shell operators", () => {
    expect(splitShellSegments("a && b; c || d | e & f")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("ignores operators inside quotes", () => {
    expect(splitShellSegments('echo "a && b" && echo \'c;d\'')).toEqual([
      'echo "a && b"',
      "echo 'c;d'",
    ]);
  });

  it("extracts command substitutions recursively", () => {
    const segments = splitShellSegments("echo $(docker ps && git log)");
    expect(segments).toContain("echo");
    expect(segments).toContain("docker ps");
    expect(segments).toContain("git log");
  });

  it("extracts backtick substitutions", () => {
    const segments = splitShellSegments("echo `docker ps`");
    expect(segments).toContain("echo");
    expect(segments).toContain("docker ps");
  });

  it("ignores arithmetic and parameter expansions", () => {
    expect(splitShellSegments("echo $((1 + 2)) ${HOME}")).toEqual([
      "echo $((1 + 2)) ${HOME}",
    ]);
  });

  it("strips comments but keeps quoted hashes", () => {
    expect(splitShellSegments("echo hi # docker && rm")).toEqual(["echo hi"]);
    expect(splitShellSegments('echo "a#b"')).toEqual(['echo "a#b"']);
  });
});

describe("firstBinaryOfSegment", () => {
  it("resolves plain and absolute invocations", () => {
    expect(firstBinaryOfSegment("docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("/usr/bin/docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("./run.sh")).toBe("run.sh");
  });

  it("concatenates adjacent quoted runs like the shell", () => {
    expect(firstBinaryOfSegment("'py'thon3 --version")).toBe("python3");
    expect(firstBinaryOfSegment('"docker" ps')).toBe("docker");
  });

  it("skips leading assignments, keywords and prefixes", () => {
    expect(firstBinaryOfSegment("FOO=1 BAR=2 docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("if docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("! docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("command docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("exec docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("env FOO=1 docker ps")).toBe("docker");
    expect(firstBinaryOfSegment("time -p docker ps")).toBe("docker");
  });

  it("returns null when the segment holds no command", () => {
    expect(firstBinaryOfSegment("")).toBe(null);
    expect(firstBinaryOfSegment("for i in a b")).toBe(null);
    expect(firstBinaryOfSegment("done")).toBe(null);
    expect(firstBinaryOfSegment("FOO=1")).toBe(null);
  });
});

describe("invokedBinaries", () => {
  it("collects every first-level binary", () => {
    expect(invokedBinaries("git status && echo $(docker ps)")).toEqual([
      "git",
      "echo",
      "docker",
    ]);
  });
});

describe("assertBinariesAllowed", () => {
  it("allows listed binaries, absolute or chained", () => {
    expect(() =>
      assertBinariesAllowed("python3 -m pytest && pip list", [...ATLAS])
    ).not.toThrow();
    expect(() =>
      assertBinariesAllowed("/usr/bin/python3 --version", [...ATLAS])
    ).not.toThrow();
  });

  it("denies Atlas running docker with a clear message", () => {
    expect(() => assertBinariesAllowed("docker ps", [...ATLAS])).toThrow(
      'command blocked: binary "docker" is not allowed (allowed binaries: python3, pip, pytest, ls, cat, echo)'
    );
  });

  it("allows Nova running docker", () => {
    expect(() => assertBinariesAllowed("docker ps", [...NOVA])).not.toThrow();
    expect(() =>
      assertBinariesAllowed("docker build . && git status", [...NOVA])
    ).not.toThrow();
  });

  it("checks every segment of a chain", () => {
    expect(() =>
      assertBinariesAllowed("git status && docker ps", ["git"])
    ).toThrow('binary "docker" is not allowed');
    expect(() =>
      assertBinariesAllowed("git status; echo ok | grep x", ["git", "echo"])
    ).toThrow('binary "grep" is not allowed');
  });

  it("cannot be bypassed through substitution", () => {
    expect(() =>
      assertBinariesAllowed("echo $(docker ps)", [...ATLAS])
    ).toThrow('binary "docker" is not allowed');
    expect(() => assertBinariesAllowed("echo `docker ps`", [...ATLAS])).toThrow(
      'binary "docker" is not allowed'
    );
  });

  it("cannot be bypassed through quotes or prefixes", () => {
    expect(() => assertBinariesAllowed('"docker" ps', [...ATLAS])).toThrow(
      'binary "docker" is not allowed'
    );
    expect(() =>
      assertBinariesAllowed("FOO=1 command docker ps", [...ATLAS])
    ).toThrow('binary "docker" is not allowed');
    expect(() => assertBinariesAllowed("sudo docker ps", [...NOVA])).toThrow(
      'binary "sudo" is not allowed'
    );
  });

  it("always allows pure builtins, denies dangerous ones", () => {
    expect(() =>
      assertBinariesAllowed("cd /tmp && echo hi && pwd", [])
    ).not.toThrow();
    expect(() => assertBinariesAllowed("eval foo", [])).toThrow(
      'binary "eval" is not allowed (allowed binaries: none)'
    );
    expect(() => assertBinariesAllowed(". ./x.sh", [])).toThrow(
      'binary "." is not allowed'
    );
  });

  it("handles loop headers without false positives", () => {
    expect(() =>
      assertBinariesAllowed("for f in a b; do echo $f; done", [])
    ).not.toThrow();
    expect(() =>
      assertBinariesAllowed("for f in a; do docker ps; done", [...ATLAS])
    ).toThrow('binary "docker" is not allowed');
  });
});

describe("withMemoryLimit", () => {
  it("prefixes an address-space cap in KiB", () => {
    expect(withMemoryLimit("pytest -q", 512)).toBe("ulimit -v 524288; pytest -q");
  });
});
