import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";

export type HoverTooltipPlacement = "left" | "top" | "bottom";

export interface HoverTooltipProps {
  label: string;
  placement?: HoverTooltipPlacement;
  multiline?: boolean;
  className?: string;
  children: ReactNode;
}

export function HoverTooltip({
  label,
  placement = "top",
  multiline = false,
  className,
  children,
}: HoverTooltipProps) {
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const showTip = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (placement === "top") {
      setTipPos({ x: rect.left + rect.width / 2, y: rect.top - 6 });
      return;
    }
    if (placement === "bottom") {
      setTipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
      return;
    }
    setTipPos({ x: rect.left - 6, y: rect.top + rect.height / 2 });
  };

  const transform =
    placement === "top"
      ? "translate(-50%, -100%)"
      : placement === "bottom"
        ? "translate(-50%, 0)"
        : "translate(-100%, -50%)";

  return (
    <>
      <span
        className={cn("relative inline-flex shrink-0", className)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={(e) => showTip(e.currentTarget)}
        onMouseLeave={() => setTipPos(null)}
        onFocus={(e) => showTip(e.currentTarget)}
        onBlur={() => setTipPos(null)}
      >
        {children}
      </span>
      {tipPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: tipPos.x,
              top: tipPos.y,
              transform,
            }}
            className={cn(
              "pointer-events-none z-[1002] rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal leading-tight text-white shadow-md",
              multiline
                ? "max-w-[220px] whitespace-normal text-center"
                : "whitespace-nowrap",
            )}
            role="tooltip"
          >
            {label}
          </div>,
          window.document.body,
        )}
    </>
  );
}
