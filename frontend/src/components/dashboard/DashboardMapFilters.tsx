"use client";

import { useMemo, useState } from "react";
import Select from "react-select";
import type { StylesConfig, GroupBase } from "react-select";
import { ShieldAlert, Cloud, RefreshCw, MapPin } from "lucide-react";

type OptionType = {
  value: string;
  label: string;
  prov?: string; // untuk filterOption mencocokkan nama provinsi
};

type SelectStyles = StylesConfig<OptionType, false>;

type Props = {
  hazardOptions: OptionType[];
  climateOptions: OptionType[];
  scenarioOptions: OptionType[];
  regionOptions: GroupBase<OptionType>[];
  selectedHazardOption: OptionType | null;
  selectedClimateOption: OptionType | null;
  selectedScenarioOption: OptionType | null;
  selectedRegionOption: OptionType | null;
  loadingLayer: boolean;
  loadingRegions: boolean;
  errorRegions: string | null;
  onHazardChange: (value: string) => void;
  onClimateChange: (value: string) => void;
  onScenarioChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  selectStyles: SelectStyles;
  selectPortalStyles: SelectStyles;
  variant?: "card" | "inline";
};

const HAZARD_ACCENT: Record<string, string> = {
  flood:   "#1e63b5",
  drought: "#b45309",
  multi:   "#6d28d9",
};

function FilterLabel({
  icon: Icon,
  children,
  accentColor,
  inline,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  children: React.ReactNode;
  accentColor?: string;
  inline: boolean;
}) {
  const textCls = inline
    ? "flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-text-muted)]"
    : "flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-text-soft)]";

  return (
    <label className={textCls}>
      {accentColor ? (
        <span
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: `${accentColor}1f`, color: accentColor }}
        >
          <Icon size={10} strokeWidth={2.5} />
        </span>
      ) : (
        <span className="shrink-0 opacity-40">
          <Icon size={11} strokeWidth={2} />
        </span>
      )}
      {children}
    </label>
  );
}

