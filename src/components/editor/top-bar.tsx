"use client";

import { AlertCircle, Check, CloudUpload, Loader2, Redo2, Settings, Undo2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { editorActions } from "@/lib/store/actions";
import { selectCanRedo, selectCanUndo, useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";
import { DownloadButton } from "./download/download-button";
import { PresentButton } from "./present/present-button";

function DesignNameInput() {
  const t = useTranslations("editor");
  const name = useEditorStore((s) => s.design?.name ?? "");
  // Holds text only while editing; otherwise shows the stored name.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft.trim() && draft !== name) editorActions.renameDesign(draft);
    setDraft(null);
  };

  return (
    <input
      aria-label={t("designName")}
      data-testid="design-name"
      value={draft ?? name}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className="h-9 w-[min(40vw,22rem)] truncate rounded-lg border border-transparent bg-transparent px-2 font-medium outline-none hover:border-border focus-visible:border-ring"
    />
  );
}

function SaveStatus() {
  const t = useTranslations("editor.save");
  const saveState = useEditorStore((s) => s.saveState);
  const icon = {
    saved: <Check className="size-4" />,
    saving: <Loader2 className="size-4 animate-spin" />,
    unsaved: <CloudUpload className="size-4" />,
    error: <AlertCircle className="size-4" />,
  }[saveState];
  return (
    <span
      role="status"
      data-testid="save-status"
      data-state={saveState}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border bg-surface-2/60 px-3 text-xs font-medium text-muted-foreground",
        saveState === "saved" && "text-success",
        saveState === "error" && "border-destructive/40 text-destructive",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{t(saveState)}</span>
    </span>
  );
}

export function TopBar() {
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur-xl">
      {/* Brand hairline */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-[#F72585]/50 to-transparent"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/" aria-label={t("backHome")} className="rounded-lg p-1">
            <LogoMark className="size-8" decorative />
          </Link>
        </TooltipTrigger>
        <TooltipContent>{t("backHome")}</TooltipContent>
      </Tooltip>

      <DesignNameInput />

      <div className="ms-1 flex items-center gap-0.5 rounded-xl border bg-surface-2/60 p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("undo")}
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 className="rtl:-scale-x-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("undo")} (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("redo")}
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 className="rtl:-scale-x-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("redo")} (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <SaveStatus />
        <DownloadButton />
        <PresentButton />
        <span className="mx-1 h-5 w-px bg-border" />
        <LanguageSwitcher />
        <ThemeToggle />
        <Button asChild variant="ghost" size="icon" aria-label={tc("settings")}>
          <Link href="/settings">
            <Settings className="size-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
