// Serialize a TipTap JSON document into Slack mrkdwn.
// Slack mrkdwn rules (per https://docs.slack.dev/messaging/formatting-message-text):
//   *bold*  _italic_  ~strike~  `code`  ```code block```  > quote
//   <url> or <url|label>
//   bullet/ordered lists have no native mrkdwn syntax; we render plain "- " / "1. "

import type { JSONContent } from "@tiptap/react";
import { escapeSlackText } from "./escape";

interface Ctx {
  inCodeBlock?: boolean;
}

export function tipTapToMrkdwn(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  const out: string[] = [];
  renderChildren(doc.content, out, {});
  let text = out.join("");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.replace(/\s+$/g, "");
}

function renderChildren(
  nodes: JSONContent[] | undefined,
  out: string[],
  ctx: Ctx,
  joiner = "",
) {
  if (!nodes) return;
  for (let i = 0; i < nodes.length; i++) {
    renderNode(nodes[i], out, ctx);
    if (joiner && i < nodes.length - 1) out.push(joiner);
  }
}

function renderNode(node: JSONContent, out: string[], ctx: Ctx) {
  switch (node.type) {
    case "doc":
      renderChildren(node.content, out, ctx);
      return;

    case "paragraph": {
      renderChildren(node.content, out, ctx);
      out.push("\n");
      return;
    }

    case "heading": {
      // Slack mrkdwn has no headings; emulate as *bold* line.
      out.push("*");
      renderChildren(node.content, out, ctx);
      out.push("*\n");
      return;
    }

    case "hardBreak":
      out.push("\n");
      return;

    case "bulletList": {
      for (const item of node.content ?? []) {
        renderListItem(item, out, ctx, "- ");
      }
      return;
    }

    case "orderedList": {
      const start = (node.attrs?.start as number) ?? 1;
      const items = node.content ?? [];
      for (let i = 0; i < items.length; i++) {
        renderListItem(items[i], out, ctx, `${start + i}. `);
      }
      return;
    }

    case "blockquote": {
      const inner: string[] = [];
      renderChildren(node.content, inner, ctx);
      const text = inner.join("").replace(/\n+$/g, "");
      const lines = text.split("\n");
      for (const line of lines) {
        out.push(`> ${line}\n`);
      }
      return;
    }

    case "codeBlock": {
      const inner: string[] = [];
      renderChildren(node.content, inner, { ...ctx, inCodeBlock: true });
      const code = inner.join("");
      out.push("```\n");
      out.push(code.endsWith("\n") ? code : code + "\n");
      out.push("```\n");
      return;
    }

    case "slackImage": {
      const url = (node.attrs?.src as string | undefined) ?? "";
      const alt = (node.attrs?.alt as string | undefined) ?? "";
      if (url) {
        out.push(alt ? `<${url}|${alt}>` : `<${url}>`);
        out.push("\n");
      }
      return;
    }

    case "slackLinkUnfurl": {
      const url = (node.attrs?.url as string | undefined) ?? "";
      const title = (node.attrs?.title as string | undefined) ?? "";
      if (url) {
        out.push(title ? `<${url}|${title}>` : `<${url}>`);
        out.push("\n");
      }
      return;
    }

    case "text": {
      out.push(renderText(node, ctx));
      return;
    }

    default: {
      // Unknown node — render its children as a best-effort fallback.
      renderChildren(node.content, out, ctx);
    }
  }
}

function renderListItem(
  item: JSONContent,
  out: string[],
  ctx: Ctx,
  prefix: string,
) {
  const inner: string[] = [];
  renderChildren(item.content, inner, ctx);
  const text = inner.join("").replace(/\n+$/g, "");
  const lines = text.split("\n");
  out.push(`${prefix}${lines[0] ?? ""}\n`);
  for (let i = 1; i < lines.length; i++) {
    out.push(`  ${lines[i]}\n`);
  }
}

function renderText(node: JSONContent, ctx: Ctx): string {
  const raw = node.text ?? "";
  if (ctx.inCodeBlock) return raw;

  const marks = node.marks ?? [];
  let text = raw;

  const linkMark = marks.find((m) => m.type === "link");
  const isCode = marks.some((m) => m.type === "code");

  if (isCode) {
    return "`" + text + "`";
  }

  text = escapeSlackText(text);

  if (marks.some((m) => m.type === "bold")) {
    text = wrapPreservingSpaces(text, "*");
  }
  if (marks.some((m) => m.type === "italic")) {
    text = wrapPreservingSpaces(text, "_");
  }
  if (marks.some((m) => m.type === "strike")) {
    text = wrapPreservingSpaces(text, "~");
  }

  if (linkMark) {
    const href = (linkMark.attrs?.href as string | undefined) ?? "";
    if (href) {
      const visible = text === escapeSlackText(href) ? "" : `|${text}`;
      return `<${href}${visible}>`;
    }
  }

  return text;
}

function wrapPreservingSpaces(text: string, marker: string): string {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return `${marker}${text}${marker}`;
  const [, leading, body, trailing] = match;
  if (!body) return text;
  return `${leading}${marker}${body}${marker}${trailing}`;
}