function FilterFields({
  hazardOptions,
  climateOptions,
  scenarioOptions,
  regionOptions,
  selectedHazardOption,
  selectedClimateOption,
  selectedScenarioOption,
  selectedRegionOption,
  loadingLayer,
  loadingRegions,
  errorRegions,
  onHazardChange,
  onClimateChange,
  onScenarioChange,
  onRegionChange,
  onProvinceChange,
  selectStyles,
  selectPortalStyles,
  variant = "card",
}: Props) {
  const isInline = variant === "inline";
  const [activeField, setActiveField] = useState<string | null>(null);

  const hazardAccentColor =
    HAZARD_ACCENT[selectedHazardOption?.value ?? "multi"] ?? HAZARD_ACCENT.multi;

  const buildSelectStyles = useMemo(
    () => (fieldId: string): SelectStyles => ({
      ...selectStyles,
      ...selectPortalStyles,
      control: (base, state) => {
        const originalControl =
          typeof selectStyles.control === "function"
            ? selectStyles.control(base, state)
            : base;
        if (!isInline) {
          return originalControl;
        }
        const isActive = activeField === fieldId || state.menuIsOpen || state.isFocused;
        return {
          ...originalControl,
          minHeight: isInline ? 44 : originalControl.minHeight,
          borderRadius: isInline ? 10 : originalControl.borderRadius,
          borderColor: isInline
            ? isActive
              ? "var(--color-primary)"
              : "var(--dashboard-input-border)"
            : originalControl.borderColor,
          backgroundColor: isInline
            ? "var(--dashboard-input-bg)"
            : originalControl.backgroundColor,
          boxShadow: isActive
            ? "0 0 0 2px rgba(30,99,181,0.12)"
            : originalControl.boxShadow,
        };
      },
    }),
    [activeField, isInline, selectPortalStyles, selectStyles]
  );

  const getFieldClassName = (fieldId: string) =>
    isInline
      ? `space-y-1.5 rounded-lg border p-2.5 transition ${
          activeField === fieldId
            ? "border-[var(--color-primary)] bg-[var(--dashboard-active-surface)] shadow-sm"
            : "border-[var(--dashboard-border-soft)] bg-[var(--dashboard-surface-muted)]"
        }`
      : fieldId === "region"
        ? `min-w-0 rounded-lg border-t border-[var(--dashboard-border-solid)] px-2.5 py-2 transition-colors hover:bg-[var(--dashboard-control-bg)] md:border-t-0 xl:col-span-2 xl:border-l ${
            activeField === fieldId ? "bg-[var(--dashboard-control-bg)]" : ""
          }`
        : `min-w-0 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--dashboard-control-bg)] md:border-r md:border-[var(--dashboard-border-solid)] ${
            activeField === fieldId ? "bg-[var(--dashboard-control-bg)]" : ""
          }`;

  const handlers = (fieldId: string) => ({
    onFocus: () => setActiveField(fieldId),
    onBlur: () => setActiveField((prev) => (prev === fieldId ? null : prev)),
    onMenuOpen: () => setActiveField(fieldId),
    onMenuClose: () => setActiveField((prev) => (prev === fieldId ? null : prev)),
  });

  const portalProps = {
    menuPortalTarget: typeof window !== "undefined" ? document.body : null,
    menuPosition: "fixed" as const,
  };

  return (
    <div
      className={
        isInline
          ? "grid grid-cols-1 gap-3"
          : "grid grid-cols-1 gap-2 overflow-hidden rounded-xl border border-[var(--dashboard-border-solid)] bg-[linear-gradient(180deg,var(--dashboard-control-bg),var(--dashboard-surface-muted))] p-2 shadow-[0_8px_20px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.68)] md:grid-cols-2 xl:grid-cols-5"
      }
    >
      {/* Hazard */}
      <div className={getFieldClassName("hazard")}>
        <FilterLabel icon={ShieldAlert} accentColor={hazardAccentColor} inline={isInline}>
          Jenis Bencana
        </FilterLabel>
        <Select
          instanceId="hazard-select"
          options={hazardOptions}
          value={selectedHazardOption}
          onChange={(option) => onHazardChange(option?.value ?? "multi")}
          isSearchable={false}
          isDisabled={loadingLayer}
          styles={buildSelectStyles("hazard")}
          {...portalProps}
          {...handlers("hazard")}
        />
      </div>

      {/* Skenario (Baseline / Projection) */}
      <div className={getFieldClassName("climate")}>
        <FilterLabel icon={Cloud} inline={isInline}>
          Skenario Analisis
        </FilterLabel>
        <Select
          instanceId="climate-select"
          options={climateOptions}
          value={selectedClimateOption}
          onChange={(option) => onClimateChange(option?.value ?? "nonclimate")}
          isSearchable={false}
          isDisabled={loadingLayer}
          styles={buildSelectStyles("climate")}
          {...portalProps}
          {...handlers("climate")}
        />
      </div>

      {/* Periode ulang */}
      <div className={getFieldClassName("scenario")}>
        <FilterLabel icon={RefreshCw} inline={isInline}>
          Periode Ulang
        </FilterLabel>
        <Select
          instanceId="scenario-select"
          options={scenarioOptions}
          value={selectedScenarioOption}
          onChange={(option) => onScenarioChange(option?.value ?? "rp25")}
          isSearchable={false}
          isDisabled={loadingLayer}
          styles={buildSelectStyles("scenario")}
          {...portalProps}
          {...handlers("scenario")}
        />
      </div>

      {/* Region — grouped per provinsi */}
      <div className={getFieldClassName("region")}>
        <FilterLabel icon={MapPin} inline={isInline}>
          Provinsi / Kab./Kota
        </FilterLabel>
        <Select<OptionType, false, GroupBase<OptionType>>
          instanceId="region-select"
          options={regionOptions}
          value={selectedRegionOption}
          onChange={(option) => onRegionChange(option?.value ?? "")}
          formatGroupLabel={(group) => (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (group.label) onProvinceChange(group.label);
              }}
            >
              <MapPin size={10} strokeWidth={2.5} className="shrink-0 text-[var(--color-primary)]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)] hover:opacity-75">
                {group.label}
              </span>
            </button>
          )}
          filterOption={(option, inputValue) => {
            if (!inputValue) return true;
            const q = inputValue.toLowerCase();
            return (
              option.label.toLowerCase().includes(q) ||
              (option.data.prov?.toLowerCase().includes(q) ?? false)
            );
          }}
          isClearable
          isLoading={loadingRegions}
          isDisabled={loadingLayer}
          placeholder={loadingRegions ? "Memuat wilayah..." : "Pilih Provinsi / Kab./Kota..."}
          noOptionsMessage={() =>
            errorRegions
              ? errorRegions
              : loadingRegions
                ? "Memuat..."
                : "Tidak ada data wilayah"
          }
          styles={buildSelectStyles("region")}
          {...portalProps}
          {...handlers("region")}
        />
      </div>
    </div>
  );
}

export default function DashboardMapFilters(props: Props) {
  const { variant = "card" } = props;

  if (variant === "inline") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
            Filter
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--dashboard-text-muted)]">
            Atur tampilan analisis peta.
          </p>
        </div>
        <FilterFields {...props} />
      </div>
    );
  }

  return <FilterFields {...props} />;
}
