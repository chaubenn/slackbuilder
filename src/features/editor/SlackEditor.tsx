import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/react";
import { SlackImage } from "./extensions/SlackImage";
import { SlackLinkUnfurl } from "./extensions/SlackLinkUnfurl";

interface SlackEditorProps {
  document: JSONContent;
  onChange: (doc: JSONContent) => void;
  onReady?: (editor: Editor | null) => void;
}

const URL_REGEX = /^https?:\/\/\S+$/i;

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
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData("text/plain") ?? "";
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
              editor?.chain().focus().insertSlackImage({ src, alt: file.name }).run();
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
    onCreate({ editor: e }) {
      onReadyRef.current?.(e);
    },
    onDestroy() {
      onReadyRef.current?.(null);
    },
  });

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
    <div className="flex-1 min-h-0 overflow-y-auto bg-white">
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
