"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Sheet, Skeleton } from "@/components/ui";
import { assignAll, AssignLine, AssignResult, Candidate, Gap, getJSON, Plan, postJSON } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const SPRING = { type: "spring" as const, bounce: 0, duration: 0.45 };

/** The message as the worker receives it, in their own language */
function Bubble({ result }: { result: AssignResult }) {
  const { t } = useLang();
  const rtl = ["Arabic", "Urdu"].includes(result.message.language);
  return (
    <>
      <div
        className="mt-2 max-w-[92%] rounded-2xl rounded-ss-md bg-[#dcf8c6] px-4 py-3 text-[0.9375rem] leading-relaxed text-[#1f2b1f]"
        dir={rtl ? "rtl" : "ltr"}
      >
        {result.message.text_local}
      </div>
      <div className="mt-2 text-[0.75rem] text-muted">
        {t.messageSent} {result.message.language}
        {result.message.language !== "English" && <span className="block pt-1 italic">“{result.message.text_en}”</span>}
      </div>
    </>
  );
}

export function MessageCard({ result }: { result: AssignResult }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
      className="rounded-xl bg-surface-2 p-4"
    >
      <div className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ok">
        <Tick /> {t.approved}: {result.assigned.worker}
      </div>
      <Bubble result={result} />
    </motion.div>
  );
}

function Tick() {
  return (
    <span className="grid size-5 place-items-center rounded-full bg-ok text-white" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M5 12.5l4.5 4.5L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </svg>
    </span>
  );
}

function RowsSkeleton({ n, h }: { n: number; h: string }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className={`${h} rounded-xl`} />
      ))}
    </div>
  );
}

