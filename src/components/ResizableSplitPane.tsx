import { useEffect, type ReactNode } from "react";
import {
  useResizablePanel,
  AI_PANEL_MIN_WIDTH,
  AI_PANEL_MAX_WIDTH_RATIO,
} from "../hooks/useResizablePanel";
import { cn } from "../lib/utils";

interface ResizableSplitPaneProps {
  primary: ReactNode;
  secondary: ReactNode;
  widthPx: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidthRatio?: number;
}

export function ResizableSplitPane({
  primary,
  secondary,
  widthPx,
  onWidthChange,
  minWidth = AI_PANEL_MIN_WIDTH,
  maxWidthRatio = AI_PANEL_MAX_WIDTH_RATIO,
}: ResizableSplitPaneProps) {
  const { containerRef, isDragging, separatorProps, clampWidth } =
    useResizablePanel({
      widthPx,
      onWidthChange,
      minWidth,
      maxWidthRatio,
    });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const clamped = clampWidth(widthPx);
      if (clamped !== widthPx) onWidthChange(clamped);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [clampWidth, containerRef, onWidthChange, widthPx]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{primary}</div>
      <div
        {...separatorProps}
        className={cn(
          "relative z-10 shrink-0 touch-none",
          "before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-['']",
          "w-1 cursor-col-resize border-l border-slate-200 bg-slate-100",
          "hover:bg-slate-200",
          isDragging && "bg-violet-400 border-violet-300",
        )}
      />
      <aside
        style={{ width: widthPx }}
        className="flex min-h-0 shrink-0 flex-col"
      >
        {secondary}
      </aside>
    </div>
  );
}
