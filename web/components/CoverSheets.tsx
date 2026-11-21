"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Avatar, CloseButton, IconTile, Ring, Sheet, Skeleton, StatTile } from "@/components/ui";
import { assignAll, AssignLine, AssignResult, Candidate, Gap, getJSON, Plan, postJSON, Reason } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { isRtl, NATIVE } from "@/lib/languages";
import { EASE_OUT, rise, SPRING, stagger } from "@/lib/motion";
import { reasonText } from "@/lib/reasons";

type Message = AssignResult["message"];

/** The message as the guard receives it, in their own language, with the English underneath. */
function Bubble({ message, className = "" }: { message: Message; className?: string }) {
  return (
    <div className={className}>
      <div
        dir={isRtl(message.language) ? "rtl" : "ltr"}
        lang={message.language === "Arabic" ? "ar" : undefined}
        className="max-w-[94%] rounded-[18px] rounded-es-md bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink shadow-[0_1px_2px_rgb(29_26_25/0.06)] rtl:rounded-es-[18px] rtl:rounded-ee-md"
      >
        {message.text_local}
      </div>
      {message.language !== "English" && <p className="mt-1.5 px-1 text-[12px] italic leading-snug text-muted">“{message.text_en}”</p>}
    </div>
  );
}

function Tick({ label }: { label: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      role="img"
      aria-label={label}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: 0.15 } : { type: "spring", bounce: 0.35, duration: 0.44 }}
      className="grid size-6 shrink-0 place-items-center rounded-full bg-ok text-white"
    >
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
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
        />
      </svg>
    </motion.span>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="m-[3px] size-[18px] shrink-0 animate-spin rounded-full border-[2.5px] border-surface-2 border-t-gold"
    />
  );
}

function ErrorLine({ text }: { text: string }) {
  return text ? <p className="mb-3 rounded-xl bg-crit/5 p-3 text-sm text-crit">{text}</p> : null;
}

/**
 * Why a likely no-show may not turn up, straight from the model: each reason with the guard's figure, the typical
 * guard's figure, and a bar for how much it raises the risk. The bars grow once, biggest first.
 */