function CandidateRow({
  c,
  best,
  index,
  onApprove,
  busy,
}: {
  c: Candidate;
  best: boolean;
  index: number;
  onApprove: () => void;
  busy: boolean;
}) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: index * 0.06 }}
      className={`rounded-xl p-4 ${best ? "bg-accent-soft ring-1 ring-accent/50" : "bg-surface-2/60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-ink">{c.name}</div>
          <div className="text-[0.8125rem] text-muted">
            {c.role}, {c.nationality}, speaks {c.language}
          </div>
        </div>
        <div className="text-end text-[0.8125rem]">
          <div className="num font-bold text-ink" dir="ltr">
            {c.commute_km} km
          </div>
          <div className="text-muted">
            {c.reliability_pct}% {t.reliability}
          </div>
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.8125rem] text-ink/80">
        {c.why.map((w) => (
          <li key={w} className="flex gap-1.5">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent" />
            {w}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] text-muted">
          {c.overtime_hours ? `${c.overtime_hours} h ${t.overtime}, AED ${c.overtime_cost_aed}` : t.noOvertime}
        </span>
        <button
          onClick={onApprove}
          disabled={busy}
          data-tour={best ? "approve-best" : undefined}
          className={`h-9 rounded-lg px-4 text-[0.875rem] font-semibold disabled:opacity-50 ${best ? "bg-primary text-primary-fg" : "bg-surface text-ink ring-1 ring-border"}`}
        >
          {t.approve}
        </button>
      </div>
    </motion.li>
  );
}

export function FindCoverSheet({ gap, onClose, onDone }: { gap: Gap; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getJSON<{ candidates: Candidate[] }>(`/transguard/backfill/${gap.site_id}`)
      .then((r) => setCandidates(r.candidates))
      .catch((e) => setError(String(e.message)));
  }, [gap.site_id]);

  const approve = async (c: Candidate) => {
    setBusy(true);
    setError("");
    try {
      setResult(
        await postJSON<AssignResult>("/transguard/backfill/assign", {
          site_id: gap.site_id,
          worker_id: c.id,
          replaces_shift_id: gap.shift_id ?? null,
        }),
      );
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sub = gap.kind === "vacancy" ? `${t.vacancy}, ${gap.area}` : `${gap.worker}: ${t.riskOf(Math.round((gap.noshow_risk ?? 0) * 100))}`;
  return (
    <Sheet title={`${t.candidatesFor} ${gap.site}`} sub={sub} onClose={onClose}>
      {error && <p className="mb-3 rounded-md bg-crit/5 p-3 text-sm text-crit">{error}</p>}
      {result ? (
        <MessageCard result={result} />
      ) : !candidates ? (
        <RowsSkeleton n={3} h="h-[150px]" />
      ) : (
        <ul className="space-y-3">
          {candidates.map((c, i) => (
            <CandidateRow key={c.id} c={c} best={i === 0} index={i} busy={busy} onApprove={() => approve(c)} />
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export function PlanSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Record<string, AssignLine>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    postJSON<Plan>("/transguard/backfill/plan")
      .then(setPlan)
      .catch((e) => setError(String(e.message)));
  }, []);

  const total = plan?.assignments.length ?? 0;
  const done = Object.keys(results).length;
  const started = busy || done > 0;

  const approveAll = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    let refreshed = false;
    try {
      await assignAll(
        plan.assignments.map((a) => ({ site_id: a.site_id, worker_id: a.candidate.id, replaces_shift_id: a.shift_id ?? null })),
        (line) => {
          if (!refreshed) {
            refreshed = true;
            onDone(); // every roster change is written before the first line, so the map can update now
          }
          // lines arrive in the order the messages finish, so match each to its row by guard
          const row = plan.assignments.find((a) => a.candidate.id === line.worker_id);
          if (!row) return;
          if ("error" in line) setFailed((f) => ({ ...f, [row.key]: line.error }));
          else setResults((r) => ({ ...r, [row.key]: line }));
        },
      );
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sub = !plan
    ? t.loading
    : started
      ? done === total
        ? t.allNotified
        : t.notifiedOf(done, total)
      : t.planSub(plan.assignments.length, plan.solve_ms);
  return (
    <Sheet title={t.planTitle} sub={sub} onClose={onClose}>
      {error && <p className="mb-3 rounded-md bg-crit/5 p-3 text-sm text-crit">{error}</p>}
      {!plan ? (
        <RowsSkeleton n={6} h="h-14" />
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="label">{t.totalCommute}</dt>
              <dd className="num mt-1 text-[1.25rem] font-bold" dir="ltr">
                {plan.total_commute_km} km
              </dd>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="label">{t.totalOvertime}</dt>
              <dd className="num mt-1 text-[1.25rem] font-bold" dir="ltr">
                AED {plan.total_overtime_aed}
              </dd>
            </div>
          </dl>
          <ul className="divide-y divide-hairline">
            {plan.assignments.map((a, i) => {
              const r = results[a.key];
              return (
                <motion.li
                  key={a.key}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING, delay: reduce ? 0 : 0.08 + i * 0.07 }}
                  className="py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{a.site}</div>
                      <div className="text-[0.8125rem] text-muted">{a.kind === "vacancy" ? t.vacancy : `${t.atRisk}: ${a.worker}`}</div>
                    </div>
                    <div className="flex items-center gap-2.5 text-end text-[0.8125rem]">
                      <div>
                        <div className="font-semibold text-ink">{a.candidate.name}</div>
                        <div className="num text-muted" dir="ltr">
                          {a.candidate.commute_km} km, {a.candidate.language}
                        </div>
                      </div>
                      {r ? (
                        <Tick />
                      ) : busy ? (
                        <span className="size-5 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden="true" />
                      ) : null}
                    </div>
                  </div>
                  {failed[a.key] && <p className="mt-2 text-[0.8125rem] text-crit">{failed[a.key]}</p>}
                  <AnimatePresence initial={false}>
                    {r && (
                      <motion.div
                        initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={SPRING}
                        className="overflow-hidden"
                      >
                        <Bubble result={r} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
          {!started ? (
            <button
              data-tour="approve-all"
              onClick={approveAll}
              className="mt-5 h-11 w-full rounded-xl bg-primary text-[0.9375rem] font-semibold text-primary-fg"
            >
              {t.approveAll}
            </button>
          ) : (
            <div
              className="relative mt-5 h-11 overflow-hidden rounded-xl bg-surface-2"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              aria-label={sub}
            >
              <motion.div
                className="h-full bg-ok/25"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.max(done / Math.max(total, 1), 0.04) * 100}%` }}
                transition={SPRING}
              />
              <span className="absolute inset-0 grid place-items-center text-[0.875rem] font-semibold text-ink">
                {busy ? t.notifying : sub}
              </span>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
