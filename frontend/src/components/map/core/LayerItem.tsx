"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { LayerKey } from "./MapLegendPanel";

type Props = {
  id: LayerKey;
  label: string;
  visible: boolean;
  opacity: number;
  onToggle: () => void;
  onOpacityChange: (opacity: number) => void;
  disabled?: boolean;
  disabledReason?: string;
};

export default function LayerItem({
  id,
  label,
  visible,
  opacity,
  onToggle,
  onOpacityChange,
  disabled = false,
  disabledReason,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      title={disabled ? disabledReason : undefined}
      className={`rounded-md bg-[var(--dashboard-surface-solid)] border px-2 py-1.5 transition-opacity ${
        isDragging
          ? "border-[var(--color-primary)] shadow-md opacity-80"
          : "border-transparent hover:border-[var(--dashboard-border-solid)]"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`touch-none flex-shrink-0 text-[var(--dashboard-text-soft)] ${
            disabled
              ? "cursor-not-allowed"
              : "cursor-grab hover:text-[var(--dashboard-text-muted)]"
          }`}
          {...(disabled ? {} : { ...attributes, ...listeners })}
          aria-label={`Seret untuk mengubah urutan ${label}`}
          disabled={disabled}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <span className="flex-1 text-[12px] text-[var(--dashboard-text)] select-none">
          {label}
        </span>

        <input
          type="checkbox"
          checked={visible}
          onChange={disabled ? undefined : onToggle}
          disabled={disabled}
          className={`h-4 w-4 flex-shrink-0 accent-[var(--color-primary)] ${
            disabled ? "cursor-not-allowed" : ""
          }`}
        />
      </div>

      {visible && !disabled && (
        <div className="mt-1.5 flex items-center gap-2 pl-6 pr-1">
          <span className="text-[10px] text-[var(--dashboard-text-soft)] flex-shrink-0">
            Opacity
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
            className="min-w-0 flex-1 h-1 accent-[var(--color-primary)] cursor-pointer"
          />
          <span className="w-8 flex-shrink-0 text-right text-[10px] tabular-nums text-[var(--dashboard-text-muted)]">
            {Math.round(opacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
