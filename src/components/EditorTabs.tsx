import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { Plus, X } from "lucide-react";
import { useAppStore, type Conversation } from "../store/appStore";
import { cn } from "../lib/utils";

const MOD_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)
    ? "Cmd"
    : "Ctrl";

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

interface DragState {
  sourceId: string;
  overId: string | null;
  position: "before" | "after";
}

// Fire this after every programmatic tab creation so AiChatPanel auto-focuses
// its prompt textarea.
function emitFocusPrompt() {
  window.dispatchEvent(new CustomEvent("slackbuilder:focus-prompt"));
}

export function EditorTabs() {
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const createConversation = useAppStore((s) => s.createConversation);
  const switchConversation = useAppStore((s) => s.switchConversation);
  const deleteConversation = useAppStore((s) => s.deleteConversation);
  const renameConversation = useAppStore((s) => s.renameConversation);
  const reorderConversations = useAppStore((s) => s.reorderConversations);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const tabs = activeProject?.conversations ?? [];
  const activeTabId = activeProject?.activeConversationId ?? "";
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const updateDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () => {
      setIsOverflowing(scroller.scrollWidth > scroller.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [tabs.length]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const requestClose = (tab: Conversation) => {
    if (hasEditorContent(tab.document)) {
      setPendingDelete(tab);
      return;
    }
    deleteConversation(tab.id);
  };

  const startRename = (tab: Conversation) => {
    setRenamingTabId(tab.id);
    setRenameDraft(tab.title);
  };

  const commitRename = () => {
    if (renamingTabId) {
      const trimmed = renameDraft.trim();
      if (trimmed) renameConversation(renamingTabId, trimmed);
    }
    setRenamingTabId(null);
    setRenameDraft("");
  };

  const cancelRename = () => {
    setRenamingTabId(null);
    setRenameDraft("");
  };

  const applyReorder = (
    sourceId: string,
    targetId: string,
    position: "before" | "after",
  ) => {
    if (sourceId === targetId) return;
    const ids = tabs.map((tab) => tab.id);
    const fromIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || targetIndex === -1) return;
    ids.splice(fromIndex, 1);
    let insertIndex = ids.indexOf(targetId);
    if (insertIndex === -1) insertIndex = targetIndex;
    if (position === "after") insertIndex += 1;
    ids.splice(insertIndex, 0, sourceId);
    reorderConversations(ids);
  };

  const handleCreateConversation = () => {
    createConversation();
    emitFocusPrompt();
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        handleCreateConversation();
      } else if (key === "w") {
        event.preventDefault();
        if (activeTab) requestClose(activeTab);
      } else if (/^[1-9]$/.test(event.key)) {
        if (pendingDelete) return;
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.closest("input, textarea, select") !== null
        ) {
          return;
        }
        const index = Number(event.key) - 1;
        const tab = tabs[index];
        if (!tab || tab.id === activeTabId) return;
        event.preventDefault();
        switchConversation(tab.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    activeTab,
    activeTabId,
    createConversation,
    pendingDelete,
    switchConversation,
    tabs,
  ]);

  const addButton = (variant: "inline" | "pinned") => (
    <button
      type="button"
      onClick={handleCreateConversation}
      className={cn(
        "mb-px inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700",
        variant === "pinned" && "ml-1",
      )}
      title={`New tab (${MOD_LABEL}+T)`}
      aria-label="New tab"
    >
      <Plus size={14} />
    </button>
  );

  return (
    <>
      <div className="flex min-h-9 items-end border-b border-slate-200 bg-slate-100/80 px-2 pt-1.5">
        <div
          ref={scrollerRef}
          className="no-scrollbar flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
          onDragOver={(event) => {
            if (dragRef.current) event.preventDefault();
          }}
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;
            const isRenaming = renamingTabId === tab.id;
            const showLeftMarker =
              drag?.overId === tab.id &&
              drag.position === "before" &&
              drag.sourceId !== tab.id;
            const showRightMarker =
              drag?.overId === tab.id &&
              drag.position === "after" &&
              drag.sourceId !== tab.id;
            return (
              <div
                key={tab.id}
                className="relative flex shrink-0 items-end"
                draggable={!isRenaming}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", tab.id);
                  updateDrag({
                    sourceId: tab.id,
                    overId: tab.id,
                    position: "after",
                  });
                }}
                onDragEnter={(event) => {
                  if (dragRef.current) event.preventDefault();
                }}
                onDragOver={(event) => {
                  const current = dragRef.current;
                  if (!current) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const rect = event.currentTarget.getBoundingClientRect();
                  const position: "before" | "after" =
                    event.clientX - rect.left < rect.width / 2
                      ? "before"
                      : "after";
                  if (
                    current.overId !== tab.id ||
                    current.position !== position
                  ) {
                    updateDrag({ ...current, overId: tab.id, position });
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const current = dragRef.current;
                  const sourceId =
                    event.dataTransfer.getData("text/plain") ||
                    current?.sourceId;
                  const position = current?.position ?? "after";
                  if (sourceId) {
                    applyReorder(sourceId, tab.id, position);
                  }
                  updateDrag(null);
                }}
                onDragEnd={() => updateDrag(null)}
              >
                <div
                  className={cn(
                    "group flex max-w-52 items-center gap-1 rounded-t-md border text-xs transition-colors",
                    active
                      ? "border-slate-200 border-b-white bg-white text-slate-900 shadow-sm"
                      : "border-transparent bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800",
                    drag?.sourceId === tab.id && "opacity-50",
                  )}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu({
                      tabId: tab.id,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    startRename(tab);
                  }}
                >
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => switchConversation(tab.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !isRenaming) {
                        event.preventDefault();
                        startRename(tab);
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-3 pr-1 text-left"
                    title={`${tab.title} — press Enter to rename`}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                        active && "bg-violet-500",
                        !active &&
                          tab.isStreaming &&
                          "animate-pulse bg-violet-400",
                        !active && !tab.isStreaming && "bg-slate-300",
                      )}
                    />
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRename();
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                        className="min-w-0 flex-1 bg-transparent outline-none"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate">
                        {tab.title}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestClose(tab);
                    }}
                    className="mr-1 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                    aria-label={`Close ${tab.title}`}
                    title={`Close (${MOD_LABEL}+W)`}
                  >
                    <X size={11} />
                  </button>
                </div>
                {showLeftMarker && <DropMarker side="left" />}
                {showRightMarker && <DropMarker side="right" />}
              </div>
            );
          })}
          {!isOverflowing && addButton("inline")}
        </div>
        {isOverflowing && addButton("pinned")}
      </div>

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => {
            const tab = tabs.find((item) => item.id === contextMenu.tabId);
            if (tab) startRename(tab);
            setContextMenu(null);
          }}
          onClose={() => {
            const tab = tabs.find((item) => item.id === contextMenu.tabId);
            if (tab) requestClose(tab);
            setContextMenu(null);
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteTabModal
          tab={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteConversation(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}

function DropMarker({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-0 h-6 w-0.5 rounded bg-violet-500",
        side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
      )}
    />
  );
}

interface TabContextMenuProps {
  x: number;
  y: number;
  onRename: () => void;
  onClose: () => void;
}

function TabContextMenu({ x, y, onRename, onClose }: TabContextMenuProps) {
  return (
    <div
      role="menu"
      style={{ position: "fixed", top: y, left: x }}
      className="z-50 min-w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onRename}
        className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
      >
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onClose}
        className="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50"
      >
        Close tab
      </button>
    </div>
  );
}

interface ConfirmDeleteTabModalProps {
  tab: Conversation;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDeleteTabModal({
  tab,
  onCancel,
  onConfirm,
}: ConfirmDeleteTabModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      } else if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-[380px] rounded-xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-900">Close tab?</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">&ldquo;{tab.title}&rdquo;</span>{" "}
          has editor content. Closing it cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function hasEditorContent(doc: JSONContent): boolean {
  if (typeof doc.text === "string" && doc.text.trim().length > 0) return true;
  if (doc.type && !["doc", "paragraph", "text"].includes(doc.type)) return true;
  return doc.content?.some(hasEditorContent) ?? false;
}
