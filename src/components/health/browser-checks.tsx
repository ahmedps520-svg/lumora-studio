"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { StatusRow, type Status } from "./status-row";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Opens (and removes) a throw-away IndexedDB database to prove storage works. */
async function checkIndexedDb(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const name = "lumora-health-check";
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(name, 1);
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase(name);
        resolve(true);
      };
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function checkCanvas(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("2d"));
  } catch {
    return false;
  }
}

export function BrowserChecks() {
  const t = useTranslations("health");
  const [indexedDbOk, setIndexedDbOk] = useState<boolean | null>(null);
  const [canvasOk, setCanvasOk] = useState<boolean | null>(null);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [dir, setDir] = useState<string | null>(null);
  const locale = useLocale();

  useEffect(() => {
    let cancelled = false;
    checkIndexedDb().then((ok) => !cancelled && setIndexedDbOk(ok));
    // Runs once after mount; these values only exist in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanvasOk(checkCanvas());
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-read the page direction whenever the language changes (no full reload happens).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDir(document.documentElement.dir || "ltr");
  }, [locale]);

  const status = (v: boolean | null): Status => (v === null ? "pending" : v ? "ok" : "fail");
  const label = (v: boolean | null) =>
    v === null ? t("checking") : v ? t("ok") : t("unavailable");

  return (
    <ul className="divide-y" data-testid="browser-checks">
      <StatusRow
        label={t("indexedDb")}
        value={label(indexedDbOk)}
        status={status(indexedDbOk)}
        testId="check-indexeddb"
      />
      <StatusRow
        label={t("canvas")}
        value={label(canvasOk)}
        status={status(canvasOk)}
        testId="check-canvas"
      />
      <StatusRow
        label={t("network")}
        value={online ? t("online") : t("offline")}
        status={online ? "ok" : "off"}
        testId="check-network"
      />
      <StatusRow
        label={t("direction")}
        value={dir === null ? t("checking") : dir === "rtl" ? t("rtl") : t("ltr")}
        status={dir === null ? "pending" : "ok"}
      />
    </ul>
  );
}
