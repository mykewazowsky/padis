"use client";

import { useEffect, useState } from "react";

export type ChartTheme = {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMuted: string;
  tooltipShadow: string;
  selectedFill: string;
  reference: string;
};

const DEFAULT_CHART_THEME: ChartTheme = {
  axis: "#64748b",
  grid: "#e2e8f0",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e5e7eb",
  tooltipText: "#111827",
  tooltipMuted: "#6b7280",
  tooltipShadow: "0 10px 28px rgba(15, 23, 42, 0.1)",
  selectedFill: "#111827",
  reference: "#9ca3af",
};

function readCssVar(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function getChartTheme(): ChartTheme {
  if (typeof window === "undefined") return DEFAULT_CHART_THEME;

  const styles = window.getComputedStyle(document.documentElement);
  return {
    axis: readCssVar(styles, "--chart-axis-text", DEFAULT_CHART_THEME.axis),
    grid: readCssVar(styles, "--chart-grid", DEFAULT_CHART_THEME.grid),
    tooltipBg: readCssVar(styles, "--chart-tooltip-bg", DEFAULT_CHART_THEME.tooltipBg),
    tooltipBorder: readCssVar(styles, "--chart-tooltip-border", DEFAULT_CHART_THEME.tooltipBorder),
    tooltipText: readCssVar(styles, "--chart-tooltip-text", DEFAULT_CHART_THEME.tooltipText),
    tooltipMuted: readCssVar(styles, "--chart-tooltip-muted", DEFAULT_CHART_THEME.tooltipMuted),
    tooltipShadow: readCssVar(styles, "--chart-tooltip-shadow", DEFAULT_CHART_THEME.tooltipShadow),
    selectedFill: readCssVar(styles, "--chart-selected-fill", DEFAULT_CHART_THEME.selectedFill),
    reference: readCssVar(styles, "--chart-reference", DEFAULT_CHART_THEME.reference),
  };
}

export function useChartTheme() {
  const [theme, setTheme] = useState<ChartTheme>(DEFAULT_CHART_THEME);

  useEffect(() => {
    const syncTheme = () => setTheme(getChartTheme());
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
