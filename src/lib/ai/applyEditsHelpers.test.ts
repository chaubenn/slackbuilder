import { describe, expect, it } from "vitest";
import { applyEdits } from "./applyEdits";
import { shouldUseOptionalFullRewrite } from "./applyEditsHelpers";
import { mrkdwnToTipTap } from "../slack/mrkdwnToTipTap";
import { tipTapToMrkdwn } from "../slack/tipTapToMrkdwn";

describe("shouldUseOptionalFullRewrite", () => {
  it("allows full rewrite only for a single rewrite_section edit", () => {
    expect(
      shouldUseOptionalFullRewrite(
        "full body",
        [
          {
            id: "e1",
            type: "rewrite_section",
            target: { start: 0, end: 0 },
            content: "full body",
          },
        ],
        1,
      ),
    ).toBe(true);
    expect(
      shouldUseOptionalFullRewrite(
        "partial snapshot",
        [
          { id: "e1", type: "delete", target: "text-1" },
          {
            id: "e2",
            type: "insert",
            target: { start: 10, end: 10 },
            content: "snippet",
          },
        ],
        2,
      ),
    ).toBe(false);
  });
});

describe("applyEdits without erroneous fullRewrite", () => {
  it("keeps existing text when appending a block at the end", () => {
    const doc = mrkdwnToTipTap("Dear team,\n\nPlease review.");
    const base = tipTapToMrkdwn(doc);
    const result = applyEdits(doc, [
      {
        id: "e1",
        type: "insert",
        target: { start: base.length, end: base.length },
        content: "\n\n```python\npass\n```",
      },
    ]);
    expect(result.mrkdwn).toContain("Dear team");
    expect(result.mrkdwn).toContain("```python");
  });
});
