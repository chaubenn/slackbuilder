import { Check, X, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useAppStore, filterSelectedEdits } from "../../store/appStore";
import { applyEdits } from "../../lib/ai/applyEdits";
import { shouldUseOptionalFullRewrite } from "../../lib/ai/applyEditsHelpers";
import { cn } from "../../lib/utils";

export function PendingEditCard() {
  const pendingResponse = useAppStore((s) => s.pendingResponse);
  const selected = useAppStore((s) => s.pendingSelectedEditIds);
  const document = useAppStore((s) => s.document);
  const toggleEditSelected = useAppStore((s) => s.toggleEditSelected);
  const setAllEditsSelected = useAppStore((s) => s.setAllEditsSelected);
  const acceptEdits = useAppStore((s) => s.acceptEdits);
  const rejectEdits = useAppStore((s) => s.rejectEdits);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  if (!pendingResponse || pendingResponse.edits.length === 0) return null;

  const onAcceptAll = () => {
    const editsToApply = filterSelectedEdits(pendingResponse, selected);
    if (editsToApply.length === 0) return;
    const result = applyEdits(document, editsToApply, {
      fullRewrite: shouldUseOptionalFullRewrite(
        pendingResponse.optionalFullRewrite,
        editsToApply,
        pendingResponse.edits.length,
      )
        ? pendingResponse.optionalFullRewrite
        : undefined,
    });
    acceptEdits({ document: result.document, editIds: result.appliedEditIds });
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={13} className="text-violet-500" />
        <span className="font-medium text-slate-800">
          {pendingResponse.edits.length} proposed edit
          {pendingResponse.edits.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setAllEditsSelected(selectedCount === 0)}
          className="ml-auto text-xs text-slate-400 hover:text-violet-600 hover:underline transition-colors"
        >
          {selectedCount === pendingResponse.edits.length
            ? "Unselect all"
            : "Select all"}
        </button>
      </div>

      <ul className="space-y-1.5">
        {pendingResponse.edits.map((edit) => (
          <li
            key={edit.id}
            className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
          >
            <input
              type="checkbox"
              checked={Boolean(selected[edit.id])}
              onChange={() => toggleEditSelected(edit.id)}
              className="mt-0.5 accent-violet-600"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-600">
                  {edit.type}
                </span>
                <span className="truncate font-mono">
                  {edit.type === "move" && edit.destination ? (
                    <>
                      {typeof edit.target === "string"
                        ? edit.target
                        : `${edit.target.start}–${edit.target.end}`}
                      {" → "}
                      {typeof edit.destination === "string"
                        ? edit.destination
                        : `${edit.destination.start}–${edit.destination.end}`}
                    </>
                  ) : typeof edit.target === "string" ? (
                    edit.target
                  ) : (
                    `${edit.target.start}–${edit.target.end}`
                  )}
                </span>
              </div>
              {edit.rationale && (
                <p className="mt-1 text-xs text-slate-600">{edit.rationale}</p>
              )}
              {edit.content && (
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-1.5 text-[11px] text-slate-700 ring-1 ring-slate-100">
                  {edit.content}
                </pre>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onAcceptAll}
          disabled={selectedCount === 0}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700",
            selectedCount === 0 && "cursor-not-allowed opacity-50",
          )}
        >
          <Check size={12} />
          Accept{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </button>
        <button
          type="button"
          onClick={rejectEdits}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <X size={12} />
          Dismiss
        </button>
      </div>
    </div>
  );
}
