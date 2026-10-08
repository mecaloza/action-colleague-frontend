import { http } from "./client";
import type { CertificateSettings, EvaluationDefaults, GeneralSettings, PlatformSettings, RankingSettings } from "./types";

/** What a save changes: only the keys sent, section by section (null empties the validity and the minimum score). */
export interface SettingsPatch {
  general?: Partial<GeneralSettings>;
  evaluations?: Partial<EvaluationDefaults>;
  certificates?: Partial<CertificateSettings>;
  ranking?: Partial<RankingSettings>;
}

export const settingsApi = {
  /** Every parameter, with its default when it was never changed. */
  get: () => http.get<PlatformSettings>("/settings"),
  /** Returns them all; a wrong value answers 422 saying which one, in Spanish. */
  update: (patch: SettingsPatch) => http.patch<PlatformSettings>("/settings", patch),
};

export const settingsKeys = {
  all: ["settings"] as const,
};
