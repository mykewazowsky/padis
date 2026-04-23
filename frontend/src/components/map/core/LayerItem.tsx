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
};

export default function LayerItem({
  id,
  label,
  visible,
  opacity,
  onToggle,
  onOpacityChange,
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
      className={`rounded-md bg-white border px-2 py-1.5 ${
        isDragging
          ? "border-[var(--color-primary)] shadow-md opacity-80"
          : "border-transparent hover:border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-gray-300 hover:text-gray-500 touch-none flex-shrink-0"
          {...attributes}
          {...listeners}
          aria-label={`Seret untuk mengubah urutan ${label}`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <span className="flex-1 text-[12px] text-gray-700 select-none">
          {label}
        </span>

        <input
          type="checkbox"
          checked={visible}
          onChange={onToggle}
          className="h-4 w-4 accent-[var(--color-primary)] flex-shrink-0"
        />
      </div>

      {visible && (
        <div className="mt-1.5 flex items-center gap-2 pl-6 pr-0.5">
          <span className="text-[10px] text-gray-400 flex-shrink-0">
            Opacity
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
            className="flex-1 h-1 accent-[var(--color-primary)] cursor-pointer"
          />
          <span className="text-[10px] text-gray-500 w-7 text-right flex-shrink-0">
            {Math.round(opacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
