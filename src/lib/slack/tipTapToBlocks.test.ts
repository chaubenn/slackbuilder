import { describe, expect, it } from "vitest";
import { tipTapToBlocks } from "./tipTapToBlocks";
import { mrkdwnToTipTap } from "./mrkdwnToTipTap";

describe("tipTapToBlocks", () => {
  it("assigns separate blocks per top-level paragraph", () => {
    const doc = mrkdwnToTipTap("first paragraph\n\nsecond paragraph");
    const blocks = tipTapToBlocks(doc);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks.every((b) => b.type === "text")).toBe(true);
  });

  it("splits code blocks from prose", () => {
    const doc = mrkdwnToTipTap(
      "```python\nx = 1\n```\n\nDear team,\n\n- item",
    );
    const blocks = tipTapToBlocks(doc);
    expect(blocks.map((b) => b.type)).toEqual(["code", "text", "text"]);
    expect(blocks[0].blockId).toBe("code-1");
  });

  it("extracts an image block with its block id", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "before" }],
        },
        {
          type: "slackImage",
          attrs: { src: "https://x.com/a.png", blockId: "image-1" },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "after" }],
        },
      ],
    };
    const blocks = tipTapToBlocks(doc);
    expect(blocks.map((b) => b.type)).toEqual(["text", "image", "text"]);
    expect(blocks[1].blockId).toBe("image-1");
  });

  it("assigns stable block ids when missing", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "slackLinkUnfurl",
          attrs: { url: "https://x.com" },
        },
      ],
    };
    const blocks = tipTapToBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("link");
    expect(blocks[0].blockId).toMatch(/^link-/);
  });
});
