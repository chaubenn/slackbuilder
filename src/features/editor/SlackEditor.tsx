import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/react";
import { SlackImage } from "./extensions/SlackImage.tsx";
import { SlackLinkUnfurl } from "./extensions/SlackLinkUnfurl";

interface SlackEditorProps {
  document: JSONContent;
  onChange: (doc: JSONContent) => void;
  onReady?: (editor: Editor | null) => void;
}

const URL_REGEX = /^https?:\/\/\S+$/i;

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function openUrl(url: string) {
  if (IS_TAURI) {
    try {
      const { open } = await import("@tauri-apps/plugin-opener");
      await open(url);
      return;
    } catch {
      // fall through
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function SlackEditor({ document, onChange, onReady }: SlackEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const initialDocRef = useRef(document);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        codeBlock: {},
        heading: false,
        horizontalRule: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: "Write a Slack message…",
      }),
      SlackImage,
      SlackLinkUnfurl,
    ],
    content: initialDocRef.current,
    editorProps: {
      attributes: {
        class:
          "slack-message app-scrollbar prose-none focus:outline-none px-6 py-4 min-h-full",
      },
      handleDOMEvents: {
        // mousedown fires before WebKit can intercept Cmd+click on <a> elements.
        mousedown(_view, event) {
          if (!(event.ctrlKey || event.metaKey)) return false;
          const anchor = (event.target as HTMLElement).closest("a[href]");
          if (!anchor) return false;
          event.preventDefault();
          const href = anchor.getAttribute("href");
          if (href) void openUrl(href);
          return true;
        },
        // Prevent the browser/webview from navigating on a plain click so the
        // user can place their caret inside a hyperlink normally.
        click(_view, event) {
          const anchor = (event.target as HTMLElement).closest("a[href]");
          if (!anchor) return false;
          event.preventDefault();
          return false; // let ProseMirror move the caret
        },
      },
      handlePaste(_view, event) {
        const clipData = event.clipboardData;
        if (!clipData) return false;

        // 1. Clipboard image (e.g. from snipping tool / screenshots)
        const items = Array.from(clipData.items);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (imageItem) {
          const file = imageItem.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const src = String(reader.result ?? "");
              editor
                ?.chain()
                .focus()
                .insertSlackImage({ src, alt: "pasted image" })
                .run();
            };
            reader.readAsDataURL(file);
            event.preventDefault();
            return true;
          }
        }

        // 2. Plain-text URL → image or link-unfurl
        const text = clipData.getData("text/plain") ?? "";
        const trimmed = text.trim();
        if (trimmed && URL_REGEX.test(trimmed)) {
          insertLinkOrImage(editor, trimmed);
          event.preventDefault();
          return true;
        }

        return false;
      },
      handleDrop(_view, event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => {
              const src = String(reader.result ?? "");
              editor
                ?.chain()
                .focus()
                .insertSlackImage({ src, alt: file.name })
                .run();
            };
            reader.readAsDataURL(file);
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate({ editor: e }) {
      onChangeRef.current(e.getJSON());
    },
  });

  useEffect(() => {
    onReadyRef.current?.(editor ?? null);
    return () => {
      onReadyRef.current?.(null);
    };
  }, [editor]);

  // Keep editor in sync if the document is replaced externally (AI edit accept,
  // revert, hydrate). Compare JSON to avoid loops with onUpdate.
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(document);
    if (current !== incoming) {
      editor.commands.setContent(document, { emitUpdate: false });
    }
  }, [document, editor]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <EditorContent editor={editor} />
    </div>
  );
}

function insertLinkOrImage(editor: Editor | null, url: string) {
  if (!editor) return;
  if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)) {
    editor.chain().focus().insertSlackImage({ src: url, alt: "" }).run();
    return;
  }
  editor
    .chain()
    .focus()
    .insertSlackLinkUnfurl({
      url,
      title: url,
      description: "",
    })
    .run();
}
