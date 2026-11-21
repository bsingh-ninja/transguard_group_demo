"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { AnimatedNumber, Pill } from "@/components/ui";
import { API, Assumptions, getJSON, Savings } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { EASE_OUT, SPRING } from "@/lib/motion";

const FIELDS: { key: keyof Assumptions; step: number; max: number; prefix?: string; unit?: "perHour" | "minutesUnit" }[] = [
  { key: "penalty_aed", step: 50, max: 100000, prefix: "AED" },
  { key: "overtime_rate_aed", step: 1, max: 1000, prefix: "AED", unit: "perHour" },
  { key: "supervisor_minutes", step: 5, max: 600, unit: "minutesUnit" },
  { key: "supervisor_rate_aed", step: 5, max: 2000, prefix: "AED", unit: "perHour" },
];

const aed = (n: number) => n.toLocaleString("en-US");

/**
 * What tonight is worth. Before anything is done it shows the missed-post penalties at stake; once gaps are filled
 * it counts up to what was saved. The four figures behind it open in place and can be changed by anyone.
 * `refresh` changes whenever the roster changes, so the figure follows each assignment.
 */
export default function SavingsCard({ refresh, delay = 0 }: { refresh: number; delay?: number }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [data, setData] = useState<Savings | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<keyof Assumptions, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getJSON<Savings>("/transguard/savings")
      .then(setData)
      .catch(() => {});
  }, []);
  useEffect(load, [load, refresh]);

  const toForm = (a: Assumptions) => Object.fromEntries(FIELDS.map((f) => [f.key, String(a[f.key])])) as Record<keyof Assumptions, string>;
  const toggle = () => {
    if (!open && data) setForm(toForm(data.assumptions));
    setOpen(!open);
    setError("");
  };

  const save = async (values: Assumptions) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/transguard/savings/assumptions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(String(res.status));
      const next: Savings = await res.json();
      setData(next);
      setForm(toForm(next.assumptions));
    } catch {
      setError(t.figuresError);
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (!form) return;
    const values = Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])])) as Assumptions;
    if (FIELDS.some((f) => !Number.isFinite(values[f.key]) || values[f.key] < 0 || values[f.key] > f.max)) {
      setError(t.figuresError);
      return;
    }
    save(values);
  };

  if (!data) return null;
  const { saved, at_stake } = data;
  const after = saved.filled > 0;
  const hours = Math.floor(saved.supervisor_minutes / 60);
  const label: Record<keyof Assumptions, string> = {
    penalty_aed: t.penaltyLabel,
    overtime_rate_aed: t.overtimeRateLabel,
    supervisor_minutes: t.supervisorMinutesLabel,
    supervisor_rate_aed: t.supervisorRateLabel,
  };

  return (
    <motion.section
      aria-label={after ? t.moneyAfter : t.moneyBefore}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.56, ease: EASE_OUT, delay }}
      className="night flex flex-col gap-3 rounded-[20px] p-[18px]"
    >
      <div className="flex items-center gap-2 text-[13px] font-bold text-night-muted">
        {after ? t.moneyAfter : t.moneyBefore}
        <span className="ms-auto">
          {after ? (
            <Pill tone="ok">{t.nFilled(saved.filled)}</Pill>
          ) : (
            <Pill tone="crit">
              <span dir="ltr">{t.nPosts(at_stake.posts)}</span>
            </Pill>
          )}
        </span>
      </div>

      <div
        className={`num text-[38px] font-bold leading-none tracking-[-0.03em] ${after ? "text-night-ok" : "text-night-strong"}`}
        dir="ltr"
        aria-live="polite"
      >
        <span className="me-1 text-[16px] font-semibold tracking-normal text-night-muted">AED</span>
        <AnimatedNumber value={after ? saved.total_aed : at_stake.aed} from={0} group />
      </div>
      <p className="text-[13px] text-night-soft">{after ? t.savedNote : t.atStakeNote}</p>

      {after && (
        <div className="flex flex-col gap-1.5 border-t border-night-line pt-2.5 text-[13.5px]">
          <Line label={t.postsKept} value={saved.posts_aed} />
          <Line label={t.overtimeAvoided} value={saved.overtime_aed} />
          <Line label={t.supervisorSaved(t.hoursMinutes(hours, saved.supervisor_minutes % 60))} value={saved.supervisor_aed} />
          {at_stake.posts > 0 && (
            <p className="pt-1 text-[12.5px] font-semibold text-night-crit">{t.stillAtStake(aed(at_stake.aed), at_stake.posts)}</p>
          )}
        </div>
      )}

      <button
        onClick={toggle}
        aria-expanded={open}
        aria-controls="assumptions"
        className="inline-flex items-center gap-1.5 self-start rounded-md text-[13px] font-bold text-gold-ink hover:opacity-80"
      >
        {t.assumptions}
        <motion.svg
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : SPRING}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {open && form && (
          <motion.form
            id="assumptions"
            key="assumptions"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={reduce ? { duration: 0.15 } : SPRING}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2.5 rounded-[14px] bg-night-tile p-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="min-w-0">
                  <label
                    htmlFor={`as-${f.key}`}
                    className="mb-1 block min-h-[2lh] text-[12px] font-semibold leading-tight text-night-muted"
                  >
                    {label[f.key]}
                  </label>
                  <div
                    className="flex h-[38px] items-center gap-1.5 rounded-[10px] bg-night px-2.5 shadow-[inset_0_0_0_1px_var(--border)]"
                    dir="ltr"
                  >
                    {f.prefix && <span className="text-[12px] font-semibold text-night-muted">{f.prefix}</span>}
                    <input
                      id={`as-${f.key}`}
                      inputMode="decimal"
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value.replace(/[^\d.]/g, "") })}
                      className="num min-w-0 flex-1 bg-transparent text-[14px] font-bold text-night-strong outline-none"
                    />
                    {f.unit && <span className="text-[12px] font-semibold text-night-muted">{t[f.unit]}</span>}
                  </div>
                </div>
              ))}
              <p className="col-span-2 text-[12px] leading-snug text-night-muted">{t.assumptionsNote}</p>
              {error && <p className="col-span-2 text-[12.5px] font-semibold text-night-crit">{error}</p>}
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(data.defaults)}
                  className="h-[34px] rounded-[10px] bg-night px-3 text-[13px] font-bold text-night-soft shadow-[inset_0_0_0_1px_var(--border)] hover:opacity-80 disabled:opacity-50"
                >
                  {t.resetDefaults}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-[34px] rounded-[10px] bg-night-cta px-3.5 text-[13px] font-bold text-night-cta-ink hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? t.saving : t.save}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-night-soft">{label}</span>
      <b className="num whitespace-nowrap" dir="ltr">
        AED <AnimatedNumber value={value} from={0} group />
      </b>
    </div>
  );
}
