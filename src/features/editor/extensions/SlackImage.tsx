import { useCallback, useRef } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { nanoid } from "nanoid";
import { X, GripHorizontal } from "lucide-react";

// ---------------------------------------------------------------------------
// Node view React component
// ---------------------------------------------------------------------------
function SlackImageView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const { src, alt, width } = node.attrs as {
    src: string;
    alt: string;
    width?: number;
  };
  const imgRef = useRef<HTMLImageElement>(null);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth =
        imgRef.current?.getBoundingClientRect().width ??
        width ??
        360;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(60, Math.min(720, startWidth + delta));
        updateAttributes({ width: Math.round(newWidth) });
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [width, updateAttributes],
  );

  return (
    <NodeViewWrapper as="div" className="slack-image" data-drag-handle>
      <div
        className="group relative inline-block"
        style={{ width: width ? `${width}px` : undefined, maxWidth: "100%" }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className={`block w-full rounded-md ${
            selected ? "ring-2 ring-violet-500 ring-offset-1" : ""
          }`}
          style={{ maxWidth: width ? `${width}px` : "360px", display: "block" }}
        />

        {/* Delete button — top-right, visible on hover */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode();
          }}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-red-600 group-hover:flex"
          aria-label="Remove image"
          title="Remove image"
        >
          <X size={10} />
        </button>

        {/* Resize handle — bottom-right, visible on hover */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-1 right-1 hidden h-5 w-5 cursor-ew-resize items-center justify-center rounded bg-slate-900/60 text-white transition-colors hover:bg-slate-900/90 group-hover:flex"
          title="Drag to resize"
          aria-label="Resize image"
        >
          <GripHorizontal size={10} />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Tiptap node definition
// ---------------------------------------------------------------------------
export interface SlackImageOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    slackImage: {
      insertSlackImage: (attrs: {
        src: string;
        alt?: string;
        blockId?: string;
      }) => ReturnType;
    };
  }
}

export const SlackImage = Node.create<SlackImageOptions>({
  name: "slackImage",
  group: "block",
  draggable: true,
  selectable: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      width: {
        default: null,
        parseHTML: (el) => {
          const v = (el as HTMLElement).getAttribute("data-width");
          return v ? Number(v) : null;
        },
        renderHTML: (attrs) =>
          attrs.width ? { "data-width": String(attrs.width) } : {},
      },
      blockId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-block-id"),
        renderHTML: (attrs) => ({ "data-block-id": attrs.blockId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-slack-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { class: "slack-image", "data-slack-image": "true" },
        this.options.HTMLAttributes,
        {
          "data-block-id": HTMLAttributes.blockId ?? "",
          ...(HTMLAttributes.width
            ? { "data-width": String(HTMLAttributes.width) }
            : {}),
        },
      ),
      [
        "img",
        {
          src: HTMLAttributes.src ?? "",
          alt: HTMLAttributes.alt ?? "",
          ...(HTMLAttributes.width
            ? { style: `width:${HTMLAttributes.width}px;max-width:100%` }
            : {}),
        },
      ],
    ];
  },

  addCommands() {
    return {
      insertSlackImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              alt: attrs.alt ?? "",
              blockId: attrs.blockId ?? `image-${nanoid(6)}`,
            },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(SlackImageView);
  },
});
