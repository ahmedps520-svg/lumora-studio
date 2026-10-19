"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { errorKey, Notice, PasswordField, SubmitButton, TextField } from "./fields";

type Status = { tone: "error" | "success" | "info"; text: string } | null;

/** "Check your inbox" with a button to send the confirmation link again. */
function CheckInbox({ email, callbackURL }: { email: string; callbackURL: string }) {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-4 text-center" data-testid="check-inbox">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl btn-glow">
        <MailCheck className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">{t("checkInbox")}</h2>
      <p className="text-sm text-muted-foreground">{t("checkInboxBody", { email })}</p>
      <p className="text-xs text-muted-foreground">{t("checkSpam")}</p>
      <Button
        variant="outline"
        size="sm"
        disabled={sent}
        onClick={async () => {
          await authClient.sendVerificationEmail({ email, callbackURL });
          setSent(true);
        }}
      >
        {sent ? t("resent") : t("resend")}
      </Button>
    </div>
  );
}

export function SignupForm() {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [done, setDone] = useState<string | null>(null);
  const callbackURL = "/account?welcome=1";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    setBusy(true);
    setStatus(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email,
      password: String(form.get("password")),
      callbackURL,
    });
    setBusy(false);
    if (error) setStatus({ tone: "error", text: t(`errors.${errorKey(error)}`) });
    else setDone(email);
  };

  if (done) return <CheckInbox email={done} callbackURL={callbackURL} />;
  return (
    <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
      <TextField label={t("name")} name="name" autoComplete="name" required maxLength={80} />
      <TextField
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        dir="ltr"
        required
      />
      <PasswordField
        label={t("password")}
        name="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        hint={t("passwordHint")}
      />
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <SubmitButton busy={busy}>{t("signupButton")}</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setStatus(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
      callbackURL: next,
    });
    setBusy(false);
    if (!error) {
      router.push(next);
      router.refresh();
      return;
    }
    // Not confirmed yet: the server has just emailed a fresh link.
    if (error.code === "EMAIL_NOT_VERIFIED" || error.status === 403)
      setStatus({ tone: "info", text: t("notVerified") });
    else setStatus({ tone: "error", text: t(`errors.${errorKey(error)}`) });
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="login-form">
      <TextField
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        dir="ltr"
        required
      />
      <PasswordField
        label={t("password")}
        name="password"
        autoComplete="current-password"
        required
      />
      <div className="-mt-1 text-end">
        <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
          {t("forgot")}
        </Link>
      </div>
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <SubmitButton busy={busy}>{t("loginButton")}</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          {t("createOne")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy(true);
    setFailed(false);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setBusy(false);
    // The same answer whether or not there is an account (so nobody can probe addresses).
    if (error && error.status === 429) setFailed(true);
    else setSentTo(email);
  };

  if (sentTo)
    return (
      <div className="space-y-4">
        <Notice tone="success">{t("forgotSent", { email: sentTo })}</Notice>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
      <TextField
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        dir="ltr"
        required
      />
      {failed && <Notice tone="error">{t("errors.rateLimited")}</Notice>}
      <SubmitButton busy={busy}>{t("forgotButton")}</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [done, setDone] = useState(false);

  if (!token)
    return (
      <div className="space-y-4">
        <Notice tone="error">{t("resetInvalid")}</Notice>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">{t("askAgain")}</Link>
        </Button>
      </div>
    );
  if (done)
    return (
      <div className="space-y-4">
        <Notice tone="success">{t("resetDone")}</Notice>
        <Button asChild variant="brand" className="w-full">
          <Link href="/login">{t("login")}</Link>
        </Button>
      </div>
    );

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const { error } = await authClient.resetPassword({
      newPassword: String(new FormData(e.currentTarget).get("password")),
      token,
    });
    setBusy(false);
    if (!error) setDone(true);
    else if (error.code === "INVALID_TOKEN") setStatus({ tone: "error", text: t("resetInvalid") });
    else setStatus({ tone: "error", text: t(`errors.${errorKey(error)}`) });
  };

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
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
      <SubmitButton busy={busy}>{t("resetButton")}</SubmitButton>
    </form>
  );
}
