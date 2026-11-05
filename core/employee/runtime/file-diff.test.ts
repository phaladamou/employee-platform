import { describe, expect, it } from "vitest";

import { DIFF_MAX_ROWS, diffLines } from "./file-diff";

describe("diffLines", () => {
  it("returns no changes for identical contents", () => {
    const diff = diffLines("a\nb\n", "a\nb\n");

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.truncated).toBe(false);
    expect(diff.rows.every((row) => row.type === "same")).toBe(true);
    expect(diff.rows[0]).toEqual({
      type: "same",
      oldNo: 1,
      newNo: 1,
      text: "a",
    });
  });

  it("marks a new file as fully added", () => {
    const diff = diffLines("", "hello\nworld");

    expect(diff.added).toBe(2);
    expect(diff.removed).toBe(0);
    expect(diff.truncated).toBe(false);
    expect(diff.rows.map((row) => row.type)).toEqual(["add", "add"]);
    expect(diff.rows[1]).toEqual({
      type: "add",
      oldNo: null,
      newNo: 2,
      text: "world",
    });
  });

  it("aligns modifications with line numbers on both sides", () => {
    const diff = diffLines(
      "keep\nold line\nkeep too",
      "keep\nnew line\nkeep too"
    );

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.rows.map((row) => row.type)).toEqual([
      "same",
      "del",
      "add",
      "same",
    ]);
    expect(diff.rows[1]).toEqual({
      type: "del",
      oldNo: 2,
      newNo: null,
      text: "old line",
    });
    expect(diff.rows[2]).toEqual({
      type: "add",
      oldNo: null,
      newNo: 2,
      text: "new line",
    });
  });

  it("normalizes CRLF before comparing", () => {
    const diff = diffLines("a\r\nb\r\n", "a\nb\n");

    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
  });

  it("keeps exact counts when truncating huge details", () => {
    const oldText = Array.from({ length: 50 }, (_, i) => `line ${i}`).join(
      "\n"
    );
    const newText = `${Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n")}\nappended`;

    const diff = diffLines(oldText, newText, 10);

    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(0);
    expect(diff.truncated).toBe(true);
    expect(diff.rows.length).toBeLessThanOrEqual(10);
    expect(diff.rows.some((row) => row.type === "add")).toBe(true);
  });

  it("bails out honestly on pathological inputs", () => {
    const huge = Array.from({ length: 25_000 }, () => "x").join("\n");
    const diff = diffLines(huge, "y");

    expect(diff.truncated).toBe(true);
    expect(diff.rows).toEqual([]);
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(25_000);
  });

  it("caps stored rows at DIFF_MAX_ROWS by default", () => {
    const block = (prefix: string) =>
      Array.from({ length: 300 }, (_, i) => `${prefix} ${i}`).join("\n");
    const diff = diffLines(block("old"), block("new"));

    expect(diff.rows.length).toBeLessThanOrEqual(DIFF_MAX_ROWS);
  });
});
