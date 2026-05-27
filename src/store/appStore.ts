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
import {
  abortAllStreams,
  abortStream,
  clearStream,
  registerStream,
} from "./streamControllers";

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

export interface Conversation {
  id: string;
  title: string;
  document: JSONContent;
  chat: ChatMessage[];
  pendingResponse: AiEditResponse | null;
  pendingSelectedEditIds: Record<string, boolean>;
  history: AiHistoryEntry[];
  redoStack: AiHistoryEntry[];
  isStreaming: boolean;
  promptDraft: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
  activeConversationId: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  projects: Project[];
  activeProjectId: string;
  document: JSONContent;
  chat: ChatMessage[];
  pendingResponse: AiEditResponse | null;
  pendingSelectedEditIds: Record<string, boolean>;
  isStreaming: boolean;
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
  createProject: (name?: string) => void;
  switchProject: (projectId: string) => void;
  createConversation: (title?: string) => void;
  switchConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  reorderConversations: (orderedIds: string[]) => void;
  clearChat: () => void;
  startStream: (
    projectId: string,
    conversationId: string,
    controller: AbortController,
    userMessage: string,
    imageCount?: number,
  ) => void;
  /** Append a streaming token to a specific conversation (supports cross-tab streaming). */
  appendAssistantToken: (
    projectId: string,
    conversationId: string,
    token: string,
  ) => void;
  finishStream: (
    projectId: string,
    conversationId: string,
    response: AiEditResponse,
  ) => void;
  cancelStream: () => void;
  toggleEditSelected: (id: string) => void;
  setAllEditsSelected: (selected: boolean) => void;
  acceptEdits: (result: { document: JSONContent; editIds: string[] }) => void;
  rejectEdits: () => void;
  pushHistory: (entry: AiHistoryEntry) => void;
  revertLastAiChange: () => void;
  redoLastAiChange: () => void;
  resetMessage: () => void;
  setPromptDraft: (draft: string) => void;
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
  theme: "light",
};

type ActiveConversationPatch = Partial<
  Pick<
    Conversation,
    | "title"
    | "document"
    | "chat"
    | "pendingResponse"
    | "pendingSelectedEditIds"
    | "history"
    | "redoStack"
    | "isStreaming"
    | "promptDraft"
  >
>;

function cloneDoc(doc: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(doc)) as JSONContent;
}

