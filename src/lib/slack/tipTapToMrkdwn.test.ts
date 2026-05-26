import { describe, expect, it } from "vitest";
import { tipTapToMrkdwn } from "./tipTapToMrkdwn";

describe("tipTapToMrkdwn", () => {
  it("renders a plain paragraph", () => {
    expect(
      tipTapToMrkdwn({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "hello world" }],
          },
        ],
      }),
    ).toBe("hello world");
  });

  it("serializes Slack bold/italic/strike", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: " " },
            { type: "text", text: "strike", marks: [{ type: "strike" }] },
          ],
        },
      ],
    };
    expect(tipTapToMrkdwn(doc)).toBe("*bold* _italic_ ~strike~");
  });

  it("serializes Slack inline code without nested marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "see " },
            { type: "text", text: "foo()", marks: [{ type: "code" }] },
          ],
        },
      ],
    };
    expect(tipTapToMrkdwn(doc)).toBe("see `foo()`");
  });

  it("serializes Slack link with label", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "docs",
              marks: [{ type: "link", attrs: { href: "https://slack.com" } }],
            },
          ],
        },
      ],
    };
    expect(tipTapToMrkdwn(doc)).toBe("<https://slack.com|docs>");
  });

  it("serializes block quotes line by line", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "one" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "two" }],
            },
          ],
        },
      ],
    };
    expect(tipTapToMrkdwn(doc)).toBe("> one\n> two");
  });

  it("serializes triple-backtick code blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          content: [{ type: "text", text: "line1\nline2" }],
        },
      ],
    };
    expect(tipTapToMrkdwn(doc)).toBe("```\nline1\nline2\n```");
  });

  it("escapes < > & in text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a < b && c > d" }],
        },
      ],
    };
    expect(tipTapToMrkdwn(doc)).toBe("a &lt; b &amp;&amp; c &gt; d");
  });

  it("serializes bullet and ordered lists", () => {
    const doc = {
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
                  content: [{ type: "text", text: "one" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "two" }],
                },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 1 },
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
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "second" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tipTapToMrkdwn(doc)).toBe("- one\n- two\n1. first\n2. second");
  });
});
