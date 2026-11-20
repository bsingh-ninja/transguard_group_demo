"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import CoverageMap from "@/components/CoverageMap";
import { FindCoverSheet, PlanSheet } from "@/components/CoverSheets";
import { ErrorBox, Figure, Loading, WakingUp } from "@/components/ui";
import { Gap, getJSON, loadWithWake, Overview, postJSON, Site } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function Tonight() {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [data, setData] = useState<Overview | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Gap | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [waking, setWaking] = useState(false);

  const load = useCallback(() => {
    setError("");
    loadWithWake(() => Promise.all([getJSON<Overview>("/transguard/overview"), getJSON<Gap[]>("/transguard/gaps")]), () => setWaking(true))
      .then(([o, g]) => {
        setData(o);
        setGaps(g);
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setWaking(false));
  }, []);
  useEffect(load, [load]);

  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return waking ? <WakingUp /> : <Loading />;

  const { totals } = data;
  const pickSite = (s: Site) => {
    const g = gaps.find((x) => x.site_id === s.id);
    if (g) setOpen(g);
  };

  return (
    <div className="space-y-8">
      <section className="grid items-end gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative min-w-0">
          <p className="label">{t.tonightLabel}</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.h1
              key={t.headline(totals.vacancies, totals.at_risk)}
              data-tour="headline"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              className="display mt-2 max-w-[24ch] text-ink"
            >
              {t.headline(totals.vacancies, totals.at_risk)}
            </motion.h1>
          </AnimatePresence>
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
              <button data-tour="fill-all" onClick={() => setPlanOpen(true)} className="h-10 rounded-xl bg-primary px-4 text-[0.875rem] font-semibold text-primary-fg">
                {t.fillAll}
              </button>
            )}
          </div>
          {gaps.length === 0 ? (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              className="panel flex flex-col items-center px-6 py-10 text-center"
            >
              <span className="grid size-14 place-items-center rounded-full bg-ok/12 text-ok" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <motion.path d="M5 12.5l4.5 4.5L19 7" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }} />
                </svg>
              </span>
              <p className="title mt-4 text-ink">{t.allClear}</p>
              <p className="mt-1 text-[0.875rem] text-muted">
                {t.onShift}: <span className="num" dir="ltr">{totals.assigned}</span> {t.of} <span className="num" dir="ltr">{totals.required}</span>
              </p>
            </motion.div>
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
                  <button data-tour={`find-cover-${g.site_id}`} onClick={() => setOpen(g)} className="h-9 shrink-0 rounded-lg bg-surface-2 px-3 text-[0.8125rem] font-semibold text-ink hover:bg-border">
                    {t.findCover}
                  </button>
                </motion.li>
              ))}
              </AnimatePresence>
            </ul>
          )}
          <button
            data-tour="reset"
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