function WhyBox({ name, risk, reasons }: { name: string; risk: number; reasons: Reason[] }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  return (
    <motion.div
      {...rise(reduce, 0.12, 8, 0.45)}
      className="mb-4 flex flex-col gap-3 rounded-[18px] bg-accent-soft p-4 shadow-[inset_0_0_0_1px_var(--night-edge)]"
    >
      <h3 className="flex items-center gap-2 text-[14px] font-bold text-ink">
        {t.whyMayNotShow(name)}
        <span className="ms-auto rounded-full bg-warn/13 px-2.5 py-0.5 text-[12.5px] font-bold text-warn-ink" dir="ltr">
          {Math.round(risk * 100)}%
        </span>
      </h3>
      <ul className="flex flex-col gap-3">
        {reasons.map((r, i) => {
          const { text, typical } = reasonText(t, r);
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
              <span className="text-[14px] font-semibold text-ink">{text}</span>
              <span className="num whitespace-nowrap text-[12.5px] text-muted">{typical}</span>
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
                <motion.span
                  className="block h-full origin-left rounded-full bg-glow-warn"
                  style={{ width: `${Math.max(r.weight * 100, 6)}%` }}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.3 + i * 0.08 }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-muted">{t.fromModel}</p>
    </motion.div>
  );
}

/* ---------------- Find cover ---------------- */

export function FindCoverSheet({
  gap,
  siteType = "",
  onClose,
  onDone,
}: {
  gap: Gap;
  siteType?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [preview, setPreview] = useState<Message | null | undefined>(undefined); // undefined while writing, null if it failed
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getJSON<{ candidates: Candidate[] }>(`/transguard/backfill/${gap.site_id}`)
      .then((r) => {
        setCandidates(r.candidates);
        const best = r.candidates[0];
        if (!best) return setPreview(null);
        // the message is written (and translated) after the panel is already showing the guards
        getJSON<Message>(`/transguard/backfill/${gap.site_id}/message/${best.id}`)
          .then(setPreview)
          .catch(() => setPreview(null));
      })
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

  const kicker = gap.kind === "vacancy" ? t.openPostTonight(1) : `${gap.worker} · ${t.riskOf(Math.round((gap.noshow_risk ?? 0) * 100))}`;
  const best = candidates?.[0];
  const firstName = best?.name.split(" ")[0] ?? "";

  return (
    <Sheet
      title={`${t.candidatesFor} ${gap.site}`}
      onClose={onClose}
      header={(close) => (
        <div className="flex items-start gap-3.5 px-6 pb-4 pt-6">
          <IconTile type={siteType} tone={gap.kind === "vacancy" ? "crit" : "warn"} size={44} />
          <div className="min-w-0 flex-1">
            <p className={`text-[12.5px] font-bold ${gap.kind === "vacancy" ? "text-crit" : "text-warn-ink"}`}>{kicker}</p>
            <h2 className="mt-0.5 text-[20px] font-bold leading-tight tracking-[-0.016em] text-ink">{gap.site}</h2>
          </div>
          <CloseButton onClick={close} label={t.close} />
        </div>
      )}
    >
      <ErrorLine text={error} />
      {gap.kind === "at_risk" && gap.reasons?.length && !result ? (
        <WhyBox name={(gap.worker ?? "").split(" ")[0]} risk={gap.noshow_risk ?? 0} reasons={gap.reasons} />
      ) : null}
      {result ? (
        <motion.div {...rise(reduce, 0, 12)} className="rounded-[22px] bg-surface-2 p-4">
          <div className="mb-2.5 flex items-center gap-2 text-[13.5px] font-bold text-ok">
            <Tick label={t.approved} />
            {t.approved}: {result.assigned.worker}
          </div>
          <Bubble message={result.message} />
        </motion.div>
      ) : !candidates || !best ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-[260px] rounded-[22px]" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="night flex flex-col gap-4 rounded-[22px] p-5">
            <div className="flex items-center gap-3.5">
              <Avatar name={best.name} tone="night" size={52} />
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 text-[12px] font-bold text-gold">
                  <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
                  </svg>
                  {t.bestMatch}
                </div>
                <div className="text-[21px] font-bold leading-tight tracking-[-0.016em] text-night-strong">{best.name}</div>
                <div className="text-[13px] text-night-muted">
                  {best.role} · {best.accommodation}
                </div>
              </div>
              <Ring
                size={64}
                stroke={6}
                value={best.reliability_pct}
                color="var(--night-ok)"
                delay={0.38}
                label={`${best.reliability_pct}% ${t.reliability}`}
              >
                <span className="num text-[13px] font-bold text-night-strong" dir="ltr">
                  {Math.round(best.reliability_pct)}%
                </span>
              </Ring>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatTile dark value={`${best.commute_km} km`} label={t.travel} />
              <StatTile dark value={`${best.weekly_hours} h`} label={t.thisWeek} />
              <StatTile
                dark
                value={best.overtime_hours ? `${best.overtime_hours} h` : t.none}
                tone={best.overtime_hours ? undefined : "ok"}
                label={t.overtimeLabel}
              />
              <StatTile dark value={best.licence_expiry.slice(0, 4)} label={t.licenceTo} />
            </div>
            <p className="text-[13.5px] leading-normal text-night-soft">
              {t.rankedFirst} {best.why[1]}.
            </p>
            <button
              onClick={() => approve(best)}
              disabled={busy}
              data-tour="approve-best"
              className="flex h-[50px] items-center justify-center gap-2.5 rounded-[14px] bg-night-cta text-[15px] font-bold text-night-cta-ink hover:opacity-90 disabled:opacity-60"
            >
              {t.approve}
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[13px] font-semibold text-gold-ink">
                {NATIVE[best.language] ?? best.language}
              </span>
            </button>
          </div>

          {candidates.length > 1 && (
            <div>
              <div className="px-1 pb-2 text-[13px] font-bold text-muted">{t.alsoAvailable}</div>
              <ul className="flex flex-col gap-1">
                {candidates.slice(1).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl px-2.5 py-2 hover:bg-surface-2/60">
                    <Avatar name={c.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-bold text-ink">{c.name}</div>
                      <div className="flex items-center gap-2 text-[12.5px] text-muted">
                        <span className="inline-block h-[5px] w-[60px] overflow-hidden rounded-full bg-surface-2">
                          <motion.span
                            className="block h-full origin-left rounded-full bg-ok rtl:origin-right"
                            style={{ width: `${c.reliability_pct}%` }}
                            initial={reduce ? false : { scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.46 }}
                          />
                        </span>
                        <span dir="ltr">{c.reliability_pct}%</span> · {c.language} · <span dir="ltr">{c.commute_km} km</span>
                      </div>
                    </div>
                    <button
                      onClick={() => approve(c)}
                      disabled={busy}
                      className="h-[34px] shrink-0 rounded-[10px] bg-surface-2 px-3.5 text-[13px] font-semibold text-ink hover:bg-border disabled:opacity-50"
                    >
                      {t.assign}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-[18px] bg-surface-2/70 p-3.5">
            <div className="flex items-center gap-2 text-[12.5px] font-bold text-muted">
              <svg
                viewBox="0 0 24 24"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 5h14v10H9l-4 4z" />
              </svg>
              {t.getsMessageIn(firstName, best.language)}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              {preview === undefined ? (
                <motion.div key="wait" exit={{ opacity: 0 }} className="space-y-2" aria-busy="true">
                  <Skeleton className="h-4 w-[90%] rounded-md" />
                  <Skeleton className="h-4 w-[70%] rounded-md" />
                  <span className="sr-only">{t.writingMessage}</span>
                </motion.div>
              ) : preview ? (
                <motion.div key="msg" {...rise(reduce, 0, 6, 0.4)}>
                  <Bubble message={preview} />
                </motion.div>
              ) : (
                <p key="none" className="text-[13px] text-muted">
                  {t.messageOnApprove}
                </p>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- Fill all gaps ---------------- */

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
  const kept = plan && ["optimal", "feasible"].includes(plan.status.toLowerCase());

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

  const status = started ? (done === total ? t.allNotified : t.notifiedOf(done, total)) : "";

  return (
    <Sheet
      title={t.planTitle}
      onClose={onClose}
      header={(close) => (
        <div className="night mx-3 mt-3 rounded-[20px] px-5 pb-[18px] pt-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-gold">
                <svg
                  viewBox="0 0 24 24"
                  className="size-[13px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                </svg>
                {t.planTitle}
              </div>
              <h2 className="mt-1.5 text-[26px] font-bold leading-[1.12] tracking-[-0.024em] text-night-strong">
                {plan ? t.planDone(total, plan.solve_ms) : t.loading}
              </h2>
            </div>
            <CloseButton onClick={close} label={t.close} dark />
          </div>
          {plan && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile dark value={`${plan.total_commute_km} km`} label={t.totalCommute} />
              <StatTile
                dark
                value={`AED ${plan.total_overtime_aed}`}
                tone={plan.total_overtime_aed ? undefined : "ok"}
                label={t.totalOvertime}
              />
              <StatTile dark value={kept ? t.allKept : plan.status} label={t.rulesKept} />
              <div className="rounded-xl bg-ok/10 shadow-[inset_0_0_0_1.5px_rgb(46_125_50/0.35)]">
                <StatTile dark value={`AED ${plan.estimated_saving_aed.toLocaleString("en-US")}`} tone="ok" label={t.savesAbout} />
              </div>
            </div>
          )}
        </div>
      )}
    >
      <ErrorLine text={error} />
      {!plan ? (
        <div className="space-y-3 pt-4" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-hairline pt-2">
            {plan.assignments.map((a, i) => {
              const r = results[a.key];
              return (
                <motion.li
                  key={a.key}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0.2 } : { duration: 0.42, ease: EASE_OUT, delay: 0.35 + stagger(i, 0.05) }}
                  className="py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={a.candidate.name} tone={a.kind === "vacancy" ? "neutral" : "warn"} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-bold text-ink">
                        {a.candidate.name}{" "}
                        <span className="font-normal text-muted">
                          · {a.candidate.language} · <span dir="ltr">{a.candidate.commute_km} km</span>
                        </span>
                      </div>
                      <div className="truncate text-[12.5px] text-muted">
                        {a.site}
                        {a.kind === "at_risk" && a.worker ? `, ${t.forWorker(a.worker)}` : ""}
                      </div>
                    </div>
                    {r ? <Tick label={t.notified} /> : busy ? <Spinner label={t.sending} /> : null}
                  </div>
                  {failed[a.key] && <p className="ms-12 mt-2 text-[0.8125rem] text-crit">{failed[a.key]}</p>}
                  <AnimatePresence initial={false}>
                    {r && (
                      <motion.div
                        initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={reduce ? { duration: 0.2 } : SPRING}
                        className="overflow-hidden"
                      >
                        <Bubble message={r.message} className="ms-12 mt-2.5 [&>div]:bg-surface-2" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
          <div className="sticky bottom-0 -mx-6 -mb-6 bg-surface px-6 pb-6 pt-3">
            {!started ? (
              <button
                data-tour="approve-all"
                onClick={approveAll}
                className="h-[50px] w-full rounded-[14px] bg-ink text-[15px] font-bold text-bg hover:opacity-90"
              >
                {t.approveAll}
              </button>
            ) : (
              <div
                className="relative h-[50px] overflow-hidden rounded-[14px] bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                aria-label={status}
              >
                <motion.div
                  className="absolute inset-y-0 start-0 bg-ink"
                  initial={{ width: "0%" }}
                  animate={{ width: `${Math.max(done / Math.max(total, 1), 0.04) * 100}%` }}
                  transition={reduce ? { duration: 0 } : SPRING}
                />
                <span className="absolute inset-0 grid place-items-center text-[14.5px] font-bold text-night-strong mix-blend-difference">
                  {busy && done === 0 ? t.notifying : status}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
