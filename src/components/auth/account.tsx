"use client";

import { LogIn, LogOut, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import { errorKey, Notice, PasswordField, SubmitButton } from "./fields";

function useSignOut() {
  const router = useRouter();
  const t = useTranslations("auth");
  return async () => {
    await authClient.signOut();
    toast.success(t("loggedOut"));
    router.push("/");
    router.refresh();
  };
}

const initial = (name: string, email: string) =>
  (name.trim() || email).charAt(0).toUpperCase() || "?";

/** Header button: "Log in", or the signed-in person's menu. */
export function AccountButton() {
  const t = useTranslations("auth");
  const { data, isPending } = authClient.useSession();
  const signOut = useSignOut();
  if (isPending) return <span className="size-9" aria-hidden />;
  if (!data)
    return (
      <Button asChild variant="ghost" size="sm" data-testid="nav-login">
        <Link href="/login">
          <LogIn className="rtl:-scale-x-100" />
          <span className="hidden sm:inline">{t("login")}</span>
        </Link>
      </Button>
    );
  const { user } = data;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("accountMenu")}
          data-testid="account-menu"
          className="rounded-full"
        >
          <span className="flex size-8 items-center justify-center rounded-full btn-glow text-sm font-semibold">
            {initial(user.name, user.email)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground" dir="ltr">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User /> {t("account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()} data-testid="logout">
          <LogOut className="rtl:-scale-x-100" /> {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignOutButton() {
  const t = useTranslations("auth");
  const signOut = useSignOut();
  return (
    <Button variant="outline" onClick={() => void signOut()} data-testid="logout">
      <LogOut className="rtl:-scale-x-100" /> {t("logout")}
    </Button>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setStatus(null);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("current")),
      newPassword: String(form.get("password")),
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) setStatus({ tone: "error", text: t(`errors.${errorKey(error)}`) });
    else {
      formEl.reset();
      setStatus({ tone: "success", text: t("passwordChanged") });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PasswordField
        label={t("currentPassword")}
        name="current"
        autoComplete="current-password"
        required
      />
      <PasswordField
        label={t("newPassword")}
        name="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        hint={t("passwordHint")}
      />
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <SubmitButton busy={busy}>{t("changePasswordButton")}</SubmitButton>
    </form>
  );
}

/** For when the current password is forgotten: a reset link to the account's own email. */
export function EmailResetLink({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span>{t("forgotCurrent")}</span>
      {state === "sent" ? (
        <span className="text-success" role="status">
          {t("resetLinkSent", { email })}
        </span>
      ) : (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          disabled={state === "busy"}
          data-testid="email-reset-link"
          onClick={async () => {
            setState("busy");
            const { error } = await authClient.requestPasswordReset({
              email,
              redirectTo: "/reset-password",
            });
            if (error) {
              setState("idle");
              toast.error(t(`errors.${errorKey(error)}`));
            } else setState("sent");
          }}
        >
          {t("emailResetLink")}
        </Button>
      )}
    </div>
  );
}

/** Sends a test email to the signed-in person (checks that Resend is set up). */
export function TestEmailButton({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      data-testid="test-email"
      onClick={async () => {
        setBusy(true);
        try {
          const response = await fetch("/api/email/test", { method: "POST" });
          const body = (await response.json().catch(() => ({}))) as {
            sent?: boolean;
            error?: string;
          };
          if (body.sent) toast.success(t("testEmailSent", { email }));
          else if (response.ok) toast.info(t("testEmailNotSent"));
          else if (response.status === 429) toast.error(t("errors.rateLimited"));
          else toast.error(t("testEmailFailed"));
        } catch {
          toast.error(t("errors.generic"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Mail /> {t("testEmail")}
    </Button>
  );
}
