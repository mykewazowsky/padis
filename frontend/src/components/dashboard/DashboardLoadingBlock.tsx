"use client";

import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  heightClass?: string;
  title?: string;
  description?: string;
};

export default function DashboardLoadingBlock({
  heightClass = "h-80",
  title,
  description,
}: Props) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t("dashboard.loading");
  const resolvedDesc  = description ?? t("dashboard.loadingDesc");

  return (
    <div
      className={`w-full rounded-2xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] p-5 shadow-sm ${heightClass}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="h-4 w-36 animate-pulse rounded bg-[var(--dashboard-border-solid)]" />
          <div className="mt-3 h-3 w-64 animate-pulse rounded bg-[var(--dashboard-border-soft)]" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-[var(--dashboard-border-soft)]" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-[var(--dashboard-border-soft)]" />
          <div className="h-4 w-9/12 animate-pulse rounded bg-[var(--dashboard-border-soft)]" />
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--dashboard-text)]">{resolvedTitle}</p>
          <p className="mt-1 text-sm text-[var(--dashboard-text-muted)]">{resolvedDesc}</p>
        </div>
      </div>
    </div>
  );
}
