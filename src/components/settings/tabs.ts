/** The Settings tabs (shared by the server page and the client tabs). */
export const SETTINGS_TABS = ["general", "ai", "tools", "keys"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const isSettingsTab = (value: unknown): value is SettingsTab =>
  SETTINGS_TABS.includes(value as SettingsTab);
