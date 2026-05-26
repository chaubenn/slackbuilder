// Persist app state to a Tauri store (falling back to localStorage in the
// browser dev environment). All sensitive values stay on the user's machine.

import { useEffect } from "react";
import {
  EMPTY_DOC,
  type AiHistoryEntry,
  type AppState,
  type AppUiState,
  type Conversation,
  type Project,
  useAppStore,
} from "./appStore";
import type { JSONContent } from "@tiptap/react";
import type { ChatMessage } from "../lib/ai/types";
import {
  AI_PANEL_DEFAULT_WIDTH,
  clampAiPanelWidth,
} from "../hooks/useResizablePanel";

const KEY_V1 = "slackbuilder-state-v1";
const KEY_V2 = "slackbuilder-state-v2";

interface StoreModule {
  load: (path: string) => Promise<TauriStore>;
}

interface TauriStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

async function getTauriStore(): Promise<TauriStore | null> {
  try {
    const mod = (await import("@tauri-apps/plugin-store")) as unknown as StoreModule;
    return await mod.load("slackbuilder.store.json");
  } catch {
    return null;
  }
}

interface SnapshotV1 {
  document: unknown;
  chat: unknown;
  settings: unknown;
  history: unknown;
  ui?: { aiPanelWidth?: number };
}

interface SnapshotV2 {
  version: 2;
  projects: Project[];
  activeProjectId: string;
  settings: unknown;
  ui?: { aiPanelWidth?: number };
}

type Snapshot = SnapshotV1 | SnapshotV2;

export async function loadSnapshot(): Promise<Snapshot | null> {
  const tauri = await getTauriStore();
  if (tauri) {
    return (
      (await tauri.get<SnapshotV2>(KEY_V2)) ??
      (await tauri.get<SnapshotV1>(KEY_V1)) ??
      null
    );
  }
  const raw =
    typeof window !== "undefined"
      ? window.localStorage.getItem(KEY_V2) ?? window.localStorage.getItem(KEY_V1)
      : null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: SnapshotV2): Promise<void> {
  const tauri = await getTauriStore();
  if (tauri) {
    await tauri.set(KEY_V2, snapshot);
    await tauri.save();
    return;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY_V2, JSON.stringify(snapshot));
  }
}

export function snapshotToHydration(
  snapshot: Snapshot | null,
): Pick<AppState, "projects" | "activeProjectId" | "settings" | "ui"> | null {
  if (!snapshot) return null;

  if ("version" in snapshot && snapshot.version === 2) {
    return {
      projects: snapshot.projects,
      activeProjectId: snapshot.activeProjectId,
      settings: snapshot.settings as AppState["settings"],
      ui: normalizeUi(snapshot.ui),
    };
  }

  const v1Snapshot = snapshot as SnapshotV1;
  const now = Date.now();
  const conversation: Conversation = {
    id: "default-conversation",
    title: inferConversationTitle(v1Snapshot.chat),
    document: (v1Snapshot.document as JSONContent | undefined) ?? EMPTY_DOC,
    chat: (v1Snapshot.chat as ChatMessage[] | undefined) ?? [],
    pendingResponse: null,
    pendingSelectedEditIds: {},
    history: (v1Snapshot.history as AiHistoryEntry[] | undefined) ?? [],
    redoStack: [],
    createdAt: now,
    updatedAt: now,
  };
  const project: Project = {
    id: "default-project",
    name: "Default project",
    conversations: [conversation],
    activeConversationId: conversation.id,
    createdAt: now,
    updatedAt: now,
  };

  return {
    projects: [project],
    activeProjectId: project.id,
    settings: v1Snapshot.settings as AppState["settings"],
    ui: normalizeUi(v1Snapshot.ui),
  };
}

function normalizeUi(ui: SnapshotV1["ui"] | undefined): AppUiState {
  const savedWidth = ui?.aiPanelWidth;
  return {
    aiPanelWidth:
      typeof savedWidth === "number" && Number.isFinite(savedWidth)
        ? clampAiPanelWidth(savedWidth)
        : AI_PANEL_DEFAULT_WIDTH,
  };
}

function inferConversationTitle(chat: unknown): string {
  if (!Array.isArray(chat)) return "Conversation 1";
  const firstUserMessage = chat.find(
    (message): message is ChatMessage =>
      Boolean(message) &&
      typeof message === "object" &&
      "role" in message &&
      "content" in message &&
      message.role === "user" &&
      typeof message.content === "string",
  );
  if (!firstUserMessage) return "Conversation 1";
  const normalized = firstUserMessage.content.replace(/\s+/g, " ").trim();
  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

export function useAutosave(delayMs = 1500) {
  useEffect(() => {
    let timer: number | null = null;
    const unsub = useAppStore.subscribe((state) => {
      if (!state.hydrated) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveSnapshot({
          version: 2,
          projects: state.projects,
          activeProjectId: state.activeProjectId,
          settings: state.settings,
          ui: state.ui,
        }).catch(() => undefined);
      }, delayMs);
    });
    return () => {
      unsub();
      if (timer) window.clearTimeout(timer);
    };
  }, [delayMs]);
}

export async function hydrateStore(): Promise<void> {
  const snapshot = await loadSnapshot();
  const hydration = snapshotToHydration(snapshot);
  if (!hydration) {
    useAppStore.getState().hydrate({});
    return;
  }

  useAppStore.getState().hydrate(hydration);
}
