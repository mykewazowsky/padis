"use client";

import { Inbox } from "lucide-react";

type Props = {
  title?: string;
  message: string;
  actionHint?: string;
  compact?: boolean;
};

export default function DashboardEmptyState({
  title = "Belum ada data",
  message,
  actionHint,
  compact = false,
}: Props) {
  return (
    <div
      className={`flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 px-6 text-center ${
        compact ? "py-10" : "h-80"
      }`}
    >
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Inbox className="h-5 w-5 text-[var(--color-primary)]" />
        </div>

        <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>

        {actionHint ? (
          <p className="mt-3 text-xs font-medium text-gray-400">{actionHint}</p>
        ) : null}
      </div>
    </div>
  );
}