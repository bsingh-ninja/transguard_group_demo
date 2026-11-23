"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { AnimatedNumber, Avatar, Skeleton } from "@/components/ui";
import { AREAS, postJSON, WhatIfResult } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { EASE_OUT, fade, rise, SPRING_SLOW } from "@/lib/motion";

export default function WhatIf() {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const [area, setArea] = useState("Dubai Marina");
  const [guards, setGuards] = useState(40);
  const [female, setFemale] = useState(6);
  const [firstAid, setFirstAid] = useState(10);
  const [start, setStart] = useState("2026-12-01");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [asked, setAsked] = useState({ guards: 40, firstAid: 10, area: "Dubai Marina", start: "2026-12-01" }); // the question the result answers
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await postJSON<WhatIfResult>("/transguard/what-if", { area, guards, female_guards: female, first_aid: firstAid, start }));
      setAsked({ guards, firstAid, area, start });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // open with the demo question already answered
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const max = result ? Math.max(...result.from_accommodation.map((a) => a.guards), 1) : 1;
  const pct = (n: number) => `${(n / Math.max(asked.guards, 1)) * 100}%`;
  const date = new Date(`${asked.start}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-AE" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <p className="text-[13px] font-bold text-gold-ink">{t.staffingCheck}</p>
        <h1 className="mt-1 text-[clamp(1.75rem,1.4rem+1vw,2.125rem)] font-bold leading-[1.1] tracking-[-0.028em] text-ink rtl:tracking-normal">
          {t.whatIfTitle}
        </h1>
        <p className="mt-2 text-[15px] text-muted">{t.whatIfShort}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="card flex flex-wrap items-end gap-x-[22px] gap-y-[18px] px-5 py-[18px]"
      >
        <div className="min-w-0 flex-[1_1_190px]">
          <label htmlFor="area" className="mb-1.5 block text-[13px] font-semibold text-muted">
            {t.area}
          </label>
          <select
            id="area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-[46px] w-full rounded-xl bg-surface-2 px-3 text-[15px] font-semibold text-ink"
          >
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <Stepper id="guards" label={t.guardsShort} value={guards} min={1} max={200} onChange={setGuards} />
        <Stepper id="female" label={t.femaleNeeded} value={female} min={0} max={guards} onChange={setFemale} />
        <Stepper id="aid" label={t.firstAidShort} value={firstAid} min={0} max={guards} onChange={setFirstAid} />
        <div>
          <label htmlFor="start" className="mb-1.5 block text-[13px] font-semibold text-muted">
            {t.startDate}
          </label>
          <input
            id="start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="num h-[46px] rounded-xl bg-surface-2 px-3 text-[15px] font-semibold text-ink"
          />
        </div>
        <button
          type="submit"
          data-tour="check-staffing"
          disabled={busy}
          className="ms-auto h-[46px] rounded-xl bg-ink px-[22px] text-[15px] font-bold text-bg hover:opacity-90 disabled:opacity-50"
        >
          {t.run}
        </button>
      </form>

      {error && <p className="rounded-xl bg-crit/5 p-3 text-sm text-crit">{error}</p>}

      {!result && busy && (
        <div className="flex flex-wrap gap-[22px]" aria-busy="true">
          <Skeleton className="h-[520px] flex-[999_1_540px] rounded-3xl" />
          <Skeleton className="h-[520px] flex-[1_1_320px] rounded-3xl" />
        </div>
      )}

      {result && (
        <div className={`flex flex-wrap items-stretch gap-[22px] transition-opacity duration-300 ${busy ? "opacity-60" : ""}`}>
          <motion.section {...rise(reduce, 0, 18, 0.62)} aria-label={t.covered} className="night min-w-0 flex-[999_1_540px] p-[26px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-night-tile px-[11px] py-[5px] text-[12.5px] font-semibold text-night-soft">
              {t.contractPill(asked.guards, asked.area, date)}
            </div>
            <div className="mt-[18px] flex flex-wrap items-end gap-x-11 gap-y-5">
              <Big label={t.covered}>
                <span className="text-[64px] text-night-strong">
                  <AnimatedNumber value={result.covered} from={0} />
                </span>
                <span className="ms-2 text-[18px] font-semibold tracking-normal text-night-muted">
                  {t.of} {asked.guards}
                </span>
              </Big>
              <Big label={t.hiringGap}>
                <span className={`text-[64px] transition-colors ${result.hiring_gap ? "text-night-crit" : "text-night-ok"}`}>
                  <AnimatedNumber value={result.hiring_gap} from={0} />
                </span>
              </Big>
              {result.avg_commute_km !== null && (
                <Big label={t.avgCommute}>
                  <span className="text-[34px]">
                    <AnimatedNumber value={result.avg_commute_km} decimals={1} from={0} />
                  </span>
                  <span className="ms-1.5 text-[14px] font-semibold tracking-normal text-night-muted">km</span>
                </Big>
              )}
            </div>

            {/* gold: female guards, light: the rest of our guards, red tint: to hire */}
            <motion.div
              aria-hidden="true"
              className="mt-[22px] flex h-2.5 overflow-hidden rounded-full bg-glow-crit/25"
              initial={reduce ? false : { clipPath: "inset(0 100% 0 0 round 999px)" }}
              animate={{ clipPath: "inset(0 0% 0 0 round 999px)" }}
              transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.26 }}
            >
              <motion.div className="bg-gold" animate={{ width: pct(result.female) }} transition={reduce ? { duration: 0 } : SPRING_SLOW} />
              <motion.div
                className="bg-night-accent"
                animate={{ width: pct(result.covered - result.female) }}
                transition={reduce ? { duration: 0 } : SPRING_SLOW}
              />
            </motion.div>

            <h2 className="mb-3 mt-6 text-[13px] font-semibold text-night-muted">{t.crewSquares(asked.guards)}</h2>
            <CrewGrid total={asked.guards} covered={result.covered} female={result.female} />
            <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-night-muted">
              <Key className="bg-night-accent" label={`${t.legendOurs} ${result.covered - result.female}`} />
              <Key className="bg-gold" label={`${t.legendFemale} ${result.female}`} />
              {result.hiring_gap > 0 && (
                <Key className="border-2 border-dashed border-night-crit" label={`${t.legendHire} ${result.hiring_gap}`} />
              )}
            </div>

            <motion.div {...fade(reduce, 0.68)} className="mt-5 flex flex-wrap gap-2">
              {result.female_shortfall > 0 && (
                <Chip tone="warn">
                  <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  {t.shortfall(result.female_shortfall, t.femaleWord)}
                </Chip>
              )}
              {result.first_aid_shortfall > 0 ? (
                <Chip tone="warn">
                  <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  {t.shortfall(result.first_aid_shortfall, t.firstAidWord)}
                </Chip>
              ) : (
                <Chip tone="ok">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                  {t.firstAidCovered(result.first_aid, asked.firstAid)}
                </Chip>
              )}
            </motion.div>
            <p className="mt-4 text-[12.5px] text-night-muted/90">{result.note}</p>
          </motion.section>

          <motion.section {...rise(reduce, 0.1, 12)} className="card min-w-0 flex-[1_1_320px] p-6">
            <h2 className="text-[17px] font-bold tracking-[-0.01em] text-ink">{t.fromAcc}</h2>
            <ul className="mt-4 flex flex-col gap-3.5">
              {result.from_accommodation.map((a, i) => (
                <li key={a.name}>
                  <div className="flex justify-between text-[14px] font-semibold text-ink">
                    <span>{a.name}</span>
                    <span className="num">{a.guards}</span>
                  </div>
                  <div className="mt-[7px] h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className="h-full rounded-full bg-gold"
                      style={{ transformOrigin: "left" }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1, width: `${(a.guards / max) * 100}%` }}
                      transition={
                        reduce ? { duration: 0 } : { scaleX: { duration: 0.7, ease: EASE_OUT, delay: 0.3 + i * 0.06 }, width: SPRING_SLOW }
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="mb-2 mt-[26px] text-[13px] font-bold text-muted">{t.closestCrew}</h3>
            <ul className="flex flex-col gap-0.5 text-[14px]">
              {result.crew_sample.slice(0, 5).map((c) => (
                <li key={c.name + c.accommodation} className="flex items-center gap-2.5 py-1.5">
                  <Avatar name={c.name} size={30} />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {c.name} <span className="text-muted">· {c.nationality}</span>
                  </span>
                  <span className="num shrink-0 text-muted" dir="ltr">
                    {c.commute_km} km
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>
      )}
    </div>
  );
}

function Big({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-night-muted">{label}</div>
      <div className="num mt-1.5 font-bold leading-[0.95] tracking-[-0.04em]" dir="ltr">
        {children}
      </div>
    </div>
  );
}

/**
 * One square per guard the contract needs: female guards (gold), the rest of our guards (light),
 * and the places we would hire for (dashed red). They arrive in that order, so the gap is the last thing you see.
 * Squares already on screen never replay their entrance when the question is asked again.
 */
function CrewGrid({ total, covered, female }: { total: number; covered: number; female: number }) {
  const reduce = useReducedMotion();
  const size = total <= 60 ? "size-7 rounded-lg" : total <= 120 ? "size-[18px] rounded-[5px]" : "size-3 rounded-[3px]";
  return (
    <div className="flex max-w-[640px] flex-wrap gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const kind = i < female ? "female" : i < covered ? "ours" : "hire";
        const delay = (kind === "female" ? 0.36 : kind === "ours" ? 0.42 : 0.56) + (i % 3) * 0.024;
        return (
          <motion.span
            key={i}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.38, ease: EASE_OUT, delay }}
            className={`${size} box-border transition-colors duration-500 ${
              kind === "female" ? "bg-gold" : kind === "ours" ? "bg-night-accent" : "border-2 border-dashed border-night-crit"
            }`}
          />
        );
      })}
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <span className={`box-border size-3 rounded-[3px] ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Chip({ tone, children }: { tone: "warn" | "ok"; children: [React.ReactNode, React.ReactNode] }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-[7px] text-[13.5px] font-semibold ${
        tone === "warn" ? "bg-glow-warn/16 text-night-warn" : "bg-night-ok/14 text-night-ok"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children[0]}
      </svg>
      {children[1]}
    </span>
  );
}

function Stepper({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { t } = useLang();
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
  const btn = "grid h-[46px] w-11 place-items-center rounded-xl text-[20px] font-semibold text-ink hover:bg-border/60 disabled:opacity-30";
  return (
    <div>
      <span id={`lbl-${id}`} className="mb-1.5 block text-[13px] font-semibold text-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={`lbl-${id}`} className="inline-flex h-[46px] items-center rounded-xl bg-surface-2" dir="ltr">
        <button type="button" aria-label={t.fewer(label)} disabled={value <= min} onClick={() => set(value - 1)} className={btn}>
          −
        </button>
        <input
          id={id}
          aria-labelledby={`lbl-${id}`}
          inputMode="numeric"
          value={value}
          onChange={(e) => set(+e.target.value.replace(/\D/g, "") || 0)}
          className="num w-10 bg-transparent text-center text-[18px] font-bold text-ink outline-none"
        />
        <button type="button" aria-label={t.more(label)} disabled={value >= max} onClick={() => set(value + 1)} className={btn}>
          +
        </button>
      </div>
    </div>
  );
}
