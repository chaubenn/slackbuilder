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
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface ToolbarProps {
  editor: Editor | null;
  onCopy: () => void;
  isCopying: boolean;
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
        "h-8 w-8 inline-flex items-center justify-center rounded text-slate-600 hover:bg-slate-100",
        active && "bg-slate-200 text-slate-900",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-slate-200" />;
}

export function EditorToolbar({ editor, onCopy, isCopying }: ToolbarProps) {
  const usableEditor = editor && !editor.isDestroyed ? editor : null;
  const can = (() => {
    try {
      return usableEditor?.can();
    } catch {
      return null;
    }
  })();

  return (
    <div className="flex items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
      <ToolbarButton
        title="Bold (Cmd+B)"
        active={usableEditor?.isActive("bold")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic (Cmd+I)"
        active={usableEditor?.isActive("italic")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={usableEditor?.isActive("strike")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={usableEditor?.isActive("code")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleCode().run()}
      >
        <Code size={16} />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        title="Bullet list"
        active={usableEditor?.isActive("bulletList")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={usableEditor?.isActive("orderedList")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Block quote"
        active={usableEditor?.isActive("blockquote")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={usableEditor?.isActive("codeBlock")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={16} />
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
        <LinkIcon size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Insert image URL"
        disabled={!usableEditor}
        onClick={() => {
          const url = window.prompt("Image URL");
          if (!url) return;
          usableEditor?.chain().focus().insertSlackImage({ src: url, alt: "" }).run();
        }}
      >
        <ImageIcon size={16} />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        title="Undo (Cmd+Z)"
        disabled={!can?.undo()}
        onClick={() => usableEditor?.chain().focus().undo().run()}
      >
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="Redo (Cmd+Shift+Z)"
        disabled={!can?.redo()}
        onClick={() => usableEditor?.chain().focus().redo().run()}
      >
        <Redo2 size={16} />
      </ToolbarButton>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onCopy}
        disabled={isCopying}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700",
          isCopying && "opacity-70 cursor-wait",
        )}
        title="Copy to Slack (Cmd+Shift+C)"
      >
        <Copy size={14} />
        {isCopying ? "Copying…" : "Copy to Slack"}
      </button>
    </div>
  );
}
