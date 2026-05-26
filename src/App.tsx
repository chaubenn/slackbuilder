import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { SlackEditor } from "./features/editor/SlackEditor";
import { EditorToolbar } from "./features/editor/EditorToolbar";
import { AiChatPanel } from "./features/ai/AiChatPanel";
import { SettingsModal } from "./features/settings/SettingsModal";
import { useAppStore } from "./store/appStore";
import { hydrateStore, useAutosave } from "./store/persistence";
import { copyMessageToSlack } from "./features/copy/copyToSlack";

function App() {
  const document = useAppStore((s) => s.document);
  const setDocument = useAppStore((s) => s.setDocument);
  const hydrated = useAppStore((s) => s.hydrated);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const statusTimer = useRef<number | null>(null);

  useEffect(() => {
    hydrateStore();
  }, []);

  useAutosave(1200);

  const showStatus = (msg: string) => {
    setCopyStatus(msg);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setCopyStatus(null), 2500);
  };

  const handleCopy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const result = await copyMessageToSlack(document);
      showStatus(
        result.usedNative
          ? "Copied to Slack-native clipboard. Paste into Slack."
          : "Copied as plain mrkdwn (fallback).",
      );
    } catch (err) {
      showStatus(`Copy failed: ${(err as Error).message}`);
    } finally {
      setCopying(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-emerald-600" />
          <h1 className="text-sm font-semibold text-slate-900">Slackbuilder</h1>
        </div>
        <span className="text-xs text-slate-400">
          Slack message composer with AI
        </span>
        {copyStatus && (
          <span className="ml-auto text-xs text-emerald-700">{copyStatus}</span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 flex-1 flex-col bg-white">
          <EditorToolbar
            editor={editor}
            onCopy={handleCopy}
            isCopying={copying}
          />
          <SlackEditor
            document={document}
            onChange={setDocument}
            onReady={setEditor}
          />
        </main>
        <aside className="w-[380px] min-w-[320px] max-w-[480px] flex-shrink-0">
          <AiChatPanel onOpenSettings={() => setSettingsOpen(true)} />
        </aside>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
