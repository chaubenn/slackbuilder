import { useCallback, useEffect, useRef, useState } from "react";
import { type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  SquareCode,
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
import { HoverTooltip } from "../../components/HoverTooltip";
import { shouldCompactCopyButton } from "./copyButtonLayout";
import {
  APP_SHORTCUTS,
  OPEN_LINK_DIALOG_EVENT,
  SLACK_FORMAT,
} from "../../lib/slackFormatShortcuts";

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
    <HoverTooltip label={title} placement="bottom">
      <button
        type="button"
        aria-label={title}
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return;
          onClick();
        }}
        className={cn(
          "h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800",
          active && "bg-slate-100 text-slate-900",
          disabled && "opacity-40 cursor-not-allowed",
        )}
      >
        {children}
      </button>
    </HoverTooltip>
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
  const [compactCopyButton, setCompactCopyButton] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  const openLinkDialog = useCallback(() => {
    if (!usableEditor) return;
    if (usableEditor.isActive("link")) {
      const href = (usableEditor.getAttributes("link").href as string) ?? "";
      usableEditor.chain().extendMarkRange("link").run();
      const { from, to } = usableEditor.state.selection;
      const linkText = usableEditor.state.doc.textBetween(from, to, "");
      setLinkDialog({
        isEditing: true,
        initialUrl: href,
        initialText: linkText,
        linkRange: { from, to },
      });
    } else {
      setLinkDialog({
        isEditing: false,
        initialUrl: "",
        initialText: "",
        linkRange: null,
      });
    }
  }, [usableEditor]);

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

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const tools = toolsRef.current;
    if (!toolbar || !tools) return;

    const sync = () => {
      setCompactCopyButton(
        shouldCompactCopyButton(toolbar.clientWidth, tools.scrollWidth),
      );
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(toolbar);
    ro.observe(tools);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_LINK_DIALOG_EVENT, openLinkDialog);
    return () =>
      window.removeEventListener(OPEN_LINK_DIALOG_EVENT, openLinkDialog);
  }, [openLinkDialog]);

  useEffect(() => {
    const onImageShortcut = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "u") return;
      if (!usableEditor) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select") !== null
      ) {
        return;
      }
      event.preventDefault();
      imageInputRef.current?.click();
    };
    window.addEventListener("keydown", onImageShortcut);
    return () => window.removeEventListener("keydown", onImageShortcut);
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
    <div
      ref={toolbarRef}
      className="flex min-w-0 items-center gap-0.5 overflow-hidden border-b border-slate-200 bg-white px-2 py-1.5"
    >
      <div ref={toolsRef} className="flex shrink-0 items-center gap-0.5">
      <ToolbarButton
        title={SLACK_FORMAT.bold}
        active={usableEditor?.isActive("bold")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton
        title={SLACK_FORMAT.italic}
        active={usableEditor?.isActive("italic")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton
        title={SLACK_FORMAT.strikethrough}
        active={usableEditor?.isActive("strike")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={15} />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        title={SLACK_FORMAT.codeSnippet}
        active={usableEditor?.isActive("code")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleCode().run()}
      >
        <Code size={15} />
      </ToolbarButton>
      <ToolbarButton
        title={SLACK_FORMAT.codeBlock}
        active={usableEditor?.isActive("codeBlock")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleCodeBlock().run()}
      >
        <SquareCode size={15} />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        title={SLACK_FORMAT.bulletList}
        active={usableEditor?.isActive("bulletList")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton
        title={SLACK_FORMAT.numberedList}
        active={usableEditor?.isActive("orderedList")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton
        title={SLACK_FORMAT.blockQuote}
        active={usableEditor?.isActive("blockquote")}
        disabled={!usableEditor}
        onClick={() => usableEditor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </ToolbarButton>
      <Separator />
      <ToolbarButton
        title={SLACK_FORMAT.link}
        disabled={!usableEditor}
        active={usableEditor?.isActive("link")}
        onClick={openLinkDialog}
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
      <HoverTooltip label={SLACK_FORMAT.insertImage} placement="bottom">
        <label
          aria-label={SLACK_FORMAT.insertImage}
          className={cn(
            "h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 transition-colors",
            usableEditor
              ? "cursor-pointer hover:bg-slate-100 hover:text-slate-800"
              : "cursor-not-allowed opacity-40",
          )}
        >
          <ImageIcon size={15} />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            disabled={!usableEditor}
            className="sr-only"
            onChange={handleImageFileChange}
          />
        </label>
      </HoverTooltip>
      <Separator />
      <ToolbarButton
        title={SLACK_FORMAT.undo}
        disabled={!can?.undo()}
        onClick={() => usableEditor?.chain().focus().undo().run()}
      >
        <Undo2 size={15} />
      </ToolbarButton>
      <ToolbarButton
        title={SLACK_FORMAT.redo}
        disabled={!can?.redo()}
        onClick={() => usableEditor?.chain().focus().redo().run()}
      >
        <Redo2 size={15} />
      </ToolbarButton>
      </div>
      <div className="flex-1" />
      <HoverTooltip label={APP_SHORTCUTS.copyToSlack} placement="bottom">
        <button
          type="button"
          onClick={() => {
            if (isCopying) return;
            onCopy();
          }}
          aria-disabled={isCopying || undefined}
          aria-label={APP_SHORTCUTS.copyToSlack}
          aria-live="polite"
          className={cn(
            "inline-flex shrink-0 items-center rounded-lg text-xs font-medium shadow-sm transition-all duration-200",
            compactCopyButton ? "h-7 w-7 justify-center p-0" : "gap-1.5 px-3 py-1.5",
            copyFeedback === "copied" &&
              "bg-emerald-600 text-white hover:bg-emerald-600",
            copyFeedback === "error" &&
              "bg-red-600 text-white hover:bg-red-600",
            copyFeedback === "idle" &&
              "bg-slate-900 text-white hover:bg-slate-800",
            isCopying && "cursor-wait opacity-70",
          )}
        >
          {copyFeedback === "copied" ? (
            <Check size={13} className="shrink-0" />
          ) : (
            <Copy size={13} className="shrink-0" />
          )}
          {!compactCopyButton &&
            (isCopying
              ? "Copying…"
              : copyFeedback === "copied"
                ? "Copied!"
                : copyFeedback === "error"
                  ? "Copy failed"
                  : "Copy to Slack")}
        </button>
      </HoverTooltip>
    </div>
  );
}
