import { Check, X, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useAppStore, filterSelectedEdits } from "../../store/appStore";
import { applyEdits } from "../../lib/ai/applyEdits";
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
      fullRewrite:
        pendingResponse.optionalFullRewrite &&
        editsToApply.length === pendingResponse.edits.length
          ? pendingResponse.optionalFullRewrite
          : undefined,
    });
    acceptEdits({ document: result.document, editIds: result.appliedEditIds });
  };

  return (
    <div className="border-t border-slate-200 bg-amber-50/70 px-4 py-3 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-amber-700" />
        <span className="font-medium text-amber-900">
          {pendingResponse.edits.length} proposed edit
          {pendingResponse.edits.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setAllEditsSelected(selectedCount === 0)}
          className="ml-auto text-xs text-amber-800 hover:underline"
        >
          {selectedCount === pendingResponse.edits.length ? "Unselect all" : "Select all"}
        </button>
      </div>

      <ul className="space-y-1.5">
        {pendingResponse.edits.map((edit) => (
          <li
            key={edit.id}
            className={cn(
              "flex items-start gap-2 rounded-md border border-amber-200 bg-white p-2",
            )}
          >
            <input
              type="checkbox"
              checked={Boolean(selected[edit.id])}
              onChange={() => toggleEditSelected(edit.id)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
                  {edit.type}
                </span>
                <span className="truncate font-mono">
                  {typeof edit.target === "string"
                    ? edit.target
                    : `${edit.target.start}–${edit.target.end}`}
                </span>
              </div>
              {edit.rationale && (
                <p className="mt-1 text-xs text-slate-700">{edit.rationale}</p>
              )}
              {edit.content && (
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-1.5 text-[11px] text-slate-800">
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
            "inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700",
            selectedCount === 0 && "cursor-not-allowed opacity-50",
          )}
        >
          <Check size={12} /> Accept {selectedCount > 0 ? `(${selectedCount})` : ""}
        </button>
        <button
          type="button"
          onClick={rejectEdits}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <X size={12} /> Reject all
        </button>
      </div>
    </div>
  );
}
