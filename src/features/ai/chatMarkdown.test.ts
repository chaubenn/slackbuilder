import { describe, expect, it } from "vitest";
import { parseChatBlocks } from "./chatMarkdown";

describe("parseChatBlocks", () => {
  it("parses headings and bullet lists", () => {
    const blocks = parseChatBlocks(
      "## Stock market information\n\n- Price is $100\n- Updated today",
    );
    expect(blocks).toEqual([
      { type: "heading", level: 2, text: "Stock market information" },
      { type: "list", items: ["Price is $100", "Updated today"] },
    ]);
  });

  it("parses paragraphs between lists", () => {
    const blocks = parseChatBlocks("Hello world\n\nSecond line");
    expect(blocks).toEqual([
      { type: "paragraph", text: "Hello world" },
      { type: "paragraph", text: "Second line" },
    ]);
  });
});
