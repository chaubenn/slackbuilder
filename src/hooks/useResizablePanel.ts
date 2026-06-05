import { useCallback, useRef, useState, type PointerEvent } from "react";

export const AI_PANEL_DEFAULT_WIDTH = 380;
export const AI_PANEL_MIN_WIDTH = 280;
export const AI_PANEL_MAX_WIDTH = 720;
export const AI_PANEL_MAX_WIDTH_RATIO = 0.65;
export const EDITOR_MIN_WIDTH = 360;
export const SPLIT_SEPARATOR_WIDTH = 4;

export function clampAiPanelWidth(
  width: number,
  containerWidth?: number,
): number {
  const maxFromContainer =
    containerWidth != null && containerWidth > 0
      ? containerWidth * AI_PANEL_MAX_WIDTH_RATIO
      : AI_PANEL_MAX_WIDTH;
  const maxWithEditorFloor =
    containerWidth != null && containerWidth > 0
      ? containerWidth - EDITOR_MIN_WIDTH - SPLIT_SEPARATOR_WIDTH
      : AI_PANEL_MAX_WIDTH;
  const maxWidth = Math.max(
    AI_PANEL_MIN_WIDTH,
    Math.min(maxFromContainer, maxWithEditorFloor),
  );
  return Math.min(maxWidth, Math.max(AI_PANEL_MIN_WIDTH, width));
}

interface UseResizablePanelOptions {
  widthPx: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidthRatio?: number;
}

export function useResizablePanel({
  widthPx,
  onWidthChange,
  minWidth = AI_PANEL_MIN_WIDTH,
  maxWidthRatio = AI_PANEL_MAX_WIDTH_RATIO,
}: UseResizablePanelOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const getMaxWidth = useCallback(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    if (containerWidth > 0) {
      const maxFromRatio = containerWidth * maxWidthRatio;
      const maxWithEditorFloor =
        containerWidth - EDITOR_MIN_WIDTH - SPLIT_SEPARATOR_WIDTH;
      return Math.max(minWidth, Math.min(maxFromRatio, maxWithEditorFloor));
    }
    return Math.max(minWidth, AI_PANEL_MAX_WIDTH);
  }, [minWidth, maxWidthRatio]);

  const clampWidth = useCallback(
    (width: number) => {
      const maxWidth = getMaxWidth();
      return Math.min(maxWidth, Math.max(minWidth, width));
    },
    [getMaxWidth, minWidth],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startWidth: widthPx };
      setIsDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [widthPx],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      const next = clampWidth(dragRef.current.startWidth - delta);
      onWidthChange(next);
    },
    [clampWidth, onWidthChange],
  );

  const endDrag = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const maxWidth = getMaxWidth();

  const separatorProps = {
    role: "separator" as const,
    "aria-orientation": "vertical" as const,
    "aria-valuenow": Math.round(widthPx),
    "aria-valuemin": minWidth,
    "aria-valuemax": Math.round(maxWidth),
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return {
    containerRef,
    isDragging,
    separatorProps,
    clampWidth,
  };
}
