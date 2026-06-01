import { useCallback, useEffect, useState } from "react";
import { Minus, Maximize2, Minimize2, X } from "lucide-react";
import slackbuilderMark from "../assets/slackbuilder-mark.png";

// Detect Tauri environment at module init — safe to read synchronously.
const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const IS_MACOS =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.platform);

async function getAppWindow() {
  if (!IS_TAURI) return null;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return null;
  }
}

async function isWindowZoomed(
  win: Awaited<ReturnType<typeof getAppWindow>>,
): Promise<boolean> {
  if (!win) return false;
  return IS_MACOS ? win.isFullscreen() : win.isMaximized();
}

async function toggleWindowZoom(
  win: Awaited<ReturnType<typeof getAppWindow>>,
): Promise<void> {
  if (!win) return;
  if (IS_MACOS) {
    await win.setFullscreen(!(await win.isFullscreen()));
  } else {
    await win.toggleMaximize();
  }
}

interface TitleBarProps {
  /** Transient status message shown instead of the subtitle (copy success, errors, …) */
  status?: string | null;
}

export function TitleBar({ status }: TitleBarProps) {
  const [zoomed, setZoomed] = useState(false);

  // Track zoom/fullscreen state so we swap the icon correctly.
  useEffect(() => {
    let mounted = true;
    let detachResize: (() => void) | undefined;
    let unlistenResized: (() => void) | undefined;

    getAppWindow().then(async (win) => {
      if (!win || !mounted) return;

      const check = async () => {
        if (mounted) setZoomed(await isWindowZoomed(win));
      };

      await check();
      window.addEventListener("resize", check);
      detachResize = () => window.removeEventListener("resize", check);

      try {
        unlistenResized = await win.onResized(() => {
          void check();
        });
      } catch {
        // onResized unavailable outside Tauri — resize listener is enough
      }
    });

    return () => {
      mounted = false;
      detachResize?.();
      unlistenResized?.();
    };
  }, []);

  const minimize = useCallback(async () => {
    (await getAppWindow())?.minimize();
  }, []);

  const toggleZoom = useCallback(async () => {
    const win = await getAppWindow();
    await toggleWindowZoom(win);
  }, []);

  const close = useCallback(async () => {
    (await getAppWindow())?.close();
  }, []);

  const zoomAriaLabel = IS_MACOS
    ? zoomed
      ? "Exit fullscreen"
      : "Enter fullscreen"
    : zoomed
      ? "Restore"
      : "Maximize";

  const minimizeDisabled = IS_MACOS && zoomed;

  return (
    <div className="titlebar flex h-[30px] shrink-0 items-stretch border-b border-slate-200 bg-white">
      {/*
       * Drag region: covers the entire bar except the window-control buttons.
       * data-tauri-drag-region tells Tauri's webview to use this area for
       * moving the window when the user click-drags.
       */}
      <div
        data-tauri-drag-region
        onDoubleClick={IS_TAURI ? toggleZoom : undefined}
        className="flex flex-1 items-center gap-1 overflow-hidden px-3"
      >
        {/* Logo mark */}
        <img
          src={slackbuilderMark}
          alt=""
          aria-hidden="true"
          className="h-[18px] w-[18px] shrink-0 pointer-events-none"
        />

        {/* App name */}
        <span className="text-[12px] leading-none tracking-tight text-slate-800 pointer-events-none select-none">
          <span className="font-bold">slack</span>
          <span className="font-normal">builder</span>
        </span>

        {/* Divider */}
        <div className="h-3 w-px shrink-0 bg-slate-200 pointer-events-none" />

        {/* Subtitle / copy status */}
        <span
          className={[
            "truncate text-[11px] leading-none pointer-events-none select-none transition-colors duration-150",
            status ? "text-slate-600" : "text-slate-400",
          ].join(" ")}
        >
          {status ?? "AI-powered Slack composer"}
        </span>
      </div>

      {/* Window controls — only rendered inside Tauri */}
      {IS_TAURI && (
        <div className="flex shrink-0 items-stretch">
          <button
            type="button"
            onClick={minimize}
            disabled={minimizeDisabled}
            aria-disabled={minimizeDisabled}
            aria-label={
              minimizeDisabled
                ? "Minimize unavailable in fullscreen"
                : "Minimize"
            }
            title={
              minimizeDisabled ? "Exit fullscreen to minimize" : undefined
            }
            className="flex w-[46px] items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-500"
          >
            <Minus size={11} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={toggleZoom}
            aria-label={zoomAriaLabel}
            className="flex w-[46px] items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {zoomed ? (
              <Minimize2 size={10} strokeWidth={1.5} />
            ) : (
              <Maximize2 size={10} strokeWidth={1.5} />
            )}
          </button>

          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="titlebar-close flex w-[46px] items-center justify-center text-slate-400 transition-colors hover:bg-red-500 hover:text-white"
          >
            <X size={11} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