function createConversation(
  title = "Untitled 1",
  overrides: Partial<Conversation> = {},
): Conversation {
  const now = Date.now();
  return {
    id: nanoid(8),
    title,
    document: cloneDoc(EMPTY_DOC),
    chat: [],
    pendingResponse: null,
    pendingSelectedEditIds: {},
    history: [],
    redoStack: [],
    isStreaming: false,
    promptDraft: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createProject(name = "Default project", conversation?: Conversation): Project {
  const now = Date.now();
  const firstConversation = conversation ?? createConversation();
  return {
    id: nanoid(8),
    name,
    conversations: [firstConversation],
    activeConversationId: firstConversation.id,
    createdAt: now,
    updatedAt: now,
  };
}

function activeFieldsFromConversation(conversation: Conversation) {
  return {
    document: conversation.document,
    chat: conversation.chat,
    pendingResponse: conversation.pendingResponse,
    pendingSelectedEditIds: conversation.pendingSelectedEditIds,
    history: conversation.history,
    redoStack: conversation.redoStack,
    isStreaming: conversation.isStreaming,
  };
}

function syncActiveConversation(projects: Project[], state: AppState): Project[] {
  const project = getActiveProject(projects, state.activeProjectId);
  const conversation = getActiveConversation(project);
  if (!project || !conversation) return projects;

  const patched: Conversation = {
    ...conversation,
    document: state.document,
    chat: state.chat,
    pendingResponse: state.pendingResponse,
    pendingSelectedEditIds: state.pendingSelectedEditIds,
    history: state.history,
    redoStack: state.redoStack,
    isStreaming: conversation.isStreaming,
    updatedAt: Date.now(),
  };

  const updatedProject: Project = {
    ...project,
    conversations: project.conversations.map((item) =>
      item.id === patched.id ? patched : item,
    ),
    updatedAt: Date.now(),
  };

  return projects.map((item) =>
    item.id === updatedProject.id ? updatedProject : item,
  );
}

function updateConversationById(
  state: AppState,
  projectId: string,
  conversationId: string,
  patch: ActiveConversationPatch,
): Partial<
  Pick<
    AppState,
    | "projects"
    | "document"
    | "chat"
    | "pendingResponse"
    | "pendingSelectedEditIds"
    | "history"
    | "redoStack"
    | "isStreaming"
  >
> {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return { projects: state.projects };

  const conversation = project.conversations.find(
    (item) => item.id === conversationId,
  );
  if (!conversation) return { projects: state.projects };

  const now = Date.now();
  const updatedConversation: Conversation = {
    ...conversation,
    ...patch,
    updatedAt: now,
  };
  const updatedProject: Project = {
    ...project,
    conversations: project.conversations.map((item) =>
      item.id === conversationId ? updatedConversation : item,
    ),
    updatedAt: now,
  };
  const projects = state.projects.map((item) =>
    item.id === projectId ? updatedProject : item,
  );

  const isActive =
    state.activeProjectId === projectId &&
    updatedProject.activeConversationId === conversationId;

  return {
    projects,
    ...(isActive ? activeFieldsFromConversation(updatedConversation) : {}),
  };
}

function getActiveProject(projects: Project[], activeProjectId: string) {
  return projects.find((project) => project.id === activeProjectId) ?? projects[0];
}

function getActiveConversation(project: Project | undefined) {
  if (!project) return undefined;
  return (
    project.conversations.find(
      (conversation) => conversation.id === project.activeConversationId,
    ) ?? project.conversations[0]
  );
}

function ensureProjectTree(state: AppState): {
  projects: Project[];
  activeProjectId: string;
  project: Project;
  conversation: Conversation;
} {
  const existingProject = getActiveProject(state.projects, state.activeProjectId);
  const existingConversation = getActiveConversation(existingProject);

  if (existingProject && existingConversation) {
    return {
      projects: state.projects,
      activeProjectId: existingProject.id,
      project: existingProject,
      conversation: existingConversation,
    };
  }

  const conversation = createConversation("Untitled 1", {
    document: state.document,
    chat: state.chat,
    pendingResponse: state.pendingResponse,
    pendingSelectedEditIds: state.pendingSelectedEditIds,
    history: state.history,
    redoStack: state.redoStack,
  });
  const project = createProject("Default project", conversation);
  return {
    projects: [project],
    activeProjectId: project.id,
    project,
    conversation,
  };
}

function updateActiveConversation(
  state: AppState,
  patch: ActiveConversationPatch,
): Partial<
  Pick<
    AppState,
    | "projects"
    | "document"
    | "chat"
    | "pendingResponse"
    | "pendingSelectedEditIds"
    | "history"
    | "redoStack"
    | "isStreaming"
  >
> {
  const { activeProjectId, conversation } = ensureProjectTree(state);
  return updateConversationById(state, activeProjectId, conversation.id, patch);
}

function normalizeProjects(
  projects: Project[] | undefined,
  fallback: Pick<
    AppState,
    | "document"
    | "chat"
    | "pendingResponse"
    | "pendingSelectedEditIds"
    | "history"
    | "redoStack"
  >,
): Project[] {
  if (!projects?.length) {
    return [
      createProject(
        "Default project",
        createConversation("Untitled 1", fallback),
      ),
    ];
  }

  return projects.map((project, projectIndex) => {
    const conversations = (
      project.conversations?.length
        ? project.conversations
        : [createConversation("Untitled 1")]
    ).map((conv) => ({
      ...conv,
      promptDraft: conv.promptDraft ?? "",
      isStreaming: conv.isStreaming ?? false,
    }));
    const activeConversation =
      conversations.find((item) => item.id === project.activeConversationId) ??
      conversations[0];

    return {
      ...project,
      name: project.name || `Project ${projectIndex + 1}`,
      conversations,
      activeConversationId: activeConversation.id,
    };
  });
}

function clearStreamingFlags(projects: Project[]): Project[] {
  return projects.map((project) => ({
    ...project,
    conversations: project.conversations.map((conversation) => ({
      ...conversation,
      isStreaming: false,
    })),
  }));
}

function titleFromMessage(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "Conversation";
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

function shouldRetitleConversation(conversation: Conversation): boolean {
  return (
    conversation.chat.length === 0 &&
    (/^Conversation \d+$/.test(conversation.title) ||
      /^Untitled \d+$/.test(conversation.title) ||
      conversation.title === "Conversation")
  );
}

const initialConversation = createConversation();
const initialProject = createProject("Default project", initialConversation);

export const useAppStore = create<AppState>((set, get) => ({
  projects: [initialProject],
  activeProjectId: initialProject.id,
  document: initialConversation.document,
  chat: [],
  pendingResponse: null,
  pendingSelectedEditIds: {},
  isStreaming: false,
  settings: DEFAULT_SETTINGS,
  history: [],
  redoStack: [],
  ui: { aiPanelWidth: AI_PANEL_DEFAULT_WIDTH },
  hydrated: false,

  setDocument: (doc) =>
    set((state) => updateActiveConversation(state, { document: doc })),

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
    set((state) =>
      updateActiveConversation(state, {
        chat: [
          ...state.chat,
          ...messages.map((message) => ({ id: nanoid(8), ...message })),
        ],
      }),
    ),

  createProject: (name) => {
    set((state) => {
      const syncedProjects = syncActiveConversation(state.projects, state);
      const syncedState = { ...state, projects: syncedProjects };
      const projectName =
        name?.trim() || `Project ${syncedState.projects.length + 1}`;
      const conversation = createConversation("Untitled 1");
      const project = createProject(projectName, conversation);
      return {
        projects: [...syncedState.projects, project],
        activeProjectId: project.id,
        ...activeFieldsFromConversation(conversation),
      };
    });
  },

  switchProject: (projectId) => {
    set((state) => {
      const syncedProjects = syncActiveConversation(state.projects, state);
      const syncedState = { ...state, projects: syncedProjects };
      const project = syncedState.projects.find((item) => item.id === projectId);
      const conversation = getActiveConversation(project);
      if (!project || !conversation) return {};
      return {
        projects: syncedState.projects,
        activeProjectId: project.id,
        ...activeFieldsFromConversation(conversation),
      };
    });
  },

  createConversation: (title) => {
    set((state) => {
      const syncedProjects = syncActiveConversation(state.projects, state);
      const syncedState = { ...state, projects: syncedProjects };
      const { projects, activeProjectId, project } =
        ensureProjectTree(syncedState);
      const conversationTitle =
        title?.trim() || `Untitled ${project.conversations.length + 1}`;
      const conversation = createConversation(conversationTitle);
      const updatedProject = {
        ...project,
        conversations: [...project.conversations, conversation],
        activeConversationId: conversation.id,
        updatedAt: Date.now(),
      };
      return {
        projects: projects.map((item) =>
          item.id === updatedProject.id ? updatedProject : item,
        ),
        activeProjectId,
        ...activeFieldsFromConversation(conversation),
      };
    });
  },

  switchConversation: (conversationId) => {
    set((state) => {
      const syncedProjects = syncActiveConversation(state.projects, state);
      const syncedState = { ...state, projects: syncedProjects };
      const { projects, activeProjectId, project } =
        ensureProjectTree(syncedState);
      const conversation = project.conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) return { projects: syncedProjects };
      const updatedProject = {
        ...project,
        activeConversationId: conversation.id,
        updatedAt: Date.now(),
      };
      return {
        projects: projects.map((item) =>
          item.id === updatedProject.id ? updatedProject : item,
        ),
        activeProjectId,
        ...activeFieldsFromConversation(conversation),
      };
    });
  },

  deleteConversation: (conversationId) => {
    set((state) => {
      const syncedProjects = syncActiveConversation(state.projects, state);
      const syncedState = { ...state, projects: syncedProjects };
      const { projects, activeProjectId, project } =
        ensureProjectTree(syncedState);
      abortStream(activeProjectId, conversationId);
      const deleteIndex = project.conversations.findIndex(
        (item) => item.id === conversationId,
      );
      if (deleteIndex === -1) return { projects: syncedProjects };

      const remaining = project.conversations.filter(
        (item) => item.id !== conversationId,
      );
      const conversations =
        remaining.length > 0 ? remaining : [createConversation("Untitled 1")];
      const nextActiveConversation =
        conversationId === project.activeConversationId
          ? conversations[Math.max(0, deleteIndex - 1)] ?? conversations[0]
          : getActiveConversation({ ...project, conversations }) ??
            conversations[0];
      const updatedProject = {
        ...project,
        conversations,
        activeConversationId: nextActiveConversation.id,
        updatedAt: Date.now(),
      };

      return {
        projects: projects.map((item) =>
          item.id === updatedProject.id ? updatedProject : item,
        ),
        activeProjectId,
        ...activeFieldsFromConversation(nextActiveConversation),
      };
    });
  },

  renameConversation: (conversationId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((state) => {
      const { projects, activeProjectId, project } = ensureProjectTree(state);
      if (!project.conversations.some((item) => item.id === conversationId)) {
        return {};
      }
      const now = Date.now();
      const conversations = project.conversations.map((item) =>
        item.id === conversationId
          ? { ...item, title: trimmed, updatedAt: now }
          : item,
      );
      const updatedProject = {
        ...project,
        conversations,
        updatedAt: now,
      };
      const activeConversation =
        conversations.find(
          (item) => item.id === updatedProject.activeConversationId,
        ) ?? conversations[0];
      return {
        projects: projects.map((item) =>
          item.id === updatedProject.id ? updatedProject : item,
        ),
        activeProjectId,
        ...(activeConversation
          ? activeFieldsFromConversation(activeConversation)
          : {}),
      };
    });
  },

  reorderConversations: (orderedIds) => {
    set((state) => {
      const { projects, activeProjectId, project } = ensureProjectTree(state);
      const byId = new Map(
        project.conversations.map((item) => [item.id, item]),
      );
      const reordered: Conversation[] = [];
      const seen = new Set<string>();
      for (const id of orderedIds) {
        const conversation = byId.get(id);
        if (conversation && !seen.has(id)) {
          reordered.push(conversation);
          seen.add(id);
        }
      }
      for (const conversation of project.conversations) {
        if (!seen.has(conversation.id)) reordered.push(conversation);
      }
      if (reordered.length !== project.conversations.length) return {};
      const unchanged = reordered.every(
        (item, index) => item.id === project.conversations[index].id,
      );
      if (unchanged) return {};
      const updatedProject = {
        ...project,
        conversations: reordered,
        updatedAt: Date.now(),
      };
      return {
        projects: projects.map((item) =>
          item.id === updatedProject.id ? updatedProject : item,
        ),
        activeProjectId,
      };
    });
  },

  clearChat: () => {
    set((state) => {
      const { activeProjectId, conversation } = ensureProjectTree(state);
      abortStream(activeProjectId, conversation.id);
      return updateConversationById(state, activeProjectId, conversation.id, {
        chat: [],
        pendingResponse: null,
        pendingSelectedEditIds: {},
        isStreaming: false,
      });
    });
  },

  startStream: (projectId, conversationId, controller, userMessage, imageCount) => {
    registerStream(projectId, conversationId, controller);
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId);
      const conversation = project?.conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) return state;

      const baseChat =
        state.activeProjectId === projectId &&
        project?.activeConversationId === conversationId
          ? state.chat
          : conversation.chat;

      return updateConversationById(state, projectId, conversationId, {
        title: shouldRetitleConversation(conversation)
          ? titleFromMessage(userMessage)
          : conversation.title,
        pendingResponse: null,
        pendingSelectedEditIds: {},
        chat: [
          ...baseChat,
          {
            id: nanoid(8),
            role: "user",
            content: userMessage,
            ...(imageCount ? { imageCount } : {}),
          },
          { id: nanoid(8), role: "assistant", content: "" },
        ],
        isStreaming: true,
      });
    });
  },

  appendAssistantToken: (projectId, conversationId, token) =>
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return state;
      const conversation = project.conversations.find(
        (c) => c.id === conversationId,
      );
      if (!conversation) return state;

      // Use the live chat from top-level state if this is the active conversation
      // (avoids stale reads from project tree during rapid updates)
      const isActive =
        state.activeProjectId === projectId &&
        project.activeConversationId === conversationId;
      const chat = isActive ? state.chat : conversation.chat;

      const last = chat[chat.length - 1];
      if (!last || last.role !== "assistant") return state;

      const updated: ChatMessage = {
        ...last,
        content: last.content + token,
      };
      return updateConversationById(state, projectId, conversationId, {
        chat: [...chat.slice(0, -1), updated],
      });
    }),

  finishStream: (projectId, conversationId, response) => {
    clearStream(projectId, conversationId);
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId);
      const conversation = project?.conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) return { projects: state.projects };

      const chat = conversation.chat;
      const last = chat[chat.length - 1];
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
          ? [...chat.slice(0, -1), replaced]
          : [...chat, replaced];

      const selected: Record<string, boolean> = {};
      response.edits.forEach((e) => (selected[e.id] = true));

      return updateConversationById(state, projectId, conversationId, {
        chat: newChat,
        pendingResponse: response,
        pendingSelectedEditIds: selected,
        isStreaming: false,
      });
    });
  },

  cancelStream: () => {
    const state = get();
    const project = getActiveProject(state.projects, state.activeProjectId);
    const conversation = getActiveConversation(project);
    if (!project || !conversation) return;
    abortStream(project.id, conversation.id);
    set((current) =>
      updateConversationById(current, project.id, conversation.id, {
        isStreaming: false,
      }),
    );
  },

  toggleEditSelected: (id) =>
    set((state) =>
      updateActiveConversation(state, {
        pendingSelectedEditIds: {
          ...state.pendingSelectedEditIds,
          [id]: !state.pendingSelectedEditIds[id],
        },
      }),
    ),

  setAllEditsSelected: (selected) =>
    set((state) => {
      const next: Record<string, boolean> = {};
      Object.keys(state.pendingSelectedEditIds).forEach((k) => {
        next[k] = selected;
      });
      return updateActiveConversation(state, { pendingSelectedEditIds: next });
    }),

  acceptEdits: ({ document, editIds }) =>
    set((state) =>
      updateActiveConversation(state, {
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
      }),
    ),

  rejectEdits: () =>
    set((state) =>
      updateActiveConversation(state, {
        pendingResponse: null,
        pendingSelectedEditIds: {},
      }),
    ),

  pushHistory: (entry) =>
    set((state) =>
      updateActiveConversation(state, {
        history: [...state.history, entry],
      }),
    ),

  revertLastAiChange: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const last = state.history[state.history.length - 1];
      return updateActiveConversation(state, {
        document: last.before,
        history: state.history.slice(0, -1),
        redoStack: [...state.redoStack, last],
      });
    }),

  redoLastAiChange: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const last = state.redoStack[state.redoStack.length - 1];
      return updateActiveConversation(state, {
        document: last.after,
        history: [...state.history, last],
        redoStack: state.redoStack.slice(0, -1),
      });
    }),

  resetMessage: () =>
    set((state) =>
      updateActiveConversation(state, {
        document: cloneDoc(EMPTY_DOC),
        chat: [],
        pendingResponse: null,
        pendingSelectedEditIds: {},
        history: [],
        redoStack: [],
      }),
    ),

  setPromptDraft: (draft) =>
    set((state) => {
      const { projects, activeProjectId } = state;
      const project =
        projects.find((p) => p.id === activeProjectId) ?? projects[0];
      if (!project) return {};
      const conversation =
        project.conversations.find(
          (c) => c.id === project.activeConversationId,
        ) ?? project.conversations[0];
      if (!conversation) return {};

      const updatedConversation = { ...conversation, promptDraft: draft };
      const updatedProject = {
        ...project,
        conversations: project.conversations.map((c) =>
          c.id === conversation.id ? updatedConversation : c,
        ),
      };

      return {
        projects: projects.map((p) =>
          p.id === updatedProject.id ? updatedProject : p,
        ),
      };
    }),

  hydrate: (snapshot) => {
    abortAllStreams();
    set((state) => {
      const fallback = {
        document: snapshot.document ?? state.document,
        chat: snapshot.chat ?? state.chat,
        pendingResponse: snapshot.pendingResponse ?? null,
        pendingSelectedEditIds:
          snapshot.pendingSelectedEditIds ?? state.pendingSelectedEditIds,
        history: snapshot.history ?? state.history,
        redoStack: snapshot.redoStack ?? [],
      };
      const projects = clearStreamingFlags(
        normalizeProjects(snapshot.projects, fallback),
      );
      const requestedProjectId = snapshot.activeProjectId ?? state.activeProjectId;
      const activeProject = getActiveProject(projects, requestedProjectId);
      const activeConversation = getActiveConversation(activeProject);

      return {
        ...state,
        settings: { ...DEFAULT_SETTINGS, ...(snapshot.settings ?? {}) },
        ui: snapshot.ui ?? state.ui,
        projects,
        activeProjectId: activeProject?.id ?? projects[0].id,
        ...(activeConversation
          ? activeFieldsFromConversation(activeConversation)
          : { ...fallback, isStreaming: false }),
        redoStack: activeConversation?.redoStack ?? [],
        hydrated: true,
        isStreaming: false,
      };
    });
  },
}));

export function getActiveProjectFromState(state: AppState): Project | undefined {
  return getActiveProject(state.projects, state.activeProjectId);
}

export function getActiveConversationFromState(
  state: AppState,
): Conversation | undefined {
  return getActiveConversation(getActiveProjectFromState(state));
}

export const filterSelectedEdits = (
  response: AiEditResponse | null,
  selected: Record<string, boolean>,
): StructuredEdit[] => {
  if (!response) return [];
  return response.edits.filter((e) => selected[e.id]);
};

export { EMPTY_DOC };
