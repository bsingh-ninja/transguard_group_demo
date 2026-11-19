"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import CoverageMap from "@/components/CoverageMap";
import { FindCoverSheet, PlanSheet } from "@/components/CoverSheets";
import { ErrorBox, Figure, Loading } from "@/components/ui";
import { Gap, getJSON, Overview, postJSON, Site } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function Tonight() {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [data, setData] = useState<Overview | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Gap | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([getJSON<Overview>("/transguard/overview"), getJSON<Gap[]>("/transguard/gaps")])
      .then(([o, g]) => {
        setData(o);
        setGaps(g);
      })
      .catch((e) => setError(String(e.message)));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const { totals } = data;
  const pickSite = (s: Site) => {
    const g = gaps.find((x) => x.site_id === s.id);
    if (g) setOpen(g);
  };

  return (
    <div className="space-y-8">
      <section className="grid items-end gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="label">{t.tonightLabel}</p>
          <h1 className="display mt-2 max-w-[24ch] text-ink">{t.headline(totals.vacancies, totals.at_risk)}</h1>
        </div>
        <dl className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-4">
          <Figure label={t.coverage} value={totals.coverage_pct} decimals={1} suffix="%" />
          <Figure label={t.expected} value={totals.expected_coverage_pct} decimals={1} suffix="%" tone={totals.expected_coverage_pct < 97 ? "warn" : undefined} />
          <Figure label={t.onShift} value={totals.assigned} unit={`${t.of} ${totals.required}`} />
          <Figure label={t.sites} value={totals.sites} />
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <CoverageMap data={data} onPick={pickSite} />

        <section aria-labelledby="actions" className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="actions" className="title text-ink">
              {t.needsAction}
            </h2>
            {gaps.length > 0 && (
              <button onClick={() => setPlanOpen(true)} className="h-10 rounded-xl bg-primary px-4 text-[0.875rem] font-semibold text-primary-fg">
                {t.fillAll}
              </button>
            )}
          </div>
          {gaps.length === 0 ? (
            <p className="panel p-6 text-[0.9375rem] text-muted">{t.allClear}</p>
          ) : (
            <ul className="panel overflow-hidden">
              <AnimatePresence initial={false}>
              {gaps.map((g) => (
                <motion.li
                  key={g.key}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 48, height: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  className={`flex items-center gap-3 overflow-hidden border-s-[3px] border-t border-t-hairline px-4 py-3.5 first:border-t-0 ${g.kind === "vacancy" ? "border-s-crit" : "border-s-warn"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className={`text-[0.75rem] font-bold ${g.kind === "vacancy" ? "text-crit" : "text-warn"}`}>
                      {g.kind === "vacancy" ? t.vacancy : t.atRisk}
                    </div>
                    <div className="truncate font-semibold text-ink">{g.site}</div>
                    <div className="text-[0.8125rem] text-muted">
                      {g.kind === "vacancy" ? g.area : `${g.worker}, ${t.riskOf(Math.round((g.noshow_risk ?? 0) * 100))}`}
                    </div>
                  </div>
                  <button onClick={() => setOpen(g)} className="h-9 shrink-0 rounded-lg bg-surface-2 px-3 text-[0.8125rem] font-semibold text-ink hover:bg-border">
                    {t.findCover}
                  </button>
                </motion.li>
              ))}
              </AnimatePresence>
            </ul>
          )}
          <button
            onClick={() => postJSON("/transguard/reset").then(load)}
            className="text-[0.8125rem] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {t.resetDemo}
          </button>
        </section>
      </div>

      {open && <FindCoverSheet key={open.key} gap={open} onClose={() => setOpen(null)} onDone={load} />}
      {planOpen && <PlanSheet onClose={() => setPlanOpen(false)} onDone={load} />}
    </div>
  );
}
