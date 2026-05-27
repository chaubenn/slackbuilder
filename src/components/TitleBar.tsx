import { useCallback, useEffect, useState } from "react";
import { Minus, Maximize2, Minimize2, X } from "lucide-react";

// Detect Tauri environment at module init — safe to read synchronously.
const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getAppWindow() {
  if (!IS_TAURI) return null;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return null;
  }
}

interface TitleBarProps {
  /** Transient status message shown instead of the subtitle (copy success, errors, …) */
  status?: string | null;
}

export function TitleBar({ status }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  // Track maximize state via DOM resize events so we swap the icon correctly.
  useEffect(() => {
    let mounted = true;
    let detach: (() => void) | undefined;

    getAppWindow().then(async (win) => {
      if (!win || !mounted) return;

      const check = async () => {
        if (mounted) setMaximized(await win.isMaximized());
      };

      await check();
      window.addEventListener("resize", check);
      detach = () => window.removeEventListener("resize", check);
    });

    return () => {
      mounted = false;
      detach?.();
    };
  }, []);

  const minimize = useCallback(async () => {
    (await getAppWindow())?.minimize();
  }, []);

  const toggleMaximize = useCallback(async () => {
    (await getAppWindow())?.toggleMaximize();
  }, []);

  const close = useCallback(async () => {
    (await getAppWindow())?.close();
  }, []);

  return (
    <div className="titlebar flex h-[30px] shrink-0 items-stretch border-b border-slate-200 bg-white">
      {/*
       * Drag region: covers the entire bar except the window-control buttons.
       * data-tauri-drag-region tells Tauri's webview to use this area for
       * moving the window when the user click-drags.
       */}
      <div
        data-tauri-drag-region
        onDoubleClick={IS_TAURI ? toggleMaximize : undefined}
        className="flex flex-1 items-center gap-2.5 overflow-hidden px-3"
      >
        {/* Logo mark */}
        <div className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] bg-violet-600 pointer-events-none">
          <svg
            width="9"
            height="9"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 9L6 3L10 9"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* App name */}
        <span className="text-[12px] font-semibold leading-none tracking-tight text-slate-800 pointer-events-none select-none">
          Slackbuilder
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
            aria-label="Minimize"
            className="flex w-[46px] items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Minus size={11} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={toggleMaximize}
            aria-label={maximized ? "Restore" : "Maximize"}
            className="flex w-[46px] items-center justify-center text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {maximized ? (
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
