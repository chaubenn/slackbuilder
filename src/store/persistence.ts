// Persist app state to a Tauri store (falling back to localStorage in the
// browser dev environment). All sensitive values stay on the user's machine.

import { useEffect } from "react";
import { useAppStore } from "./appStore";
import {
  AI_PANEL_DEFAULT_WIDTH,
  clampAiPanelWidth,
} from "../hooks/useResizablePanel";

const KEY = "slackbuilder-state-v1";

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

interface Snapshot {
  document: unknown;
  chat: unknown;
  settings: unknown;
  history: unknown;
  ui?: { aiPanelWidth?: number };
}

export async function loadSnapshot(): Promise<Snapshot | null> {
  const tauri = await getTauriStore();
  if (tauri) {
    return (await tauri.get<Snapshot>(KEY)) ?? null;
  }
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  const tauri = await getTauriStore();
  if (tauri) {
    await tauri.set(KEY, snapshot);
    await tauri.save();
    return;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  }
}

export function useAutosave(delayMs = 1500) {
  useEffect(() => {
    let timer: number | null = null;
    const unsub = useAppStore.subscribe((state) => {
      if (!state.hydrated) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        saveSnapshot({
          document: state.document,
          chat: state.chat,
          settings: state.settings,
          history: state.history,
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
  if (!snapshot) {
    useAppStore.getState().hydrate({});
    return;
  }
  const savedWidth = snapshot.ui?.aiPanelWidth;
  const aiPanelWidth =
    typeof savedWidth === "number" && Number.isFinite(savedWidth)
      ? clampAiPanelWidth(savedWidth)
      : AI_PANEL_DEFAULT_WIDTH;

  useAppStore.getState().hydrate({
    document: (snapshot.document as never) ?? undefined,
    chat: (snapshot.chat as never) ?? [],
    settings: (snapshot.settings as never) ?? undefined,
    history: (snapshot.history as never) ?? [],
    ui: { aiPanelWidth },
  });
}
