// Parse Slack mrkdwn into a TipTap JSON document.
//
// This is a pragmatic parser tuned for what the editor needs to round-trip,
// not a perfect spec implementation. Supported:
//   • paragraphs and blank lines
//   • `> ` block quotes
//   • ``` ``` ``` code blocks
//   • `- ` / `1. ` lists (top level only)
//   • inline marks: *bold* _italic_ ~strike~ `code`
//   • Slack links: <url> and <url|label>
//   • Slack-escaped &amp; &lt; &gt;

import type { JSONContent } from "@tiptap/react";
import { unescapeSlackText } from "./escape";

export function mrkdwnToTipTap(text: string): JSONContent {
  const lines = text.split("\n");
  const blocks: JSONContent[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].startsWith("```")) i++;
      blocks.push({
        type: "codeBlock",
        content: codeLines.length
          ? [{ type: "text", text: codeLines.join("\n") }]
          : [],
      });
      continue;
    }

    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("> ") || lines[i] === ">")
      ) {
        quoteLines.push(lines[i].replace(/^> ?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        content: quoteLines.map((l) => paragraphFromInline(l)),
      });
      continue;
    }

    const bulletMatch = line.match(/^[-•] (.*)$/);
    if (bulletMatch) {
      const items: JSONContent[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^[-•] (.*)$/);
        if (!m) break;
        items.push({
          type: "listItem",
          content: [paragraphFromInline(m[1])],
        });
        i++;
      }
      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\. (.*)$/);
    if (orderedMatch) {
      const start = parseInt(orderedMatch[1], 10);
      const items: JSONContent[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\. (.*)$/);
        if (!m) break;
        items.push({
          type: "listItem",
          content: [paragraphFromInline(m[1])],
        });
        i++;
      }
      blocks.push({
        type: "orderedList",
        attrs: { start },
        content: items,
      });
      continue;
    }

    blocks.push(paragraphFromInline(line));
    i++;
  }

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph" });
  }

  return { type: "doc", content: blocks };
}

function paragraphFromInline(text: string): JSONContent {
  const content = parseInline(text);
  return { type: "paragraph", content: content.length ? content : undefined };
}

interface ActiveMarks {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

function parseInline(input: string): JSONContent[] {
  const result: JSONContent[] = [];
  let i = 0;
  const marks: ActiveMarks = {};

  const pushText = (raw: string) => {
    if (!raw) return;
    const text = unescapeSlackText(raw);
    const activeMarks: { type: string }[] = [];
    if (marks.bold) activeMarks.push({ type: "bold" });
    if (marks.italic) activeMarks.push({ type: "italic" });
    if (marks.strike) activeMarks.push({ type: "strike" });
    result.push({
      type: "text",
      text,
      ...(activeMarks.length ? { marks: activeMarks } : {}),
    });
  };

  let buffer = "";
  while (i < input.length) {
    const ch = input[i];

    // Inline code: `code` (no nested marks)
    if (ch === "`") {
      const end = input.indexOf("`", i + 1);
      if (end !== -1) {
        if (buffer) {
          pushText(buffer);
          buffer = "";
        }
        const codeText = input.slice(i + 1, end);
        result.push({
          type: "text",
          text: unescapeSlackText(codeText),
          marks: [{ type: "code" }],
        });
        i = end + 1;
        continue;
      }
    }

    // Slack link: <url> or <url|label>
    if (ch === "<") {
      const end = input.indexOf(">", i + 1);
      if (end !== -1) {
        const inner = input.slice(i + 1, end);
        // Skip Slack control sequences like !date, @user, !subteam — render raw.
        if (
          !inner.startsWith("!") &&
          !inner.startsWith("@") &&
          !inner.startsWith("#")
        ) {
          if (buffer) {
            pushText(buffer);
            buffer = "";
          }
          const pipe = inner.indexOf("|");
          const url = pipe === -1 ? inner : inner.slice(0, pipe);
          const label = pipe === -1 ? inner : inner.slice(pipe + 1);
          result.push({
            type: "text",
            text: unescapeSlackText(label || url),
            marks: [{ type: "link", attrs: { href: url } }],
          });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === "*" && canToggleMark(input, i, marks.bold)) {
      if (buffer) {
        pushText(buffer);
        buffer = "";
      }
      marks.bold = !marks.bold;
      i++;
      continue;
    }
    if (ch === "_" && canToggleMark(input, i, marks.italic)) {
      if (buffer) {
        pushText(buffer);
        buffer = "";
      }
      marks.italic = !marks.italic;
      i++;
      continue;
    }
    if (ch === "~" && canToggleMark(input, i, marks.strike)) {
      if (buffer) {
        pushText(buffer);
        buffer = "";
      }
      marks.strike = !marks.strike;
      i++;
      continue;
    }

    buffer += ch;
    i++;
  }

  if (buffer) pushText(buffer);
  return result;
}

// Slack's toggling marks need a non-space character adjacent in the right
// direction. Opening: next char is non-space. Closing: prev char is non-space.
function canToggleMark(
  input: string,
  index: number,
  isActive: boolean | undefined,
): boolean {
  if (isActive) {
    const prev = input[index - 1];
    return Boolean(prev) && !/\s/.test(prev);
  }
  const next = input[index + 1];
  return Boolean(next) && !/\s/.test(next);
}
