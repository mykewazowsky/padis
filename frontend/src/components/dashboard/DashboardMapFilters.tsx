"use client";

import { useMemo, useState } from "react";
import Select from "react-select";

type OptionType = {
  value: string;
  label: string;
};

type SelectStyles = Record<string, any>;

type Props = {
  hazardOptions: OptionType[];
  climateOptions: OptionType[];
  scenarioOptions: OptionType[];
  regionOptions: OptionType[];
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
  selectStyles: SelectStyles;
  selectPortalStyles: SelectStyles;
  variant?: "card" | "inline";
};

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
  selectStyles,
  selectPortalStyles,
  variant = "card",
}: Props) {
  const isInline = variant === "inline";
  const [activeField, setActiveField] = useState<string | null>(null);

  const buildSelectStyles = useMemo(
    () => (fieldId: string) => ({
      ...selectStyles,
      ...selectPortalStyles,
      control: (base: any, state: any) => {
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
            ? (isActive ? "var(--color-primary)" : "var(--dashboard-input-border)")
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

  const getLabelClassName = () =>
    isInline
      ? "block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-text-muted)]"
      : "block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dashboard-text-soft)]";

  return (
    <div
      className={
        isInline
          ? "grid grid-cols-1 gap-3"
          : "grid grid-cols-1 gap-2 overflow-hidden rounded-xl border border-[var(--dashboard-border-solid)] bg-[linear-gradient(180deg,var(--dashboard-control-bg),var(--dashboard-surface-muted))] p-2 shadow-[0_8px_20px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.68)] md:grid-cols-2 xl:grid-cols-5"
      }
    >
      <div className={getFieldClassName("hazard")}>
        <label className={getLabelClassName()}>
          Jenis Bencana
        </label>
        <Select
          instanceId="hazard-select"
          options={hazardOptions}
          value={selectedHazardOption}
          onChange={(option) => onHazardChange(option?.value ?? "multi")}
          isSearchable={false}
          isDisabled={loadingLayer}
          styles={buildSelectStyles("hazard")}
          menuPortalTarget={typeof window !== "undefined" ? document.body : null}
          menuPosition="fixed"
          onFocus={() => setActiveField("hazard")}
          onBlur={() => setActiveField((prev) => (prev === "hazard" ? null : prev))}
          onMenuOpen={() => setActiveField("hazard")}
          onMenuClose={() => setActiveField((prev) => (prev === "hazard" ? null : prev))}
        />
      </div>

      <div className={getFieldClassName("climate")}>
        <label className={getLabelClassName()}>
          Skenario Analisis
        </label>
        <Select
          instanceId="climate-select"
          options={climateOptions}
          value={selectedClimateOption}
          onChange={(option) => onClimateChange(option?.value ?? "nonclimate")}
          isSearchable={false}
          isDisabled={loadingLayer}
          styles={buildSelectStyles("climate")}
          menuPortalTarget={typeof window !== "undefined" ? document.body : null}
          menuPosition="fixed"
          onFocus={() => setActiveField("climate")}
          onBlur={() => setActiveField((prev) => (prev === "climate" ? null : prev))}
          onMenuOpen={() => setActiveField("climate")}
          onMenuClose={() => setActiveField((prev) => (prev === "climate" ? null : prev))}
        />
      </div>

      <div className={getFieldClassName("scenario")}>
        <label className={getLabelClassName()}>
          Periode Ulang
        </label>
        <Select
          instanceId="scenario-select"
          options={scenarioOptions}
          value={selectedScenarioOption}
          onChange={(option) => onScenarioChange(option?.value ?? "rp25")}
          isSearchable={false}
          isDisabled={loadingLayer}
          styles={buildSelectStyles("scenario")}
          menuPortalTarget={typeof window !== "undefined" ? document.body : null}
          menuPosition="fixed"
          onFocus={() => setActiveField("scenario")}
          onBlur={() => setActiveField((prev) => (prev === "scenario" ? null : prev))}
          onMenuOpen={() => setActiveField("scenario")}
          onMenuClose={() => setActiveField((prev) => (prev === "scenario" ? null : prev))}
        />
      </div>

      <div className={getFieldClassName("region")}>
        <label className={getLabelClassName()}>
          Kabupaten/Kota
        </label>
        <Select
          instanceId="region-select"
          options={regionOptions}
          value={selectedRegionOption}
          onChange={(option) => onRegionChange(option?.value ?? "")}
          isClearable
          isLoading={loadingRegions}
          placeholder={loadingRegions ? "Memuat wilayah..." : "Pilih Kabupaten/Kota ..."}
          noOptionsMessage={() =>
            errorRegions
              ? errorRegions
              : loadingRegions
                ? "Memuat..."
                : "Tidak ada data wilayah"
          }
          styles={buildSelectStyles("region")}
          menuPortalTarget={typeof window !== "undefined" ? document.body : null}
          menuPosition="fixed"
          onFocus={() => setActiveField("region")}
          onBlur={() => setActiveField((prev) => (prev === "region" ? null : prev))}
          onMenuOpen={() => setActiveField("region")}
          onMenuClose={() => setActiveField((prev) => (prev === "region" ? null : prev))}
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
