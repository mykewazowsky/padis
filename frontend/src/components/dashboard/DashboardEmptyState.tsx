"use client";

import { Inbox } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  title?: string;
  message: string;
  actionHint?: string;
  compact?: boolean;
};

export default function DashboardEmptyState({
  title,
  message,
  actionHint,
  compact = false,
}: Props) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t("dashboard.noDataDefault");

  return (
    <div
      className={`flex w-full items-center justify-center rounded-2xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-muted)] px-6 text-center ${
        compact ? "py-10" : "h-80"
      }`}
    >
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--dashboard-surface-solid)] shadow-sm">
          <Inbox className="h-5 w-5 text-[var(--color-primary)]" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-[var(--dashboard-text)]">{resolvedTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--dashboard-text-muted)]">{message}</p>

        {actionHint ? (
          <p className="mt-3 text-xs font-medium text-[var(--dashboard-text-soft)]">{actionHint}</p>
        ) : null}
      </div>
    </div>
  );
}
