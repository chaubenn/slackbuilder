import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { tipTapToSlackDelta } from "./tipTapToSlackDelta";

function opsFor(doc: JSONContent) {
  return JSON.parse(tipTapToSlackDelta(doc)).ops;
}

describe("tipTapToSlackDelta", () => {
  it("maps Slack bold and italic marks to Quill attributes", () => {
    const ops = opsFor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
          ],
        },
      ],
    });

    expect(ops).toEqual([
      { insert: "bold", attributes: { bold: true } },
      { insert: " " },
      { insert: "italic", attributes: { italic: true } },
      { insert: "\n" },
    ]);
  });

  it("emits Slack-compatible block and link attributes", () => {
    const ops = opsFor({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "first" }],
                },
              ],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Example",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    });

    expect(ops).toEqual([
      { insert: "first" },
      { insert: "\n", attributes: { list: "bullet" } },
      { insert: "Example", attributes: { link: "https://example.com" } },
      { insert: "\n" },
    ]);
  });
});
