import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("deleteSlackbuilder", () => {
  beforeEach(() => {
    invoke.mockReset();
    window.localStorage.clear();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("asks the Tauri backend to wipe data and uninstall the app", async () => {
    const { deleteSlackbuilder } = await import("./deleteSlackbuilder");
    invoke.mockResolvedValueOnce(undefined);

    await deleteSlackbuilder();

    expect(invoke).toHaveBeenCalledWith("delete_slackbuilder", {
      confirmation: "DELETE SLACKBUILDER",
    });
  });

  it("wipes browser-dev local storage when the native command is unavailable", async () => {
    const { deleteSlackbuilder } = await import("./deleteSlackbuilder");
    window.localStorage.setItem("slackbuilder-state-v2", "saved");
    window.localStorage.setItem("slackbuilder-state-v1", "legacy");
    invoke.mockRejectedValueOnce(new Error("not available"));

    const result = await deleteSlackbuilder();

    expect(window.localStorage.getItem("slackbuilder-state-v2")).toBeNull();
    expect(window.localStorage.getItem("slackbuilder-state-v1")).toBeNull();
    expect(result).toEqual({ native: false });
  });

  it("surfaces native deletion failures in packaged Tauri", async () => {
    const { deleteSlackbuilder } = await import("./deleteSlackbuilder");
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    invoke.mockRejectedValueOnce(new Error("permission denied"));

    await expect(deleteSlackbuilder()).rejects.toThrow(
      "Could not delete Slackbuilder: permission denied",
    );
  });
});
