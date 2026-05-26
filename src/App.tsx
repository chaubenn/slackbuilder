import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { SlackEditor } from "./features/editor/SlackEditor";
import { EditorToolbar } from "./features/editor/EditorToolbar";
import { AiChatPanel } from "./features/ai/AiChatPanel";
import { SettingsModal } from "./features/settings/SettingsModal";
import { useAppStore } from "./store/appStore";
import { hydrateStore, useAutosave } from "./store/persistence";
import { copyMessageToSlack } from "./features/copy/copyToSlack";
import { ResizableSplitPane } from "./components/ResizableSplitPane";
import { EditorTabs } from "./components/EditorTabs";

function App() {
  const document = useAppStore((s) => s.document);
  const setDocument = useAppStore((s) => s.setDocument);
  const hydrated = useAppStore((s) => s.hydrated);
  const aiPanelWidth = useAppStore((s) => s.ui.aiPanelWidth);
  const setAiPanelWidth = useAppStore((s) => s.setAiPanelWidth);

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
          ? "Copied to Slack clipboard ✓"
          : "Copied as mrkdwn (fallback) ✓",
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
      <div className="flex h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <header className="flex h-10 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          {/* Logo mark */}
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-600">
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 9 L6 3 L10 9"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            Slackbuilder
          </span>
        </div>
        <div className="h-3.5 w-px bg-slate-200" />
        <span className="text-xs text-slate-400">
          AI-powered Slack composer
        </span>
        {copyStatus && (
          <span className="ml-auto text-xs text-slate-500 transition-opacity">
            {copyStatus}
          </span>
        )}
      </header>

      <EditorTabs />

      <ResizableSplitPane
        widthPx={aiPanelWidth}
        onWidthChange={setAiPanelWidth}
        primary={
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
        }
        secondary={
          <AiChatPanel onOpenSettings={() => setSettingsOpen(true)} />
        }
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
