import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  Eye,
  Brain,
  Globe,
  MessageCircle,
  PencilLine,
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
  getSystemPrompt,
  buildContextMessage,
} from "../../lib/ai/systemPrompt";
import { parseAiResponse, parseAskResponse } from "../../lib/ai/parseEditResponse";
import { normalizeEditPositions } from "../../lib/ai/editPosition";
import { shouldUseOptionalFullRewrite } from "../../lib/ai/applyEditsHelpers";
import { applyEdits } from "../../lib/ai/applyEdits";
import { tipTapToMrkdwn } from "../../lib/slack/tipTapToMrkdwn";
import { tipTapToBlocks } from "../../lib/slack/tipTapToBlocks";
import { PendingEditCard } from "./PendingEditCard";
import { ChatMarkdown } from "./chatMarkdown";
import { isApplyCommand } from "./applyCommand";
import { cn } from "../../lib/utils";
import {
  getModelCapabilities,
  providerSupportsWebSearch,
  PROVIDERS,
  PROVIDER_MODEL_PRESETS,
} from "../../lib/ai/types";
import type {
  AiProviderId,
  AiProviderSettings,
  ContentPart,
} from "../../lib/ai/types";

interface AiChatPanelProps {
  onOpenSettings: () => void;
}

interface AttachedImage {
  id: string;
  dataUrl: string;
  mimeType: string;
  base64Data: string;
}

const EDIT_QUICK_PROMPTS = [
  "make this sound like an incident update",
  "shorten this",
  "make it more technical",
  "turn into bug report",
  "add urgency but stay calm",
];

const ASK_QUICK_PROMPTS = [
  "summarize this message",
  "what tone does this convey?",
  "are there any issues with this draft?",
  "explain the code in this message",
];

const VISION_TOOLTIP = "Vision-capable — can analyse images";
const REASONING_TOOLTIP = "Reasoning — extended thinking capabilities";
const WEB_SEARCH_TOOLTIP =
  "Web search — model can look up current information on the web";

function HoverTooltip({
  label,
  placement = "top",
  multiline = false,
  className,
  children,
}: {
  label: string;
  placement?: "left" | "top";
  multiline?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const showTip = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (placement === "top") {
      setTipPos({ x: rect.left + rect.width / 2, y: rect.top - 6 });
      return;
    }
    setTipPos({ x: rect.left - 6, y: rect.top + rect.height / 2 });
  };

  return (
    <>
      <span
        className={cn("relative inline-flex shrink-0", className)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={(e) => showTip(e.currentTarget)}
        onMouseLeave={() => setTipPos(null)}
        onFocus={(e) => showTip(e.currentTarget)}
        onBlur={() => setTipPos(null)}
      >
        {children}
      </span>
      {tipPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: tipPos.x,
              top: tipPos.y,
              transform:
                placement === "top"
                  ? "translate(-50%, -100%)"
                  : "translate(-100%, -50%)",
            }}
            className={cn(
              "pointer-events-none z-[1002] rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal leading-tight text-white shadow-md",
              multiline
                ? "max-w-[220px] whitespace-normal text-center"
                : "whitespace-nowrap",
            )}
            role="tooltip"
          >
            {label}
          </div>,
          window.document.body,
        )}
    </>
  );
}

function CapabilityIcon({
  icon: Icon,
  label,
  className,
  tooltipPlacement = "left",
}: {
  icon: typeof Eye;
  label: string;
  className?: string;
  tooltipPlacement?: "left" | "top";
}) {
  return (
    <HoverTooltip
      label={label}
      placement={tooltipPlacement}
      className="cursor-default p-0.5"
    >
      <Icon
        size={9}
        className={className}
        tabIndex={0}
        aria-label={label}
      />
    </HoverTooltip>
  );
}

// ---------------------------------------------------------------------------
// Model selector popover
// ---------------------------------------------------------------------------
interface ModelSelectorProps {
  model: string;
  provider: AiProviderId;
  onSelect: (provider: AiProviderId, model: string) => void;
  onOpenSettings: () => void;
}

