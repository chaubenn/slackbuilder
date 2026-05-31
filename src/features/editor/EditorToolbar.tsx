import { useEffect, useRef, useState } from "react";
import { type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Code2,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Copy,
  Check,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface ToolbarProps {
  editor: Editor | null;
  onCopy: () => void;
  isCopying: boolean;
  copyFeedback?: "idle" | "copied" | "error";
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ active, disabled, onClick, title, children }: ButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800",
        active && "bg-slate-100 text-slate-900",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-0.5 h-4 w-px bg-slate-200" />;
}

export function EditorToolbar({
  editor,
  onCopy,
  isCopying,
  copyFeedback = "idle",
}: ToolbarProps) {
  const usableEditor = editor && !editor.isDestroyed ? editor : null;
  const [, forceTick] = useState(0);
  const imageFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!usableEditor) return;
    const update = () => forceTick((tick) => tick + 1);
    usableEditor.on("transaction", update);
    usableEditor.on("selectionUpdate", update);
    usableEditor.on("update", update);
    return () => {
      usableEditor.off("transaction", update);
      usableEditor.off("selectionUpdate", update);
      usableEditor.off("update", update);
    };
  }, [usableEditor]);

  const can = (() => {
    try {
      return usableEditor?.can();
    } catch {
      return null;
    }
  })();

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usableEditor) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      usableEditor.chain().focus().insertSlackImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-0.5 border-b border-slate-200 bg-white px-2 py-1.5">
      <ToolbarButton
        title="Bold (Cmd+B)"
        active={usableEditor?.isActive("bold")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic (Cmd+I)"
        active={usableEditor?.isActive("italic")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={usableEditor?.isActive("strike")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={usableEditor?.isActive("code")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleCode().run()}
      >
        <Code size={15} />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        title="Bullet list"
        active={usableEditor?.isActive("bulletList")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={usableEditor?.isActive("orderedList")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Block quote"
        active={usableEditor?.isActive("blockquote")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={usableEditor?.isActive("codeBlock")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={15} />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        title="Add link"
        disabled={!usableEditor}
        onClick={() => {
          const url = window.prompt("Link URL");
          if (!url) return;
          usableEditor?.chain().focus().setLink({ href: url }).run();
        }}
      >
        <LinkIcon size={15} />
      </ToolbarButton>
      {/* Image button — opens a file picker instead of a URL prompt */}
      <ToolbarButton
        title="Insert image from file"
        disabled={!usableEditor}
        onClick={() => imageFileRef.current?.click()}
      >
        <ImageIcon size={15} />
      </ToolbarButton>
      <input
        ref={imageFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <Separator />
      <ToolbarButton
        title="Undo (Cmd+Z)"
        disabled={!can?.undo()}
        onClick={() => usableEditor?.chain().focus().undo().run()}
      >
        <Undo2 size={15} />
      </ToolbarButton>
      <ToolbarButton
        title="Redo (Cmd+Shift+Z)"
        disabled={!can?.redo()}
        onClick={() => usableEditor?.chain().focus().redo().run()}
      >
        <Redo2 size={15} />
      </ToolbarButton>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onCopy}
        disabled={isCopying}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-all duration-200",
          copyFeedback === "copied" &&
            "bg-emerald-600 text-white hover:bg-emerald-600",
          copyFeedback === "error" &&
            "bg-red-600 text-white hover:bg-red-600",
          copyFeedback === "idle" &&
            "bg-slate-900 text-white hover:bg-slate-800",
          isCopying && "cursor-wait opacity-70",
        )}
        title="Copy to Slack (Cmd+Shift+C)"
        aria-live="polite"
      >
        {copyFeedback === "copied" ? (
          <Check size={13} className="shrink-0" />
        ) : (
          <Copy size={13} className="shrink-0" />
        )}
        {isCopying
          ? "Copying…"
          : copyFeedback === "copied"
            ? "Copied!"
            : copyFeedback === "error"
              ? "Copy failed"
              : "Copy to Slack"}
      </button>
    </div>
  );
}
