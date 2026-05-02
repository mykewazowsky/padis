"use client";
import { ArrowRight } from "lucide-react";
import { useInView } from "@/hooks/useInView";

type PipelineItem = {
  step: string;
  title: string;
  desc: string;
};

export default function AnimatedPipelineSteps({ items }: { items: PipelineItem[] }) {
  const { ref, inView } = useInView();

  return (
    <div ref={ref} className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <article
            key={item.step}
            className={`relative group reveal ${inView ? "in-view" : ""}`}
            style={{ transitionDelay: `${index * 100}ms` }}
          >
            <div
              className={`relative h-full overflow-hidden rounded-3xl border p-5 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg ${
                isLast
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                  : "border-[var(--color-border)] bg-[var(--content-surface)] shadow-[var(--shadow-soft)]"
              }`}
            >
              <span className={`pointer-events-none absolute right-3 top-2 select-none text-6xl font-black leading-none ${
                isLast ? "text-white/10" : "text-[var(--color-text)]/[0.08]"
              }`}>
                {item.step}
              </span>

              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 group-hover:scale-110 ${
                  isLast
                    ? "border border-white/30 bg-white/20 text-white"
                    : "border border-[rgba(30,99,181,0.22)] bg-[rgba(30,99,181,0.14)] text-[var(--color-primary)]"
                }`}>
                  {item.step}
                </span>
              </div>

              <h3 className={`mt-4 text-base font-semibold md:text-lg ${
                isLast
                  ? "text-white"
                  : "text-heading transition-colors duration-300 group-hover:text-[var(--color-primary)]"
              }`}>
                {item.title}
              </h3>

              <p className={`mt-2 text-sm leading-relaxed ${
                isLast ? "text-white/80" : "text-muted"
              }`}>
                {item.desc}
              </p>
            </div>

            {index < items.length - 1 && (
              <div className="absolute -right-6 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--content-surface)] shadow-md">
                  <ArrowRight className="h-3 w-3 text-muted" />
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
