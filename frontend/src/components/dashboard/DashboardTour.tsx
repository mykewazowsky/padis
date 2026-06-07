"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveABVariant, type ABVariant } from "@/lib/ab-variant";

const TOUR_KEY = "padis-tour-done";

type Props = {
  /** Parent calls this with the startTour fn so it can wire a trigger button. */
  onReady: (start: () => void) => void;
  /** Called once on mount so the parent knows which A/B variant is active. */
  onVariantDetected?: (variant: ABVariant) => void;
};

export default function DashboardTour({ onReady, onVariantDetected }: Props) {
  const { locale, t } = useLanguage();
  const destroyRef = useRef<(() => void) | null>(null);
  const variantRef = useRef<ABVariant>("b");

  async function startTour() {
    // Variant A never gets a tour — safety guard if called externally
    if (variantRef.current === "a") return;

    destroyRef.current?.();

    const { driver } = await import("driver.js");

    const driverObj = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: t("tour.btnNext"),
      prevBtnText: t("tour.btnPrev"),
      doneBtnText: t("tour.btnDone"),
      progressText: t("tour.progress"),
      steps: [
        {
          element: '[data-tour="filter-panel"]',
          popover: {
            title: t("tour.step1Title"),
            description: t("tour.step1Desc"),
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="quick-summary"]',
          popover: {
            title: t("tour.step2Title"),
            description: t("tour.step2Desc"),
            side: "bottom",
            align: "end",
          },
        },
        {
          element: '[data-tour="map"]',
          popover: {
            title: t("tour.step3Title"),
            description: t("tour.step3Desc"),
            side: "top",
            align: "start",
          },
        },
        {
          element: '[data-tour="charts"]',
          popover: {
            title: t("tour.step4Title"),
            description: t("tour.step4Desc"),
            side: "top",
            align: "start",
          },
        },
      ],
      onDestroyed: () => {
        try { localStorage.setItem(TOUR_KEY, "true"); } catch { /* ignore */ }
      },
    });

    destroyRef.current = () => driverObj.destroy();
    driverObj.drive();
  }

  // Detect variant and conditionally auto-start on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const variant = resolveABVariant();
    variantRef.current = variant;
    onVariantDetected?.(variant);

    // Variant A (Control): no auto-start, no tour at all
    if (variant === "a") return;

    // Variant B (Treatment): auto-start once for first-time desktop users
    if (window.innerWidth <= 767) return;
    try { if (localStorage.getItem(TOUR_KEY)) return; } catch { /* ignore */ }

    const timer = setTimeout(() => { void startTour(); }, 1800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep parent ref up-to-date when locale changes
  useEffect(() => {
    onReady(startTour);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { destroyRef.current?.(); };
  }, []);

  return null;
}
