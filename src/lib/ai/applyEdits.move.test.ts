import { describe, expect, it } from "vitest";
import { applyEdits } from "./applyEdits";
import { mrkdwnToTipTap } from "../slack/mrkdwnToTipTap";
import { tipTapToMrkdwn } from "../slack/tipTapToMrkdwn";
import { parseAiResponse } from "./parseEditResponse";

describe("move edits", () => {
  it("parses move type with destination", () => {
    const result = parseAiResponse(`\`\`\`json
{
  "assistantMessage": "Moving code",
  "edits": [
    {
      "type": "move",
      "target": "code-1",
      "destination": "text-2",
      "rationale": "relocate snippet"
    }
  ]
}
\`\`\``);
    expect(result.edits[0].type).toBe("move");
    expect(result.edits[0].target).toBe("code-1");
    expect(result.edits[0].destination).toBe("text-2");
  });

  it("relocates a code block without wiping prose", () => {
    const doc = mrkdwnToTipTap(
      "```python\njwt.check()\n```\n\n*Proposed Solutions*\n\n- monitor keys",
    );
    const base = tipTapToMrkdwn(doc);
    const result = applyEdits(doc, [
      {
        id: "m1",
        type: "move",
        target: "code-1",
        destination: "text-1",
        rationale: "move code below solutions",
      },
    ]);
    expect(result.mrkdwn).toContain("Proposed Solutions");
    expect(result.mrkdwn).toContain("monitor keys");
    expect(result.mrkdwn).toContain("jwt.check()");
    const solutionsIdx = result.mrkdwn.indexOf("Proposed Solutions");
    const codeIdx = result.mrkdwn.indexOf("jwt.check()");
    expect(solutionsIdx).toBeGreaterThan(-1);
    expect(codeIdx).toBeGreaterThan(solutionsIdx);
    expect(result.mrkdwn.length).toBeGreaterThan(base.length * 0.5);
  });

  it("delete on text-1 removes only that paragraph, not the whole message", () => {
    const doc = mrkdwnToTipTap(
      "```python\na\n```\n\nHello team\n\n*Proposed Solutions*\n\n- one",
    );
    const result = applyEdits(doc, [
      { id: "d1", type: "delete", target: "text-1" },
    ]);
    expect(result.mrkdwn).not.toContain("Hello team");
    expect(result.mrkdwn).toContain("```");
    expect(result.mrkdwn).toContain("Proposed Solutions");
  });
});
