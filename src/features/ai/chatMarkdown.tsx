import type { ReactNode } from "react";

/** Inline markdown: **bold**, [label](url), bare URLs. */
export function renderChatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re =
    /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        parts.push(
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 underline hover:text-violet-800"
          >
            {link[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(
        <a
          key={key++}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-600 underline hover:text-violet-800 break-all"
        >
          {token}
        </a>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; items: string[] }
  | { type: "paragraph"; text: string };

export function parseChatBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: [...listItems] });
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    blocks.push({ type: "paragraph", text: trimmed });
  }

  flushList();
  return blocks;
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-base font-semibold text-slate-900",
  2: "text-sm font-semibold text-slate-900",
  3: "text-sm font-medium text-slate-800",
  4: "text-sm font-medium text-slate-700",
  5: "text-xs font-medium text-slate-700",
  6: "text-xs font-medium text-slate-600",
};

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseChatBlocks(text);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const level = Math.min(block.level, 6);
          const className = HEADING_CLASS[level] ?? HEADING_CLASS[2];
          if (level === 1) {
            return (
              <h1 key={i} className={className}>
                {renderChatInline(block.text)}
              </h1>
            );
          }
          if (level === 2) {
            return (
              <h2 key={i} className={className}>
                {renderChatInline(block.text)}
              </h2>
            );
          }
          if (level === 3) {
            return (
              <h3 key={i} className={className}>
                {renderChatInline(block.text)}
              </h3>
            );
          }
          return (
            <p key={i} className={className}>
              {renderChatInline(block.text)}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4">
              {block.items.map((item, j) => (
                <li key={j}>{renderChatInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-slate-700">
            {renderChatInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
