import type { JSONContent } from "@tiptap/react";

type DeltaAttributes = Record<string, string | boolean>;

interface DeltaOp {
  insert: string;
  attributes?: DeltaAttributes;
}

interface RenderContext {
  blockAttrs?: DeltaAttributes;
  inlineAttrs?: DeltaAttributes;
}

export function tipTapToSlackDelta(doc: JSONContent | null | undefined): string {
  const ops: DeltaOp[] = [];
  if (doc) renderNode(doc, ops, {});
  if (ops.length === 0 || !ops[ops.length - 1].insert.endsWith("\n")) {
    pushOp(ops, "\n");
  }
  return JSON.stringify({ ops });
}

function renderChildren(
  nodes: JSONContent[] | undefined,
  ops: DeltaOp[],
  ctx: RenderContext,
) {
  for (const node of nodes ?? []) {
    renderNode(node, ops, ctx);
  }
}

function renderNode(node: JSONContent, ops: DeltaOp[], ctx: RenderContext) {
  switch (node.type) {
    case "doc":
      renderChildren(node.content, ops, ctx);
      return;

    case "paragraph":
      renderChildren(node.content, ops, ctx);
      pushOp(ops, "\n", ctx.blockAttrs);
      return;

    case "heading":
      renderChildren(node.content, ops, {
        ...ctx,
        inlineAttrs: { ...ctx.inlineAttrs, bold: true },
      });
      pushOp(ops, "\n", ctx.blockAttrs);
      return;

    case "hardBreak":
      pushOp(ops, "\n", ctx.inlineAttrs);
      return;

    case "bulletList":
      renderList(node, ops, { list: "bullet" });
      return;

    case "orderedList":
      renderList(node, ops, { list: "ordered" });
      return;

    case "listItem":
      renderListItem(node, ops, ctx.blockAttrs);
      return;

    case "blockquote":
      renderChildren(node.content, ops, {
        ...ctx,
        blockAttrs: { ...ctx.blockAttrs, blockquote: true },
      });
      return;

    case "codeBlock":
      renderCodeBlock(node, ops);
      return;

    case "slackImage":
    case "slackLinkUnfurl":
      renderLinkedBlock(node, ops);
      return;

    case "text":
      pushOp(ops, node.text ?? "", {
        ...ctx.inlineAttrs,
        ...attrsForMarks(node.marks),
      });
      return;

    default:
      renderChildren(node.content, ops, ctx);
  }
}

function renderList(node: JSONContent, ops: DeltaOp[], blockAttrs: DeltaAttributes) {
  for (const item of node.content ?? []) {
    renderListItem(item, ops, blockAttrs);
  }
}

function renderListItem(
  item: JSONContent,
  ops: DeltaOp[],
  blockAttrs: DeltaAttributes | undefined,
) {
  const children = item.content ?? [];
  if (children.length === 0) {
    pushOp(ops, "\n", blockAttrs);
    return;
  }

  for (const child of children) {
    if (child.type === "paragraph") {
      renderChildren(child.content, ops, {});
      pushOp(ops, "\n", blockAttrs);
    } else {
      renderNode(child, ops, { blockAttrs });
    }
  }
}

function renderCodeBlock(node: JSONContent, ops: DeltaOp[]) {
  const text = collectPlainText(node).replace(/\n$/, "");
  const lines = text.split("\n");

  for (const line of lines.length ? lines : [""]) {
    if (line) pushOp(ops, line);
    pushOp(ops, "\n", { "code-block": true });
  }
}

function renderLinkedBlock(node: JSONContent, ops: DeltaOp[]) {
  const url = (node.attrs?.url as string | undefined) ?? (node.attrs?.src as string | undefined);
  if (!url) return;

  const label =
    (node.attrs?.title as string | undefined) ||
    (node.attrs?.alt as string | undefined) ||
    url;
  pushOp(ops, label, { link: url });
  pushOp(ops, "\n");
}

function attrsForMarks(marks: JSONContent["marks"]): DeltaAttributes | undefined {
  const attrs: DeltaAttributes = {};
  for (const mark of marks ?? []) {
    if (mark.type === "bold") attrs.bold = true;
    if (mark.type === "italic") attrs.italic = true;
    if (mark.type === "strike") attrs.strike = true;
    if (mark.type === "code") attrs.code = true;
    if (mark.type === "link" && typeof mark.attrs?.href === "string") {
      attrs.link = mark.attrs.href;
    }
  }
  return Object.keys(attrs).length ? attrs : undefined;
}

function collectPlainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(collectPlainText).join("");
}

function pushOp(
  ops: DeltaOp[],
  insert: string,
  attributes?: DeltaAttributes,
) {
  if (!insert) return;
  const normalizedAttrs =
    attributes && Object.keys(attributes).length ? attributes : undefined;
  const previous = ops[ops.length - 1];
  if (previous && sameAttrs(previous.attributes, normalizedAttrs)) {
    previous.insert += insert;
    return;
  }
  ops.push(normalizedAttrs ? { insert, attributes: normalizedAttrs } : { insert });
}

function sameAttrs(a?: DeltaAttributes, b?: DeltaAttributes): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}
