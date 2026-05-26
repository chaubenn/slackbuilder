import { create } from "zustand";
import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/react";
import type {
  AiEditResponse,
  StructuredEdit,
} from "../lib/slack/types";
import type {
  AiProviderId,
  AiProviderSettings,
  ChatMessage,
} from "../lib/ai/types";
import { PROVIDERS } from "../lib/ai/types";
import { AI_PANEL_DEFAULT_WIDTH } from "../hooks/useResizablePanel";

export interface AppUiState {
  aiPanelWidth: number;
}

export interface AiHistoryEntry {
  id: string;
  before: JSONContent;
  after: JSONContent;
  editIds: string[];
  timestamp: number;
}

export interface AppState {
  document: JSONContent;
  chat: ChatMessage[];
  pendingResponse: AiEditResponse | null;
  pendingSelectedEditIds: Record<string, boolean>;
  isStreaming: boolean;
  abortController: AbortController | null;
  settings: AiProviderSettings;
  history: AiHistoryEntry[];
  redoStack: AiHistoryEntry[];
  ui: AppUiState;
  hydrated: boolean;

  setDocument: (doc: JSONContent) => void;
  setAiPanelWidth: (width: number) => void;
  setSettings: (s: Partial<AiProviderSettings>) => void;
  setProvider: (p: AiProviderId) => void;
  addChatMessages: (
    messages: Omit<ChatMessage, "id">[],
  ) => void;
  startStream: (controller: AbortController, userMessage: string) => void;
  appendAssistantToken: (token: string) => void;
  finishStream: (response: AiEditResponse) => void;
  cancelStream: () => void;
  toggleEditSelected: (id: string) => void;
  setAllEditsSelected: (selected: boolean) => void;
  acceptEdits: (result: { document: JSONContent; editIds: string[] }) => void;
  rejectEdits: () => void;
  pushHistory: (entry: AiHistoryEntry) => void;
  revertLastAiChange: () => void;
  redoLastAiChange: () => void;
  resetMessage: () => void;
  hydrate: (snapshot: Partial<AppState>) => void;
}

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const DEFAULT_SETTINGS: AiProviderSettings = {
  provider: "openai",
  apiKey: "",
  model: PROVIDERS.openai.defaultModel,
  baseUrl: PROVIDERS.openai.defaultBaseUrl,
};

export const useAppStore = create<AppState>((set, get) => ({
  document: EMPTY_DOC,
  chat: [],
  pendingResponse: null,
  pendingSelectedEditIds: {},
  isStreaming: false,
  abortController: null,
  settings: DEFAULT_SETTINGS,
  history: [],
  redoStack: [],
  ui: { aiPanelWidth: AI_PANEL_DEFAULT_WIDTH },
  hydrated: false,

  setDocument: (doc) => set({ document: doc }),

  setAiPanelWidth: (width) =>
    set((state) => ({
      ui: { ...state.ui, aiPanelWidth: width },
    })),

  setSettings: (s) =>
    set((state) => ({
      settings: { ...state.settings, ...s },
    })),

  setProvider: (p) => {
    const defaults = PROVIDERS[p];
    set((state) => ({
      settings: {
        ...state.settings,
        provider: p,
        model:
          state.settings.provider === p
            ? state.settings.model
            : defaults.defaultModel,
        baseUrl:
          state.settings.provider === p
            ? state.settings.baseUrl
            : defaults.defaultBaseUrl,
      },
    }));
  },

  addChatMessages: (messages) =>
    set((state) => ({
      chat: [
        ...state.chat,
        ...messages.map((message) => ({ id: nanoid(8), ...message })),
      ],
    })),

  startStream: (controller, userMessage) =>
    set((state) => ({
      isStreaming: true,
      abortController: controller,
      pendingResponse: null,
      pendingSelectedEditIds: {},
      chat: [
        ...state.chat,
        { id: nanoid(8), role: "user", content: userMessage },
        { id: nanoid(8), role: "assistant", content: "" },
      ],
    })),

  appendAssistantToken: (token) =>
    set((state) => {
      const last = state.chat[state.chat.length - 1];
      if (!last || last.role !== "assistant") return state;
      const updated: ChatMessage = {
        ...last,
        content: last.content + token,
      };
      return {
        chat: [...state.chat.slice(0, -1), updated],
      };
    }),

  finishStream: (response) =>
    set((state) => {
      const last = state.chat[state.chat.length - 1];
      const replaced: ChatMessage =
        last && last.role === "assistant"
          ? {
              ...last,
              content: response.assistantMessage,
              pendingEditCount: response.edits.length,
            }
          : {
              id: nanoid(8),
              role: "assistant",
              content: response.assistantMessage,
              pendingEditCount: response.edits.length,
            };
      const newChat =
        last && last.role === "assistant"
          ? [...state.chat.slice(0, -1), replaced]
          : [...state.chat, replaced];

      const selected: Record<string, boolean> = {};
      response.edits.forEach((e) => (selected[e.id] = true));

      return {
        isStreaming: false,
        abortController: null,
        chat: newChat,
        pendingResponse: response,
        pendingSelectedEditIds: selected,
      };
    }),

  cancelStream: () => {
    const controller = get().abortController;
    if (controller) controller.abort();
    set({ isStreaming: false, abortController: null });
  },

  toggleEditSelected: (id) =>
    set((state) => ({
      pendingSelectedEditIds: {
        ...state.pendingSelectedEditIds,
        [id]: !state.pendingSelectedEditIds[id],
      },
    })),

  setAllEditsSelected: (selected) =>
    set((state) => {
      const next: Record<string, boolean> = {};
      Object.keys(state.pendingSelectedEditIds).forEach((k) => {
        next[k] = selected;
      });
      return { pendingSelectedEditIds: next };
    }),

  acceptEdits: ({ document, editIds }) =>
    set((state) => ({
      document,
      history: [
        ...state.history,
        {
          id: nanoid(8),
          before: state.document,
          after: document,
          editIds,
          timestamp: Date.now(),
        },
      ],
      pendingResponse: null,
      pendingSelectedEditIds: {},
      redoStack: [],
    })),

  rejectEdits: () =>
    set({ pendingResponse: null, pendingSelectedEditIds: {} }),

  pushHistory: (entry) =>
    set((state) => ({ history: [...state.history, entry] })),

  revertLastAiChange: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const last = state.history[state.history.length - 1];
      return {
        document: last.before,
        history: state.history.slice(0, -1),
        redoStack: [...state.redoStack, last],
      };
    }),

  redoLastAiChange: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const last = state.redoStack[state.redoStack.length - 1];
      return {
        document: last.after,
        history: [...state.history, last],
        redoStack: state.redoStack.slice(0, -1),
      };
    }),

  resetMessage: () =>
    set({
      document: EMPTY_DOC,
      chat: [],
      pendingResponse: null,
      pendingSelectedEditIds: {},
      history: [],
      redoStack: [],
    }),

  hydrate: (snapshot) =>
    set((state) => ({
      ...state,
      ...snapshot,
      redoStack: [],
      hydrated: true,
      isStreaming: false,
      abortController: null,
    })),
}));

export const filterSelectedEdits = (
  response: AiEditResponse | null,
  selected: Record<string, boolean>,
): StructuredEdit[] => {
  if (!response) return [];
  return response.edits.filter((e) => selected[e.id]);
};

export { EMPTY_DOC };
