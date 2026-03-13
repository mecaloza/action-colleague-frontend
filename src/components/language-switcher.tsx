"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "pt", label: "PT" },
] as const;

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const { locale, setLocale } = useLanguage();

  return (
    <div className="rounded-lg bg-white/[0.04] p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        <span>{t("label")}</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {OPTIONS.map((option) => {
          const isActive = locale === option.code;
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => setLocale(option.code)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                isActive
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-muted-foreground hover:bg-white/[0.06]"
              )}
              aria-label={t("switchTo", { locale: option.label })}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
