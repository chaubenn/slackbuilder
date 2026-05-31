import { describe, expect, it } from "vitest";
import { normalizeEditPositions, wantsAppendToMessage } from "./editPosition";
import { applyEdits } from "./applyEdits";
import { mrkdwnToTipTap } from "../slack/mrkdwnToTipTap";
import { tipTapToMrkdwn } from "../slack/tipTapToMrkdwn";

describe("wantsAppendToMessage", () => {
  it("detects bottom/end phrasing", () => {
    expect(
      wantsAppendToMessage(
        "input just at the bottom of the message the current price of bitcoin",
      ),
    ).toBe(true);
    expect(wantsAppendToMessage("add a line at the end")).toBe(true);
    expect(wantsAppendToMessage("make the title bold")).toBe(false);
  });

  it("does not treat move-to-bottom as append-only", () => {
    expect(
      wantsAppendToMessage("move the code snippets to the bottom of the editor"),
    ).toBe(false);
  });
});

describe("normalizeEditPositions move", () => {
  it("leaves delete+insert edits unchanged for move requests", () => {
    const mrkdwn = "```py\ncode\n```\n\nDear team,";
    const edits = normalizeEditPositions(
      mrkdwn,
      [
        { id: "e1", type: "delete", target: "text-1", content: "" },
        {
          id: "e2",
          type: "insert",
          target: { start: mrkdwn.length, end: mrkdwn.length },
          content: "\n\n```py\ncode\n```",
        },
      ],
      { userMessage: "move the code snippets to the bottom" },
    );
    expect(edits[0].type).toBe("delete");
    expect(edits[1].type).toBe("insert");
  });
});

describe("normalizeEditPositions", () => {
  const mrkdwn = "line one\n\nline two";

  it("remaps insert at {0,0} to end when append intent", () => {
    const edits = normalizeEditPositions(
      mrkdwn,
      [
        {
          id: "e1",
          type: "insert",
          target: { start: 0, end: 0 },
          content: "BTC: $100",
        },
      ],
      { userMessage: "add at the bottom" },
    );
    expect(edits[0].target).toEqual({ start: mrkdwn.length, end: mrkdwn.length });
    expect(edits[0].content).toMatch(/^\n\nBTC/);
  });

  it("remaps first-block replace to append insert", () => {
    const edits = normalizeEditPositions(
      mrkdwn,
      [
        {
          id: "e1",
          type: "replace",
          target: "text-1",
          content: "BTC: $100",
        },
      ],
      { userMessage: "append bitcoin price at the end" },
    );
    expect(edits[0].type).toBe("insert");
    expect(edits[0].target).toEqual({ start: mrkdwn.length, end: mrkdwn.length });
  });
});

describe("applyEdits insert placement", () => {
  it("appends at message end via offset target", () => {
    const doc = mrkdwnToTipTap("hello\n\nworld");
    const base = tipTapToMrkdwn(doc);
    const append = "\n\nBTC: $100";
    const result = applyEdits(doc, [
      {
        id: "e1",
        type: "insert",
        target: { start: base.length, end: base.length },
        content: append,
      },
    ]);
    expect(result.mrkdwn).toBe(base + append);
    expect(result.mrkdwn.endsWith("BTC: $100")).toBe(true);
  });

  it("inserts after a block (not before it) when targeting block id", () => {
    const doc = mrkdwnToTipTap("first block only");
    const base = tipTapToMrkdwn(doc);
    const result = applyEdits(doc, [
      {
        id: "e1",
        type: "insert",
        target: "text-1",
        content: "\n\n(inserted)",
      },
    ]);
    expect(result.mrkdwn.startsWith("first block only")).toBe(true);
    expect(result.mrkdwn).toBe(base + "\n\n(inserted)");
  });
});
