import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  Image as ImageIcon,
  Square,
  Undo2,
  Redo2,
  Sparkles,
  Settings,
  Trash2,
  X,
  Download,
  Eye,
  Brain,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  useAppStore,
  filterSelectedEdits,
  getActiveConversationFromState,
} from "../../store/appStore";
import { buildProvider } from "../../lib/ai/providers/openai";
import {
  SLACK_SYSTEM_PROMPT,
  buildContextMessage,
} from "../../lib/ai/systemPrompt";
import { parseAiResponse } from "../../lib/ai/parseEditResponse";
import { applyEdits } from "../../lib/ai/applyEdits";
import { tipTapToMrkdwn } from "../../lib/slack/tipTapToMrkdwn";
import { tipTapToBlocks } from "../../lib/slack/tipTapToBlocks";
import { mrkdwnToTipTap } from "../../lib/slack/mrkdwnToTipTap";
import { PendingEditCard } from "./PendingEditCard";
import { isApplyCommand } from "./applyCommand";
import { cn } from "../../lib/utils";
import {
  getModelCapabilities,
  PROVIDER_MODEL_PRESETS,
} from "../../lib/ai/types";
import type { ContentPart } from "../../lib/ai/types";

interface AiChatPanelProps {
  onOpenSettings: () => void;
}

interface AttachedImage {
  id: string;
  dataUrl: string;
  mimeType: string;
  base64Data: string;
}

const QUICK_PROMPTS = [
  "make this sound like an incident update",
  "shorten this",
  "make it more technical",
  "turn into bug report",
  "add urgency but stay calm",
];

// ---------------------------------------------------------------------------
// Model selector popover
// ---------------------------------------------------------------------------
interface ModelSelectorProps {
  model: string;
  provider: import("../../lib/ai/types").AiProviderId;
  onSelect: (model: string) => void;
}

