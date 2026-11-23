"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import NightMap, { MapLegend } from "@/components/CoverageMap";
import { FindCoverSheet, PlanSheet } from "@/components/CoverSheets";
import SavingsCard from "@/components/SavingsCard";
import { refreshCounts } from "@/components/Sidebar";
import { AnimatedNumber, Avatar, ErrorBox, IconTile, Loading, Pill, Ring, WakingUp } from "@/components/ui";
import { Gap, getJSON, loadWithWake, Overview, postJSON, Site } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { reasonLine } from "@/lib/reasons";
import { fade, rise, SPRING, SPRING_SNAP, TONIGHT } from "@/lib/motion";

export default function Tonight() {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const [data, setData] = useState<Overview | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Gap | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [waking, setWaking] = useState(false);
  const [tick, setTick] = useState(0); // changes whenever the roster is reloaded, so the money card follows

  const load = useCallback(() => {
    setError("");
    loadWithWake(
      () => Promise.all([getJSON<Overview>("/transguard/overview"), getJSON<Gap[]>("/transguard/gaps")]),
      () => setWaking(true),
    )
      .then(([o, g]) => {
        setData(o);
        setGaps(g);
        setTick((n) => n + 1);
        refreshCounts();
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setWaking(false));
  }, []);
  useEffect(load, [load]);

  // One row per site with open posts (the API lists one gap per empty slot)
  const openSites = useMemo(() => {
    const by = new Map<string, { gap: Gap; count: number }>();
    for (const g of gaps.filter((g) => g.kind === "vacancy")) {
      const e = by.get(g.site_id);
      if (e) e.count++;
      else by.set(g.site_id, { gap: g, count: 1 });
    }
    return [...by.values()];
  }, [gaps]);
  const noShows = gaps.filter((g) => g.kind === "at_risk");

  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return waking ? <WakingUp /> : <Loading />;

  const { totals } = data;
  const siteType = (id: string) => data.sites.find((s) => s.id === id)?.type ?? "";
  const pickSite = (s: Site) => {
    const g = gaps.find((x) => x.site_id === s.id);
    if (g) setOpen(g);
  };
  const date = new Date(`${data.date}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-AE" : "en-GB", { day: "numeric", month: "short" });
  const allClear = gaps.length === 0;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <motion.section aria-label={t.navTonight} {...rise(reduce, 0, 18, 0.62)} className="night min-w-0 flex-[999_1_600px] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0 flex-[1_1_300px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-night-tile py-[5px] pe-[11px] ps-[9px] text-[12.5px] font-semibold text-night-soft">
              <span className="relative size-2">
                {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-night-ok/60 [animation-duration:2.4s]" />}
                <span className="absolute inset-0 rounded-full bg-night-ok shadow-[0_0_0_4px_rgb(76_195_138/0.2)]" />
              </span>
              {t.shiftPill(date)}
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.h1
                key={t.headline(totals.vacancies, totals.at_risk)}
                data-tour="headline"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                className="mt-4 max-w-[13ch] text-[clamp(2.1rem,1.4rem+1.6vw,2.875rem)] font-bold leading-[1.04] tracking-[-0.034em] text-night-strong rtl:leading-[1.25] rtl:tracking-normal"
              >
                {t.headline(totals.vacancies, totals.at_risk)}
              </motion.h1>
            </AnimatePresence>
            <p className="mt-3 max-w-[40ch] text-[15.5px] leading-normal text-night-soft">
              {allClear ? t.coverageHolds(totals.coverage_pct) : t.coverageFalls(totals.coverage_pct, totals.expected_coverage_pct)}
            </p>
            <div className="mt-[22px] flex flex-wrap gap-2.5">
              {!allClear && (
                <button
                  data-tour="fill-all"
                  onClick={() => setPlanOpen(true)}
                  className="inline-flex h-[46px] items-center gap-2 rounded-[13px] bg-night-cta px-5 text-[15px] font-bold text-night-cta-ink hover:opacity-90"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                  </svg>
                  {t.fillAll}
                </button>
              )}
              <button
                data-tour="reset"
                onClick={() => postJSON("/transguard/reset").then(load)}
                className="h-[46px] rounded-[13px] bg-night-tile px-[18px] text-[14.5px] font-semibold text-night-soft hover:opacity-80"
              >
                {t.resetDemo}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-[18px]">
            <Ring
              value={totals.coverage_pct}
              inner={totals.expected_coverage_pct}
              label={t.ringLabel(totals.coverage_pct, totals.expected_coverage_pct)}
              delay={TONIGHT.ring}
              innerDelay={TONIGHT.ringAfter}
            >
              <div>
                <div className="num text-[30px] font-bold leading-none tracking-[-0.03em] text-night-strong" dir="ltr">
                  <AnimatedNumber value={totals.coverage_pct} decimals={1} suffix="%" from={0} />
                </div>
                <div className="mt-1.5 text-[11.5px] font-semibold text-night-muted">{t.coveredNow}</div>
              </div>
            </Ring>
            <div className="flex flex-col gap-2.5 text-[12.5px] text-night-muted">
              <div>
                <div className="flex items-center gap-[7px]">
                  <span className="h-1 w-2.5 rounded bg-night-accent" />
                  {t.ringNow}
                </div>
                <div className="num text-[17px] font-bold text-night-strong" dir="ltr">
                  {totals.coverage_pct}%
                </div>
              </div>
              <div>
                <div className="flex items-center gap-[7px]">
                  <span className="h-1 w-2.5 rounded bg-glow-warn" />
                  {t.ringAfter}
                </div>
                <div className="num text-[17px] font-bold text-night-warn" dir="ltr">
                  {totals.expected_coverage_pct}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-night-line pt-[18px] sm:grid-cols-4">
          <Stat label={t.onShift} value={totals.assigned} unit={`${t.of} ${totals.required}`} />
          <Stat label={t.sites} value={totals.sites} />
          <Stat label={t.openPosts} value={totals.vacancies} tone={totals.vacancies ? "crit" : undefined} />
          <Stat label={t.likelyNoShows} value={totals.at_risk} tone={totals.at_risk ? "warn" : undefined} />
        </dl>

        <div className="mt-[22px] flex flex-wrap gap-3">
          <NightMap data={data} region="dubai" onPick={pickSite} />
          <NightMap data={data} region="abudhabi" onPick={pickSite} />
        </div>
        <div className="mt-3.5">
          <MapLegend />
        </div>
      </motion.section>

      <section aria-labelledby="actions" className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
        <div className="px-1 pb-0.5 pt-1">
          <div className="flex items-center gap-2.5">
            <h2 id="actions" className="text-[24px] font-bold tracking-[-0.02em] text-ink">
              {t.needsAction}
            </h2>
            {!allClear && (
              <span className="grid h-6 place-items-center rounded-full bg-ink px-[9px] text-[12.5px] font-bold text-bg" dir="ltr">
                {gaps.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">{allClear ? t.allClearSub : t.tapPost}</p>
        </div>

        {allClear ? (
          <motion.div {...rise(reduce, 0, 12)} className="card flex flex-col items-center px-6 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-ok/12 text-ok" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                className="size-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                />
              </svg>
            </span>
            <p className="title mt-4 text-ink">{t.allClear}</p>
            <p className="mt-1 text-[0.875rem] text-muted">
              {t.onShift}:{" "}
              <span className="num" dir="ltr">
                {totals.assigned}
              </span>{" "}
              {t.of}{" "}
              <span className="num" dir="ltr">
                {totals.required}
              </span>
            </p>
          </motion.div>
        ) : (
          <>
            {openSites.length > 0 && (
              <motion.div {...rise(reduce, TONIGHT.side[0], 12)} className="card overflow-hidden">
                <CardHead label={t.openPosts} count={totals.vacancies} tone="crit" />
                <ul>
                  <AnimatePresence initial={false} mode="popLayout">
                    {openSites.map(({ gap, count }) => (
                      <Row key={gap.site_id} reduce={reduce}>
                        <button
                          data-tour={`find-cover-${gap.site_id}`}
                          onClick={() => setOpen(gap)}
                          className="press-soft flex min-h-16 w-full items-center gap-[13px] px-[18px] py-2.5 text-start hover:bg-surface-2/60"
                        >
                          <IconTile type={siteType(gap.site_id)} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-ink">{gap.site}</span>
                            <span className="block text-[13px] text-muted">{gap.area}</span>
                          </span>
                          <Pill tone="crit">{t.nOpen(count)}</Pill>
                        </button>
                      </Row>
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
            {noShows.length > 0 && (
              <motion.div {...rise(reduce, TONIGHT.side[1], 12)} className="card overflow-hidden">
                <CardHead label={t.likelyNoShows} count={noShows.length} tone="warn" />
                <ul>
                  <AnimatePresence initial={false} mode="popLayout">
                    {noShows.map((g) => (
                      <Row key={g.key} reduce={reduce}>
                        <button
                          data-tour={`find-cover-${g.site_id}`}
                          onClick={() => setOpen(g)}
                          className="press-soft flex min-h-16 w-full items-center gap-[13px] px-[18px] py-2.5 text-start hover:bg-surface-2/60"
                        >
                          <Avatar name={g.worker ?? ""} tone="warn" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-ink">{g.worker}</span>
                            <span className="block truncate text-[13px] text-muted">{g.site}</span>
                            {g.reasons?.length ? (
                              <span className="block truncate text-[12.5px] font-semibold text-warn-ink">{reasonLine(t, g.reasons)}</span>
                            ) : null}
                          </span>
                          <Pill tone="warn">
                            <span dir="ltr">{Math.round((g.noshow_risk ?? 0) * 100)}%</span>
                          </Pill>
                        </button>
                      </Row>
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </>
        )}

        <SavingsCard refresh={tick} delay={TONIGHT.side[2]} />

        <motion.div {...fade(reduce, TONIGHT.side[2] + 0.06)} className="flex items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3.5">
          <svg
            viewBox="0 0 24 24"
            className="mt-px size-5 shrink-0 text-gold-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l8 4v5c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V7z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <p className="text-[13px] leading-normal text-muted">{t.trustNote}</p>
        </motion.div>
      </section>

      {open && <FindCoverSheet key={open.key} gap={open} siteType={siteType(open.site_id)} onClose={() => setOpen(null)} onDone={load} />}
      {planOpen && <PlanSheet onClose={() => setPlanOpen(false)} onDone={load} />}
    </div>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: number; unit?: string; tone?: "crit" | "warn" }) {
  const color = tone === "crit" ? "text-night-crit" : tone === "warn" ? "text-night-warn" : "text-night-ink";
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] font-semibold text-night-muted">{label}</dt>
      <dd className={`num mt-1 text-[26px] font-bold leading-[1.1] tracking-[-0.03em] ${color}`} dir="ltr">
        <AnimatedNumber value={value} from={0} />
        {unit && <span className="ms-[5px] text-[13px] font-semibold tracking-normal text-night-muted">{unit}</span>}
      </dd>
    </div>
  );
}

function CardHead({ label, count, tone }: { label: string; count: number; tone: "crit" | "warn" }) {
  return (
    <div className="flex items-center justify-between px-[18px] pb-1.5 pt-3.5 text-[13px] font-bold text-muted">
      <span>{label}</span>
      <Pill tone={tone} className="px-2 py-px">
        <span dir="ltr">{count}</span>
      </Pill>
    </div>
  );
}

/** A row that leaves when its post is covered: it stops taking space at once, so its neighbours close the gap while it fades. */
function Row({ reduce, children }: { reduce: boolean | null; children: React.ReactNode }) {
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, transition: SPRING_SNAP }}
      transition={SPRING}
      className="border-t border-hairline first:border-t-0"
    >
      {children}
    </motion.li>
  );
}
