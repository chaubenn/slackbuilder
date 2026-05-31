import { invoke } from "@tauri-apps/api/core";

const LOCAL_STORAGE_KEYS = ["slackbuilder-state-v2", "slackbuilder-state-v1"];
const CONFIRMATION_PHRASE = "DELETE SLACKBUILDER";

export interface DeleteSlackbuilderResult {
  native: boolean;
}

export async function deleteSlackbuilder(): Promise<DeleteSlackbuilderResult> {
  try {
    await invoke("delete_slackbuilder", { confirmation: CONFIRMATION_PHRASE });
    return { native: true };
  } catch (err) {
    if (isTauriRuntime()) {
      throw new Error(
        `Could not delete Slackbuilder: ${(err as Error).message}`,
      );
    }
    if (typeof window !== "undefined") {
      for (const key of LOCAL_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    }
    return { native: false };
  }
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    Boolean(window.__TAURI_INTERNALS__)
  );
}
