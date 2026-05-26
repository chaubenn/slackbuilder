import { describe, expect, it } from "vitest";
import { validateMrkdwn } from "./validateMrkdwn";

describe("validateMrkdwn", () => {
  it("rewrites GFM bold to Slack bold", () => {
    const { fixed, issues } = validateMrkdwn("hello **world**");
    expect(fixed).toBe("hello *world*");
    expect(issues.map((i) => i.rule)).toContain("no-double-asterisk-bold");
  });

  it("rewrites GFM strike to Slack strike", () => {
    const { fixed } = validateMrkdwn("~~gone~~");
    expect(fixed).toBe("~gone~");
  });

  it("rewrites GFM links to Slack links", () => {
    const { fixed } = validateMrkdwn("[Slack](https://slack.com)");
    expect(fixed).toBe("<https://slack.com|Slack>");
  });

  it("rewrites headings to bold", () => {
    const { fixed, issues } = validateMrkdwn("# Title\nbody");
    expect(fixed).toBe("*Title*\nbody");
    expect(issues.some((i) => i.rule === "no-headings")).toBe(true);
  });

  it("rewrites literal formatting labels on title lines", () => {
    const { fixed, issues } = validateMrkdwn(
      "bold Personal Background\nbody\nitalic Editorial note",
    );
    expect(fixed).toBe("*Personal Background*\nbody\n_Editorial note_");
    expect(issues.some((i) => i.rule === "no-literal-formatting-labels")).toBe(
      true,
    );
  });

  it("returns clean output unchanged", () => {
    const { fixed, issues } = validateMrkdwn("*bold* _italic_ <url|x>");
    expect(fixed).toBe("*bold* _italic_ <url|x>");
    expect(issues).toEqual([]);
  });
});