function ModelSelector({
  model,
  provider,
  onSelect,
  onOpenSettings,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; bottom: number } | null>(
    null,
  );
  const caps = getModelCapabilities(model);
  const shortName = model.split("/").pop() ?? model;

  // Build a flat grouped list of every preset model across providers so the
  // user can switch provider+model in one click without going to Settings.
  const grouped = useMemo(
    () =>
      (Object.keys(PROVIDERS) as AiProviderId[]).map((pid) => ({
        provider: pid,
        label: PROVIDERS[pid].label,
        presets: PROVIDER_MODEL_PRESETS[pid] ?? [],
      })),
    [],
  );

  // Position the portal popover above the trigger button. We re-measure on
  // open + on viewport changes so it stays anchored even if the user resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 6,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const modelTooltip = `${PROVIDERS[provider].label} · ${model}`;

  return (
    <>
      <HoverTooltip label={modelTooltip} placement="top">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors select-none"
        >
          <span className="max-w-[120px] truncate">{shortName}</span>
        {caps.vision && (
          <CapabilityIcon
            icon={Eye}
            label={VISION_TOOLTIP}
            className="shrink-0 text-blue-400"
            tooltipPlacement="top"
          />
        )}
        {caps.reasoning && (
          <CapabilityIcon
            icon={Brain}
            label={REASONING_TOOLTIP}
            className="shrink-0 text-violet-400"
            tooltipPlacement="top"
          />
        )}
        {caps.webSearch && (
          <CapabilityIcon
            icon={Globe}
            label={WEB_SEARCH_TOOLTIP}
            className="shrink-0 text-emerald-500"
            tooltipPlacement="top"
          />
        )}
          <ChevronDown size={9} className="shrink-0" />
        </button>
      </HoverTooltip>

      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              left: coords.left,
              bottom: coords.bottom,
            }}
            className="z-[1000] flex w-60 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-xs shadow-xl"
          >
            <div className="max-h-[320px] overflow-y-auto overflow-x-visible app-scrollbar py-1">
            {grouped.map((group, gi) => (
              <div key={group.provider}>
                {gi > 0 && <div className="my-1 border-t border-slate-100" />}
                <p className="px-3 py-1 text-[10px] text-slate-400 uppercase tracking-wide">
                  {group.label}
                </p>
                {group.presets.map((preset) => {
                  const pc = getModelCapabilities(preset.id);
                  const isActive =
                    preset.id === model && group.provider === provider;
                  return (
                    <button
                      key={`${group.provider}:${preset.id}`}
                      type="button"
                      onClick={() => {
                        onSelect(group.provider, preset.id);
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
                        {pc.vision && (
                          <CapabilityIcon
                            icon={Eye}
                            label={VISION_TOOLTIP}
                            className="text-blue-400"
                          />
                        )}
                        {pc.reasoning && (
                          <CapabilityIcon
                            icon={Brain}
                            label={REASONING_TOOLTIP}
                            className="text-violet-400"
                          />
                        )}
                        {pc.webSearch && (
                          <CapabilityIcon
                            icon={Globe}
                            label={WEB_SEARCH_TOOLTIP}
                            className="text-emerald-500"
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            </div>
            <div className="mx-3 flex items-center gap-3 border-t border-slate-100 py-1.5 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Eye size={9} className="text-blue-400" />
                Vision
              </span>
              <span className="inline-flex items-center gap-1">
                <Brain size={9} className="text-violet-400" />
                Reasoning
              </span>
              <span className="inline-flex items-center gap-1">
                <Globe size={9} className="text-emerald-500" />
                Web search
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-500 hover:bg-slate-50 hover:text-violet-600"
            >
              <Settings size={10} className="shrink-0" />
              <span>API keys…</span>
            </button>
          </div>,
          window.document.body,
        )}
    </>
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
  const webSearchAvailable = providerSupportsWebSearch(settings.provider);
  const webSearchOn = Boolean(settings.webSearchEnabled);
  const chatMode = settings.chatMode ?? "edit";
  const isAskMode = chatMode === "ask";

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

  // Atomic provider + model switch from the inline selector. When switching
  // providers we also reset the base URL to the new provider's default so
  // requests don't hit the wrong endpoint.
  const handleSelectModel = (
    nextProvider: AiProviderId,
    nextModel: string,
  ) => {
    const patch: Partial<AiProviderSettings> = { model: nextModel };
    if (nextProvider !== settings.provider) {
      patch.provider = nextProvider;
      patch.baseUrl = PROVIDERS[nextProvider].defaultBaseUrl;
    }
    setSettings(patch);
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

  const sendTooltip = useMemo(() => {
    if (canSend) return "Send message (Enter)";
    if (visionBlocked) {
      return "Remove images or switch to a vision-capable model";
    }
    if (!settings.apiKey && !canApplyPending) {
      return "Add an API key in Settings to send";
    }
    if (inputText.length === 0 && attachedImages.length === 0) {
      return "Type a message to send";
    }
    return "Send message (Enter)";
  }, [
    canSend,
    visionBlocked,
    settings.apiKey,
    canApplyPending,
    inputText.length,
    attachedImages.length,
  ]);

  const footerHintTooltip = useMemo(() => {
    if (isAskMode && webSearchOn) {
      return "Ask mode: chat only, no editor edits. Web search is on.";
    }
    if (isAskMode) {
      return "Ask mode: questions and summaries without changing your message";
    }
    if (webSearchOn) {
      return "Web search enabled — model may look up current information";
    }
    if (caps.vision) {
      return "Shift+Enter for a new line · paste or attach images";
    }
    return "Shift+Enter for a new line";
  }, [isAskMode, webSearchOn, caps.vision]);

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
        fullRewrite: shouldUseOptionalFullRewrite(
          pendingResponse.optionalFullRewrite,
          editsToApply,
          pendingResponse.edits.length,
        )
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
      { role: "system" as const, content: getSystemPrompt(chatMode) },
      ...historyMessages,
      { role: "system" as const, content: contextMsg },
      { role: "user" as const, content: userContent },
    ];

    try {
      const full = await provider.streamChat(apiMessages, {
        signal: controller.signal,
        onToken,
        webSearch: webSearchOn,
        askMode: isAskMode,
      });
      const parsed = isAskMode
        ? parseAskResponse(full)
        : parseAiResponse(full);
      const response = isAskMode
        ? parsed
        : {
            ...parsed,
            edits: normalizeEditPositions(mrkdwn, parsed.edits, {
              userMessage,
            }),
          };
      finishStream(projectId, conversationId, response);
    } catch (err) {
      if (controller.signal.aborted) {
        const state = useAppStore.getState();
        const restored = state.isStreaming
          ? state.cancelStream()
          : (getActiveConversationFromState(state)?.promptDraft ?? "");
        setInput(restored);
        setPromptDraft(restored);
        setTimeout(() => textareaRef.current?.focus(), 0);
      } else {
        finishStream(projectId, conversationId, {
          assistantMessage: `Error: ${(err as Error).message}`,
          edits: [],
        });
      }
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
              {isAskMode
                ? "Ask questions about your Slack message."
                : "Ask the AI to refine your Slack message."}
            </p>
            <ul className="space-y-1.5">
              {(isAskMode ? ASK_QUICK_PROMPTS : EDIT_QUICK_PROMPTS).map((p) => (
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
          // While the stream is in flight, the last assistant message is being
          // filled with raw JSON tokens. Suppress that internal stream and
          // show a friendly placeholder; the parsed assistant message and
          // structured edits replace it the moment finishStream fires.
          const isStreamingThisMessage =
            msg.role === "assistant" && isLast && isStreaming;
          const showStreamedText = isStreamingThisMessage && isAskMode;
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
                  "inline-block max-w-[92%] break-words rounded-2xl px-3.5 py-2.5 text-left leading-relaxed",
                  msg.role === "user"
                    ? "whitespace-pre-wrap bg-violet-600 text-white"
                    : "bg-white text-slate-800 shadow-sm ring-1 ring-slate-100",
                )}
              >
                {isStreamingThisMessage && !showStreamedText ? (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Sparkles size={12} className="text-violet-500" />
                    <span>Making changes</span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                      <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                    </span>
                  </span>
                ) : msg.content ? (
                  msg.role === "assistant" ? (
                    <ChatMarkdown text={msg.content} />
                  ) : (
                    msg.content
                  )
                ) : (
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
                {msg.role === "assistant" &&
                !isStreamingThisMessage &&
                msg.pendingEditCount ? (
                  <div className="mt-1 text-xs text-slate-400">
                    {msg.pendingEditCount} edit
                    {msg.pendingEditCount === 1 ? "" : "s"} proposed
                  </div>
                ) : null}
              </div>
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
                  : isAskMode
                    ? "Ask about your message…"
                    : "Ask the AI to edit your message…"
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
            <div className="flex items-center gap-2 px-2 pb-1.5 pt-0.5">
              <div
                className="flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 p-0.5"
                role="group"
                aria-label="Chat mode"
              >
                <HoverTooltip
                  label="Edit mode — propose changes to your Slack message"
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={() => setSettings({ chatMode: "edit" })}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors",
                      !isAskMode
                        ? "bg-white text-violet-700 shadow-sm"
                        : "text-slate-400 hover:text-slate-600",
                    )}
                    aria-label="Edit mode"
                    aria-pressed={!isAskMode}
                  >
                    <PencilLine size={12} aria-hidden />
                  </button>
                </HoverTooltip>
                <HoverTooltip
                  label="Ask mode — chat without editing your message"
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={() => setSettings({ chatMode: "ask" })}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors",
                      isAskMode
                        ? "bg-white text-violet-700 shadow-sm"
                        : "text-slate-400 hover:text-slate-600",
                    )}
                    aria-label="Ask mode"
                    aria-pressed={isAskMode}
                  >
                    <MessageCircle size={12} aria-hidden />
                  </button>
                </HoverTooltip>
              </div>

              <ModelSelector
                model={settings.model}
                provider={settings.provider}
                onSelect={handleSelectModel}
                onOpenSettings={onOpenSettings}
              />

              {webSearchAvailable && (
                <HoverTooltip
                  label={
                    webSearchOn
                      ? "Web search on — click to disable"
                      : "Web search off — click to look up current information"
                  }
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({ webSearchEnabled: !webSearchOn })
                    }
                    className={cn(
                      "rounded p-0.5 transition-colors",
                      webSearchOn
                        ? "text-emerald-600 hover:text-emerald-700"
                        : "text-slate-300 hover:text-slate-500",
                    )}
                    aria-label={
                      webSearchOn ? "Disable web search" : "Enable web search"
                    }
                    aria-pressed={webSearchOn}
                  >
                    <Globe size={13} />
                  </button>
                </HoverTooltip>
              )}

              {/* Image attach button (only if vision supported) */}
              {caps.vision && (
                <HoverTooltip
                  label="Attach image — or paste from clipboard"
                  placement="top"
                >
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
                    aria-label="Attach image"
                  >
                    <ImageIcon size={13} />
                  </button>
                </HoverTooltip>
              )}

              {/* Shift+Enter hint — sits on the left next to the model picker
                  so it doesn't crowd the send button. */}
              <HoverTooltip
                label={footerHintTooltip}
                placement="top"
                multiline
                className="min-w-0 flex-1 cursor-default"
              >
                <span className="block truncate text-[10px] text-slate-400 select-none">
                  {isAskMode
                    ? webSearchOn
                      ? "Ask mode · web search on"
                      : "Ask mode"
                    : webSearchOn
                      ? "Web search on"
                      : caps.vision
                        ? "Shift+Enter newline · paste image"
                        : "Shift+Enter for newline"}
                </span>
              </HoverTooltip>

              <div className="ml-auto flex shrink-0 items-center">
                {/* Send / stop */}
                {isStreaming ? (
                  <HoverTooltip label="Stop generating" placement="top">
                    <button
                      type="button"
                      onClick={() => {
                      const restored = cancelStream();
                      setInput(restored);
                      setPromptDraft(restored);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                      aria-label="Stop"
                    >
                      <Square size={12} fill="currentColor" />
                    </button>
                  </HoverTooltip>
                ) : (
                  <HoverTooltip label={sendTooltip} placement="top" multiline>
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
                      aria-label="Send"
                    >
                      <ArrowUp size={14} />
                    </button>
                  </HoverTooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
