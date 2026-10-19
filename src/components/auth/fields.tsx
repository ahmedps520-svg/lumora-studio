"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
  id,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TextField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <Input id={id} className="h-11 rounded-xl" {...props} />
    </Field>
  );
}

/** A password box with a show/hide button. */
export function PasswordField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & ComponentProps<typeof Input>) {
  const t = useTranslations("auth");
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} id={id}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className="h-11 rounded-xl pe-11"
          dir="ltr"
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute end-1.5 top-1/2 -translate-y-1/2"
          aria-label={visible ? t("hide") : t("show")}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </Field>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  const t = useTranslations("auth");
  return (
    <Button
      type="submit"
      variant="brand"
      className="h-11 w-full rounded-xl"
      disabled={busy}
      data-testid="auth-submit"
    >
      {busy && <Loader2 className="animate-spin" />}
      {busy ? t("working") : children}
    </Button>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-testid={`auth-${tone}`}
      className={cn(
        "rounded-xl px-3.5 py-2.5 text-sm",
        tone === "error" && "bg-destructive/10 text-destructive",
        tone === "success" && "bg-success/10 text-success",
        tone === "info" && "bg-muted text-foreground",
      )}
    >
      {children}
    </p>
  );
}

type ErrorKey = "invalid" | "exists" | "weak" | "wrongPassword" | "rateLimited" | "generic";

/** A friendly message key for an error from the accounts service. */
export function errorKey(error: { code?: string; status?: number } | null | undefined): ErrorKey {
  const code = error?.code ?? "";
  if (error?.status === 429) return "rateLimited";
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "invalid";
  if (code === "INVALID_PASSWORD") return "wrongPassword";
  if (code.startsWith("USER_ALREADY_EXISTS")) return "exists";
  if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") return "weak";
  return "generic";
}
