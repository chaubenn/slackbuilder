import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Paperclip,
  Square,
  Undo2,
  Redo2,
  Sparkles,
  Settings,
  Trash2,
} from "lucide-react";
import { useAppStore, filterSelectedEdits } from "../../store/appStore";
import { buildProvider } from "../../lib/ai/providers/openai";
import {
  SLACK_SYSTEM_PROMPT,
  buildContextMessage,
} from "../../lib/ai/systemPrompt";
import { parseAiResponse } from "../../lib/ai/parseEditResponse";
import { applyEdits } from "../../lib/ai/applyEdits";
import { tipTapToMrkdwn } from "../../lib/slack/tipTapToMrkdwn";
import { tipTapToBlocks } from "../../lib/slack/tipTapToBlocks";
import { PendingEditCard } from "./PendingEditCard";
import { isApplyCommand } from "./applyCommand";
import { cn } from "../../lib/utils";

interface AiChatPanelProps {
  onOpenSettings: () => void;
}

const QUICK_PROMPTS = [
  "make this sound like an incident update",
  "shorten this",
  "make it more technical",
  "turn into bug report",
  "add urgency but stay calm",
];

export function AiChatPanel({ onOpenSettings }: AiChatPanelProps) {
  const [input, setInput] = useState("");
  const chat = useAppStore((s) => s.chat);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const settings = useAppStore((s) => s.settings);
  const document = useAppStore((s) => s.document);
  const startStream = useAppStore((s) => s.startStream);
  const finishStream = useAppStore((s) => s.finishStream);
  const cancelStream = useAppStore((s) => s.cancelStream);
  const addChatMessages = useAppStore((s) => s.addChatMessages);
  const history = useAppStore((s) => s.history);
  const redoStack = useAppStore((s) => s.redoStack);
  const revertLastAiChange = useAppStore((s) => s.revertLastAiChange);
  const redoLastAiChange = useAppStore((s) => s.redoLastAiChange);
  const pendingResponse = useAppStore((s) => s.pendingResponse);
  const selected = useAppStore((s) => s.pendingSelectedEditIds);
  const acceptEdits = useAppStore((s) => s.acceptEdits);
  const clearChat = useAppStore((s) => s.clearChat);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [chat, isStreaming, pendingResponse]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const refs = files.map((file) => `@${file.name}`).join(" ");
    setInput((current) => (current ? `${current} ${refs}` : refs));
    event.target.value = "";
    textareaRef.current?.focus();
  };

  const inputText = input.trim();
  const canApplyPending =
    Boolean(pendingResponse?.edits.length) && isApplyCommand(inputText);
  const canClearChat = chat.length > 0 || Boolean(pendingResponse);
  const canSend =
    !isStreaming && inputText.length > 0 && (Boolean(settings.apiKey) || canApplyPending);

  const handleSend = async () => {
    if (!canSend) return;
    const userMessage = inputText;
    setInput("");

    if (pendingResponse?.edits.length && isApplyCommand(userMessage)) {
      const editsToApply = filterSelectedEdits(pendingResponse, selected);
      if (editsToApply.length === 0) {
        addChatMessages([
          { role: "user", content: userMessage },
          { role: "assistant", content: "No edits are selected to apply." },
        ]);
        return;
      }

      const result = applyEdits(document, editsToApply, {
        fullRewrite:
          pendingResponse.optionalFullRewrite &&
          editsToApply.length === pendingResponse.edits.length
            ? pendingResponse.optionalFullRewrite
            : undefined,
      });
      acceptEdits({ document: result.document, editIds: result.appliedEditIds });
      addChatMessages([
        { role: "user", content: userMessage },
        {
          role: "assistant",
          content: `Applied ${result.appliedEditIds.length} edit${
            result.appliedEditIds.length === 1 ? "" : "s"
          }.`,
        },
      ]);
      return;
    }

    const priorChat = chat;
    const controller = new AbortController();
    startStream(controller, userMessage);

    const provider = buildProvider(settings);
    const mrkdwn = tipTapToMrkdwn(document);
    const blocks = tipTapToBlocks(document);
    const contextMsg = buildContextMessage({ mrkdwn, blocks });

    const historyMessages = priorChat
      .filter(
        (msg) =>
          (msg.role === "user" || msg.role === "assistant") &&
          msg.content.trim().length > 0,
      )
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    const apiMessages = [
      { role: "system" as const, content: SLACK_SYSTEM_PROMPT },
      ...historyMessages,
      { role: "system" as const, content: contextMsg },
      { role: "user" as const, content: userMessage },
    ];

    try {
      const full = await provider.streamChat(apiMessages, {
        signal: controller.signal,
      });
      const parsed = parseAiResponse(full);
      finishStream(parsed);
    } catch (err) {
      if (controller.signal.aborted) {
        finishStream({
          assistantMessage: "(cancelled)",
          edits: [],
        });
      } else {
        finishStream({
          assistantMessage: `Error: ${(err as Error).message}`,
          edits: [],
        });
      }
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <Sparkles size={14} className="text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-800">AI Assistant</h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={clearChat}
            disabled={!canClearChat}
            title="Clear active chat"
            className={cn(
              "rounded p-1 text-slate-500 hover:bg-slate-100",
              !canClearChat && "cursor-not-allowed opacity-40",
            )}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={revertLastAiChange}
            disabled={history.length === 0}
            title="Revert last accepted AI edit"
            className={cn(
              "rounded p-1 text-slate-500 hover:bg-slate-100",
              history.length === 0 && "cursor-not-allowed opacity-40",
            )}
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={redoLastAiChange}
            disabled={redoStack.length === 0}
            title="Redo last reverted AI edit"
            className={cn(
              "rounded p-1 text-slate-500 hover:bg-slate-100",
              redoStack.length === 0 && "cursor-not-allowed opacity-40",
            )}
          >
            <Redo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto app-scrollbar p-3 space-y-3"
      >
        {chat.length === 0 && !pendingResponse && (
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-600">
            <p className="mb-2 font-medium text-slate-800">
              Ask the AI to refine your Slack message.
            </p>
            <ul className="space-y-1">
              {QUICK_PROMPTS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => setInput(p)}
                    className="text-left text-slate-600 hover:text-emerald-700 hover:underline"
                  >
                    “{p}”
                  </button>
                </li>
              ))}
            </ul>
            {!settings.apiKey && (
              <p className="mt-3 rounded bg-amber-50 p-2 text-amber-800">
                Add an API key in Settings to enable AI editing.
              </p>
            )}
          </div>
        )}

        {chat.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "text-sm",
              msg.role === "user" ? "text-right" : "text-left",
            )}
          >
            <div
              className={cn(
                "inline-block max-w-[92%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-left",
                msg.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-800 shadow-sm",
              )}
            >
              {msg.content || (
                <span className="text-slate-400">…</span>
              )}
              {msg.role === "assistant" && msg.pendingEditCount ? (
                <div className="mt-1 text-xs text-slate-500">
                  {msg.pendingEditCount} edit
                  {msg.pendingEditCount === 1 ? "" : "s"} proposed
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <PendingEditCard />

      <div className="border-t border-slate-200 bg-slate-50 px-3 py-3">
        <div className="rounded-2xl border border-slate-300 bg-white shadow-sm transition focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-300/60">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Plan, search, build anything (Shift+Enter for newline)"
            rows={1}
            className="block w-full resize-none rounded-t-2xl bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between px-2 pb-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleAttachClick}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Attach file"
              aria-label="Attach file"
            >
              <Paperclip size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelected}
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={cancelStream}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800"
                title="Stop"
                aria-label="Stop"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full transition",
                  canSend
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "cursor-not-allowed bg-slate-200 text-slate-400",
                )}
                title="Send (Enter, Shift+Enter for newline)"
                aria-label="Send"
              >
                <ArrowUp size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

