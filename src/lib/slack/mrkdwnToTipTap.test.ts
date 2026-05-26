import { describe, expect, it } from "vitest";
import { mrkdwnToTipTap } from "./mrkdwnToTipTap";
import { tipTapToMrkdwn } from "./tipTapToMrkdwn";

describe("mrkdwnToTipTap", () => {
  it("parses bold/italic/strike", () => {
    const doc = mrkdwnToTipTap("*bold* _italic_ ~strike~");
    expect(doc.content?.[0].type).toBe("paragraph");
    const text = doc.content?.[0].content ?? [];
    expect(text.find((t) => t.text === "bold")?.marks?.[0].type).toBe("bold");
    expect(text.find((t) => t.text === "italic")?.marks?.[0].type).toBe("italic");
    expect(text.find((t) => t.text === "strike")?.marks?.[0].type).toBe("strike");
  });

  it("parses Slack links with label", () => {
    const doc = mrkdwnToTipTap("<https://slack.com|docs>");
    const text = doc.content?.[0].content?.[0];
    expect(text?.text).toBe("docs");
    expect(text?.marks?.[0].attrs?.href).toBe("https://slack.com");
  });

  it("parses bare-url Slack links", () => {
    const doc = mrkdwnToTipTap("<https://slack.com>");
    const text = doc.content?.[0].content?.[0];
    expect(text?.text).toBe("https://slack.com");
    expect(text?.marks?.[0].attrs?.href).toBe("https://slack.com");
  });

  it("parses block quotes", () => {
    const doc = mrkdwnToTipTap("> hi\n> bye");
    expect(doc.content?.[0].type).toBe("blockquote");
    expect(doc.content?.[0].content?.length).toBe(2);
  });

  it("parses code blocks", () => {
    const doc = mrkdwnToTipTap("```\nfoo\nbar\n```");
    expect(doc.content?.[0].type).toBe("codeBlock");
    expect(doc.content?.[0].content?.[0].text).toBe("foo\nbar");
  });

  it("parses inline code without nested marks", () => {
    const doc = mrkdwnToTipTap("see `foo()`");
    const inline = doc.content?.[0].content ?? [];
    const code = inline.find((t) => t.text === "foo()");
    expect(code?.marks?.[0].type).toBe("code");
  });

  it("round-trips through tipTapToMrkdwn", () => {
    const original =
      "*bold* and _italic_\n> a quote\n- item one\n- item two\n<https://slack.com|click here>";
    const doc = mrkdwnToTipTap(original);
    const back = tipTapToMrkdwn(doc);
    expect(back).toContain("*bold*");
    expect(back).toContain("_italic_");
    expect(back).toContain("> a quote");
    expect(back).toContain("- item one");
    expect(back).toContain("<https://slack.com|click here>");
  });

  it("unescapes &lt; &gt; &amp;", () => {
    const doc = mrkdwnToTipTap("a &lt; b &amp;&amp; c &gt; d");
    const text = doc.content?.[0].content?.[0].text;
    expect(text).toBe("a < b && c > d");
  });
});
