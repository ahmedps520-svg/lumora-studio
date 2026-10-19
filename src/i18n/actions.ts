"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./config";

/** Remember the chosen UI language for a year. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) throw new Error("Unsupported language");
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
