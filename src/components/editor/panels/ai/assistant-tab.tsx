"use client";

import { ArrowUp, Check, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { AiError, CostHint } from "@/components/ai/ai-bits";
import { useAiRun } from "@/components/ai/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { aiAssistant } from "@/lib/ai/api";
import type { AssistantAction } from "@/lib/ai/assistant-tools";
import { summarizePage } from "@/lib/ai/scene-summary";
import { useAiSettings } from "@/lib/ai/settings-store";
import { editorActions } from "@/lib/store/actions";
import { selectCurrentPage, useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";

interface ChatTurn {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** Pending (not yet applied) actions, when auto-apply is off. */
  pending?: AssistantAction[];
  applied?: number;
  skipped?: number;
  /** History length right after this turn's edit — lets us undo exactly it. */
  historyMark?: number;
  undone?: boolean;
}

interface ChatState {
  turns: ChatTurn[];
  add: (turn: Omit<ChatTurn, "id">) => number;
  patch: (id: number, patch: Partial<ChatTurn>) => void;
  clear: () => void;
}

let nextId = 1;
/** Chat survives switching panels (but not reloading the editor). */
const useChat = create<ChatState>()((set) => ({
  turns: [],
  add: (turn) => {
    const id = nextId++;
    set((s) => ({ turns: [...s.turns, { ...turn, id }] }));
    return id;
  },
  patch: (id, patch) =>
    set((s) => ({ turns: s.turns.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  clear: () => set({ turns: [] }),
}));

const EXAMPLES = ["bigger", "cta", "warm", "center", "minimal"] as const;

function applyActions(actions: AssistantAction[]) {
  const result = editorActions.applyAssistant(actions);
  return { ...result, historyMark: useEditorStore.getState().past.length };
}

export function AssistantTab() {
  const t = useTranslations("ai.assistant");
  const { turns, add, patch, clear } = useChat();
  const autoApply = useAiSettings((s) => s.assistantAutoApply);
  // Re-render when history changes so "Undo AI changes" hides once other edits happen.
  const pastLength = useEditorStore((s) => s.past.length);
  const [message, setMessage] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const { run, loading, error } = useAiRun(async (signal, text: string) => {
    const state = useEditorStore.getState();
    const page = selectCurrentPage(state);
    if (!state.design || !page) return null;
    const history = useChat
      .getState()
      .turns.slice(-8)
      .map((turn) => ({ role: turn.role, text: turn.text }));
    return aiAssistant(
      {
        message: text,
        history,
        scene: summarizePage(page, state.design.format, state.selection),
        selection: state.selection,
        format: { width: state.design.format.width, height: state.design.format.height },
      },
      signal,
    );
  });

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessage("");
    add({ role: "user", text: trimmed });
    const result = await run(trimmed);
    if (!result) return;
    if (result.actions.length === 0) {
      add({ role: "assistant", text: result.reply || t("noChanges") });
      return;
    }
    if (autoApply) {
      const applied = applyActions(result.actions);
      add({
        role: "assistant",
        text: result.reply || t("applied", { count: applied.applied }),
        applied: applied.applied,
        skipped: applied.skipped + result.rejected,
        historyMark: applied.historyMark,
      });
    } else {
      add({
        role: "assistant",
        text: result.reply,
        pending: result.actions,
        skipped: result.rejected,
      });
    }
  };

  const undoTurn = (turn: ChatTurn) => {
    const store = useEditorStore.getState();
    // Only undo if this AI edit is still the latest change.
    if (turn.historyMark === store.past.length && store.past.at(-1)?.label === "assistant") {
      store.undo();
      patch(turn.id, { undone: true });
    }
  };

  const canUndo = (turn: ChatTurn) =>
    !turn.undone && turn.historyMark !== undefined && turn.historyMark === pastLength;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={logRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-1"
        aria-live="polite"
      >
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("intro")}</p>
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {t("suggestions")}
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void send(t(`examples.${key}`))}
                  className="rounded-xl surface-card px-3 py-2 text-start text-sm transition-all hover:-translate-y-0.5 hover:shadow-soft"
                >
                  {t(`examples.${key}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div
            key={turn.id}
            className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[92%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm",
                turn.role === "user"
                  ? "rounded-ee-md bg-primary text-primary-foreground"
                  : "rounded-es-md surface-card",
              )}
            >
              {turn.role === "assistant" && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Sparkles className="size-3.5 text-[#F72585]" /> {t("lumora")}
                </div>
              )}
              <p className="whitespace-pre-wrap" dir="auto">
                {turn.text}
              </p>
              {turn.applied !== undefined && turn.applied > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" />
                    {turn.undone ? t("undone") : t("applied", { count: turn.applied })}
                  </span>
                  {canUndo(turn) && (
                    <Button variant="outline" size="xs" onClick={() => undoTurn(turn)}>
                      <RotateCcw /> {t("undo")}
                    </Button>
                  )}
                </div>
              )}
              {turn.pending && (
                <Button
                  size="xs"
                  variant="brand"
                  onClick={() => {
                    const applied = applyActions(turn.pending!);
                    patch(turn.id, {
                      pending: undefined,
                      applied: applied.applied,
                      skipped: (turn.skipped ?? 0) + applied.skipped,
                      historyMark: applied.historyMark,
                    });
                  }}
                >
                  {t("apply")} · {t("pending", { count: turn.pending.length })}
                </Button>
              )}
              {turn.skipped ? (
                <p className="text-xs text-muted-foreground">
                  {t("skipped", { count: turn.skipped })}
                </p>
              ) : null}
            </div>
          </div>
        ))}

        {loading && (
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-es-md surface-card px-3.5 py-2.5 text-sm text-muted-foreground">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-[#F72585]"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </span>
            {t("thinking")}
          </div>
        )}
        {error && <AiError message={error} />}
      </div>

      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(message);
        }}
      >
        <div className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(message);
              }
            }}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            maxLength={2_000}
            rows={3}
            className="min-h-20 resize-none rounded-xl pe-12"
            data-testid="assistant-input"
          />
          <Button
            type="submit"
            size="icon-sm"
            variant="brand"
            aria-label={t("send")}
            disabled={!message.trim() || loading}
            className="absolute end-2 bottom-2 rounded-full"
          >
            <ArrowUp />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <CostHint task="assistant" chars={message.length + 2_500} />
          {turns.length > 0 && (
            <Button type="button" variant="ghost" size="xs" onClick={clear}>
              <Trash2 /> {t("clear")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
