import { describe, expect, it } from "vitest";
import { applyEdits } from "./applyEdits";
import { mrkdwnToTipTap } from "../slack/mrkdwnToTipTap";

describe("applyEdits", () => {
  it("applies a block-targeted replace", () => {
    const doc = mrkdwnToTipTap("hello world\n\nsecond line");
    const result = applyEdits(doc, [
      {
        id: "e1",
        type: "replace",
        target: "text-1",
        content: "*hi* there\n\nsecond line",
      },
    ]);
    expect(result.mrkdwn).toContain("*hi* there");
    expect(result.appliedEditIds).toContain("e1");
  });

  it("applies a full rewrite when provided", () => {
    const doc = mrkdwnToTipTap("old message");
    const result = applyEdits(doc, [], {
      fullRewrite: "*brand new* message",
    });
    expect(result.mrkdwn).toBe("*brand new* message");
  });

  it("auto-fixes invalid mrkdwn produced by the AI", () => {
    const doc = mrkdwnToTipTap("hello world");
    const result = applyEdits(doc, [], {
      fullRewrite: "**bold** [click](https://x.com)",
    });
    expect(result.mrkdwn).toBe("*bold* <https://x.com|click>");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("skips edits that target unknown block ids", () => {
    const doc = mrkdwnToTipTap("hi");
    const result = applyEdits(doc, [
      {
        id: "e1",
        type: "replace",
        target: "text-999",
        content: "x",
      },
    ]);
    expect(result.appliedEditIds).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("text-999"))).toBe(true);
  });
});
