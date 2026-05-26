import { describe, expect, it } from "vitest";
import { tipTapToBlocks } from "./tipTapToBlocks";
import { mrkdwnToTipTap } from "./mrkdwnToTipTap";

describe("tipTapToBlocks", () => {
  it("groups consecutive text nodes into a single text block", () => {
    const doc = mrkdwnToTipTap("first paragraph\n\nsecond paragraph");
    const blocks = tipTapToBlocks(doc);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].content).toContain("first paragraph");
      expect(blocks[0].content).toContain("second paragraph");
    }
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
