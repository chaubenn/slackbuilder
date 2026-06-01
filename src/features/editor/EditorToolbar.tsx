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
  X,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface LinkDialogProps {
  initialUrl: string;
  initialText: string;
  isEditing: boolean;
  onConfirm: (url: string, text: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

function LinkDialog({
  initialUrl,
  initialText,
  isEditing,
  onConfirm,
  onRemove,
  onClose,
}: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const urlRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const target = isEditing ? textRef.current : urlRef.current;
    target?.focus();
    target?.select();
  }, [isEditing]);

  const handleConfirm = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const finalUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    onConfirm(finalUrl, text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onClose();
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-slate-600 dark:bg-[#2b2d31] dark:text-slate-100 dark:placeholder-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[340px] rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-[#1e2124] dark:ring-slate-700">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <LinkIcon size={14} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {isEditing ? "Edit link" : "Add link"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          {isEditing && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Display text
              </label>
              <input
                ref={textRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Link text"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              URL
            </label>
            <input
              ref={urlRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          {isEditing && (
            <button
              onClick={onRemove}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 size={12} />
              Remove
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!url.trim()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {isEditing ? "Update" : "Add link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LinkDialogState {
  isEditing: boolean;
  initialUrl: string;
  initialText: string;
  linkRange: { from: number; to: number } | null;
}

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
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);

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
        title="Add / edit link"
        disabled={!usableEditor}
        active={usableEditor?.isActive("link")}
        onClick={() => {
          if (!usableEditor) return;
          if (usableEditor.isActive("link")) {
            const href = (usableEditor.getAttributes("link").href as string) ?? "";
            // Extend selection to the full link mark to capture display text and range
            usableEditor.chain().extendMarkRange("link").run();
            const { from, to } = usableEditor.state.selection;
            const linkText = usableEditor.state.doc.textBetween(from, to, "");
            setLinkDialog({ isEditing: true, initialUrl: href, initialText: linkText, linkRange: { from, to } });
          } else {
            setLinkDialog({ isEditing: false, initialUrl: "", initialText: "", linkRange: null });
          }
        }}
      >
        <LinkIcon size={15} />
      </ToolbarButton>
      {linkDialog && (
        <LinkDialog
          initialUrl={linkDialog.initialUrl}
          initialText={linkDialog.initialText}
          isEditing={linkDialog.isEditing}
          onConfirm={(url, text) => {
            if (linkDialog.isEditing && linkDialog.linkRange) {
              const { from, to } = linkDialog.linkRange;
              usableEditor?.chain().focus().command(({ tr, state }) => {
                const mark = state.schema.marks.link.create({ href: url });
                tr.replaceWith(from, to, state.schema.text(text || url, [mark]));
                return true;
              }).run();
            } else {
              usableEditor?.chain().focus().setLink({ href: url }).run();
            }
            setLinkDialog(null);
          }}
          onRemove={() => {
            if (linkDialog.linkRange) {
              const { from, to } = linkDialog.linkRange;
              usableEditor?.chain().focus().setTextSelection({ from, to }).unsetLink().run();
            } else {
              usableEditor?.chain().focus().extendMarkRange("link").unsetLink().run();
            }
            setLinkDialog(null);
          }}
          onClose={() => setLinkDialog(null)}
        />
      )}
      {/* Image button — label wraps the input so WebKit on macOS treats the
          click as a direct user gesture (programmatic .click() is blocked there) */}
      <label
        title="Insert image from file"
        className={cn(
          "h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 transition-colors",
          usableEditor
            ? "cursor-pointer hover:bg-slate-100 hover:text-slate-800"
            : "cursor-not-allowed opacity-40",
        )}
      >
        <ImageIcon size={15} />
        <input
          type="file"
          accept="image/*"
          disabled={!usableEditor}
          className="sr-only"
          onChange={handleImageFileChange}
        />
      </label>
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
