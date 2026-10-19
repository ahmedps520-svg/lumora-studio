import type en from "../../messages/en.json";
import type { Locale } from "./config";

// Makes every t("…") call type-checked against messages/en.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