function ModelSelector({ model, provider, onSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const presets = PROVIDER_MODEL_PRESETS[provider] ?? [];
  const caps = getModelCapabilities(model);
  const shortName = model.split("/").pop() ?? model;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors select-none"
        title="Select model"
      >
        <span className="max-w-[90px] truncate">{shortName}</span>
        {caps.vision && (
          <span title="Vision">
            <Eye size={9} className="shrink-0 text-blue-400" />
          </span>
        )}
        {caps.reasoning && (
          <span title="Reasoning">
            <Brain size={9} className="shrink-0 text-violet-400" />
          </span>
        )}
        <ChevronDown size={9} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-xl">
          <p className="px-3 py-1 text-[10px] text-slate-400 uppercase tracking-wide">
            Quick pick
          </p>
          {presets.map((preset) => {
            const pc = getModelCapabilities(preset.id);
            const isActive = preset.id === model;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onSelect(preset.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50",
                  isActive && "text-violet-700",
                )}
              >
                {isActive ? (
                  <Check size={10} className="shrink-0 text-violet-500" />
                ) : (
                  <span className="w-2.5 shrink-0" />
                )}
                <span className="flex-1 truncate">{preset.label}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  {pc.vision && <Eye size={9} className="text-blue-400" />}
                  {pc.reasoning && <Brain size={9} className="text-violet-400" />}
                </span>
              </button>
            );
          })}
          <div className="mx-3 my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="block w-full px-3 py-1.5 text-left text-slate-400 hover:bg-slate-50"
          >
            Edit in Settings…
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function AiChatPanel({ onOpenSettings }: AiChatPanelProps) {
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  const chat = useAppStore((s) => s.chat);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const settings = useAppStore((s) => s.settings);
  const document = useAppStore((s) => s.document);
  const startStream = useAppStore((s) => s.startStream);
  const finishStream = useAppStore((s) => s.finishStream);
  const cancelStream = useAppStore((s) => s.cancelStream);
  const appendAssistantToken = useAppStore((s) => s.appendAssistantToken);
  const addChatMessages = useAppStore((s) => s.addChatMessages);
  const history = useAppStore((s) => s.history);
  const redoStack = useAppStore((s) => s.redoStack);
  const revertLastAiChange = useAppStore((s) => s.revertLastAiChange);
  const redoLastAiChange = useAppStore((s) => s.redoLastAiChange);
  const pendingResponse = useAppStore((s) => s.pendingResponse);
  const selected = useAppStore((s) => s.pendingSelectedEditIds);
  const acceptEdits = useAppStore((s) => s.acceptEdits);
  const clearChat = useAppStore((s) => s.clearChat);
  const setSettings = useAppStore((s) => s.setSettings);
  const setPromptDraft = useAppStore((s) => s.setPromptDraft);

  // Per-tab prompt draft -------------------------------------------------------
  // Read the active conversation ID and its saved draft so we can restore it
  // whenever the user switches tabs.
  const activeConversationId = useAppStore(
    (s) =>
      (s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0])
        ?.activeConversationId ?? "",
  );
  const savedDraft = useAppStore(
    (s) => getActiveConversationFromState(s)?.promptDraft ?? "",
  );

  // Keep a ref so the tab-switch effect always sees the latest saved draft
  // without triggering on every keystroke.
  const savedDraftRef = useRef(savedDraft);
  savedDraftRef.current = savedDraft;

  useEffect(() => {
    // Restore the draft for the newly active tab
    setInput(savedDraftRef.current);
    setAttachedImages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // ---------------------------------------------------------------------------

  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [chat, isStreaming, pendingResponse]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Auto-focus when a new tab is created
  useEffect(() => {
    const handler = () => {
      setTimeout(() => textareaRef.current?.focus(), 30);
    };
    window.addEventListener("slackbuilder:focus-prompt", handler);
    return () => window.removeEventListener("slackbuilder:focus-prompt", handler);
  }, []);

  // Model capabilities
  const caps = getModelCapabilities(settings.model);

  // Image paste handler (textarea)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      e.preventDefault();
      imageItems.forEach((item) => {
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const commaIdx = dataUrl.indexOf(",");
          const base64Data = dataUrl.slice(commaIdx + 1);
          setAttachedImages((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).slice(2),
              dataUrl,
              mimeType: file.type,
              base64Data,
            },
          ]);
        };
        reader.readAsDataURL(file);
      });
    },
    [],
  );

  const removeImage = (id: string) =>
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    setPromptDraft(val);
  };

  const inputText = input.trim();
  const canApplyPending =
    Boolean(pendingResponse?.edits.length) && isApplyCommand(inputText);
  const canClearChat = chat.length > 0 || Boolean(pendingResponse);

  // If the model doesn't support vision, disallow image attachment
  const visionBlocked = attachedImages.length > 0 && !caps.vision;

  const canSend =
    !isStreaming &&
    !visionBlocked &&
    (inputText.length > 0 || attachedImages.length > 0) &&
    (Boolean(settings.apiKey) || canApplyPending);

  const handleSend = async () => {
    if (!canSend) return;
    const userMessage = inputText;
    const imageSnapshot = attachedImages;
    setInput("");
    setPromptDraft("");
    setAttachedImages([]);

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

    const { activeProjectId: projectId, projects } = useAppStore.getState();
    const project = projects.find((item) => item.id === projectId);
    const conversationId = project?.activeConversationId;
    if (!conversationId) return;

    const priorChat = chat;
    const documentAtSend = document;
    const controller = new AbortController();

    startStream(
      projectId,
      conversationId,
      controller,
      userMessage || "(image)",
      imageSnapshot.length || undefined,
    );

    // Token-by-token streaming callback
    const onToken = (token: string) =>
      appendAssistantToken(projectId, conversationId, token);

    const provider = buildProvider(settings);
    const mrkdwn = tipTapToMrkdwn(documentAtSend);
    const blocks = tipTapToBlocks(documentAtSend);
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

    const userContent: string | ContentPart[] =
      imageSnapshot.length > 0
        ? [
            ...(userMessage
              ? [{ type: "text" as const, text: userMessage }]
              : []),
            ...imageSnapshot.map((img) => ({
              type: "image" as const,
              mimeType: img.mimeType,
              data: img.base64Data,
            })),
          ]
        : userMessage;

    const apiMessages: {
      role: "system" | "user" | "assistant";
      content: string | ContentPart[];
    }[] = [
      { role: "system" as const, content: SLACK_SYSTEM_PROMPT },
      ...historyMessages,
      { role: "system" as const, content: contextMsg },
      { role: "user" as const, content: userContent },
    ];

    try {
      const full = await provider.streamChat(apiMessages, {
        signal: controller.signal,
        onToken,
      });
      const parsed = parseAiResponse(full);
      finishStream(projectId, conversationId, parsed);
    } catch (err) {
      if (controller.signal.aborted) {
        finishStream(projectId, conversationId, {
          assistantMessage: "(cancelled)",
          edits: [],
        });
      } else {
        finishStream(projectId, conversationId, {
          assistantMessage: `Error: ${(err as Error).message}`,
          edits: [],
        });
      }
    }
  };

  const handleApplyMessageToEditor = (content: string) => {
    try {
      const newDoc = mrkdwnToTipTap(content);
      acceptEdits({ document: newDoc, editIds: [] });
    } catch {
      acceptEdits({
        document: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: content }] },
          ],
        },
        editIds: [],
      });
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <Sparkles size={14} className="text-violet-500" />
        <h2 className="text-sm font-semibold text-slate-800">AI Assistant</h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={clearChat}
            disabled={!canClearChat}
            title="Clear active chat"
            className={cn(
              "rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700",
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
              "rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700",
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
              "rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700",
              redoStack.length === 0 && "cursor-not-allowed opacity-40",
            )}
          >
            <Redo2 size={14} />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto app-scrollbar p-3 space-y-3"
      >
        {chat.length === 0 && !pendingResponse && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
            <p className="mb-3 font-medium text-slate-800">
              Ask the AI to refine your Slack message.
            </p>
            <ul className="space-y-1.5">
              {QUICK_PROMPTS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(p);
                      setPromptDraft(p);
                      textareaRef.current?.focus();
                    }}
                    className="text-left text-slate-500 hover:text-violet-600 hover:underline transition-colors"
                  >
                    &ldquo;{p}&rdquo;
                  </button>
                </li>
              ))}
            </ul>
            {!settings.apiKey && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-amber-800">
                Add an API key in{" "}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="font-medium underline hover:text-amber-900"
                >
                  Settings
                </button>{" "}
                to enable AI editing.
              </p>
            )}
            {caps.vision ? (
              <p className="mt-3 text-slate-400">
                Tip: paste or drag an image to use vision.
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-2 text-slate-400">
                <Eye size={10} className="inline mr-1" />
                Current model doesn&apos;t support images. Switch to a vision
                model (e.g. GPT-4o) to use image inputs.
              </p>
            )}
          </div>
        )}

        {chat.map((msg, idx) => {
          const isLast = idx === chat.length - 1;
          return (
            <div
              key={msg.id}
              className={cn(
                "text-sm",
                msg.role === "user" ? "text-right" : "text-left",
              )}
            >
              <div
                className={cn(
                  "inline-block max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-left leading-relaxed",
                  msg.role === "user"
                    ? "bg-violet-600 text-white"
                    : "bg-white text-slate-800 shadow-sm ring-1 ring-slate-100",
                )}
              >
                {msg.content || (
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                )}
                {msg.role === "user" && (msg.imageCount ?? 0) > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-violet-200">
                    <ImageIcon size={11} />
                    <span>
                      {msg.imageCount} image{msg.imageCount === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                {msg.role === "assistant" && msg.pendingEditCount ? (
                  <div className="mt-1 text-xs text-slate-400">
                    {msg.pendingEditCount} edit
                    {msg.pendingEditCount === 1 ? "" : "s"} proposed
                  </div>
                ) : null}
              </div>

              {msg.role === "assistant" &&
                isLast &&
                !pendingResponse &&
                !isStreaming &&
                msg.content.trim().length > 30 && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyMessageToEditor(msg.content)}
                      title="Parse this response as mrkdwn and apply it directly to the editor"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-violet-600 transition-colors"
                    >
                      <Download size={11} />
                      Apply to editor
                    </button>
                  </div>
                )}
            </div>
          );
        })}
      </div>

      <PendingEditCard />

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white px-3 py-3">
        {/* Vision-not-supported warning */}
        {attachedImages.length > 0 && !caps.vision && (
          <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
            <Eye size={11} />
            <span>
              <strong>{settings.model}</strong> doesn&apos;t support images.
              Switch to a vision model in the model selector below.
            </span>
          </div>
        )}

        {/* Attached image previews */}
        {attachedImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedImages.map((img) => (
              <div
                key={img.id}
                className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                <img
                  src={img.dataUrl}
                  alt="Attached"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-slate-900/70 text-white group-hover:flex"
                  aria-label="Remove image"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Rainbow prompt box */}
        <div className="rainbow-border-wrapper">
          <div className="rainbow-border-inner">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onPaste={handlePaste}
              placeholder={
                attachedImages.length > 0
                  ? "Add a message or send image…"
                  : "Ask the AI anything…"
              }
              rows={1}
              className="block w-full resize-none bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
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
              {/* Model selector */}
              <ModelSelector
                model={settings.model}
                provider={settings.provider}
                onSelect={(m) => setSettings({ model: m })}
              />

              {/* Image attach button (only if vision supported) */}
              {caps.vision && (
                <button
                  type="button"
                  onClick={() => {
                    const input = window.document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        const base64Data = dataUrl.slice(dataUrl.indexOf(",") + 1);
                        setAttachedImages((prev) => [
                          ...prev,
                          {
                            id: Math.random().toString(36).slice(2),
                            dataUrl,
                            mimeType: file.type,
                            base64Data,
                          },
                        ]);
                      };
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                  className="rounded p-0.5 text-slate-300 hover:text-slate-500 transition-colors"
                  title="Attach image"
                >
                  <ImageIcon size={13} />
                </button>
              )}

              {/* Shift+Enter hint */}
              <div className="flex-1 text-right text-[10px] text-slate-400 pr-1 select-none">
                {caps.vision
                  ? "Shift+Enter newline · paste image"
                  : "Shift+Enter for newline"}
              </div>

              {/* Send / stop */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={cancelStream}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
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
                    "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    canSend
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : "cursor-not-allowed bg-slate-200 text-slate-400",
                  )}
                  title="Send (Enter)"
                  aria-label="Send"
                >
                  <ArrowUp size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
