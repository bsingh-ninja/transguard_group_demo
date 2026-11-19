"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui";
import { AssignResult, Candidate, Gap, getJSON, Plan, postJSON } from "@/lib/api";
import { useLang } from "@/lib/i18n";

/** The message as the worker receives it, in their own language */
export function MessageCard({ result }: { result: AssignResult }) {
  const { t } = useLang();
  const rtl = ["Arabic", "Urdu"].includes(result.message.language);
  return (
    <div className="rise rounded-xl bg-surface-2 p-4">
      <div className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ok">
        <span className="size-2 rounded-full bg-ok" /> {t.approved}: {result.assigned.worker}
      </div>
      <div className="mt-3 max-w-[92%] rounded-2xl rounded-ss-md bg-[#dcf8c6] px-4 py-3 text-[0.9375rem] leading-relaxed text-[#1f2b1f]" dir={rtl ? "rtl" : "ltr"}>
        {result.message.text_local}
      </div>
      <div className="mt-2 text-[0.75rem] text-muted">
        {t.messageSent} {result.message.language}
        {result.message.language !== "English" && <span className="block pt-1 italic">“{result.message.text_en}”</span>}
      </div>
    </div>
  );
}

function CandidateRow({ c, best, onApprove, busy }: { c: Candidate; best: boolean; onApprove: () => void; busy: boolean }) {
  const { t } = useLang();
  return (
    <li className={`rounded-xl p-4 ${best ? "bg-accent-soft ring-1 ring-accent/50" : "bg-surface-2/60"}`}>
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
          className={`h-9 rounded-lg px-4 text-[0.875rem] font-semibold disabled:opacity-50 ${best ? "bg-primary text-primary-fg" : "bg-surface text-ink ring-1 ring-border"}`}
        >
          {t.approve}
        </button>
      </div>
    </li>
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
      setResult(await postJSON<AssignResult>("/transguard/backfill/assign", { site_id: gap.site_id, worker_id: c.id, replaces_shift_id: gap.shift_id ?? null }));
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
        <p className="text-sm text-muted">{t.loading}</p>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c, i) => (
            <CandidateRow key={c.id} c={c} best={i === 0} busy={busy} onApprove={() => approve(c)} />
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export function PlanSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<AssignResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    postJSON<Plan>("/transguard/backfill/plan").then(setPlan).catch((e) => setError(String(e.message)));
  }, []);

  const approveAll = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    const done: AssignResult[] = [];
    try {
      for (const a of plan.assignments) {
        done.push(await postJSON<AssignResult>("/transguard/backfill/assign", { site_id: a.site_id, worker_id: a.candidate.id, replaces_shift_id: a.shift_id ?? null }));
        setResults([...done]);
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t.planTitle} sub={plan ? t.planSub(plan.assignments.length, plan.solve_ms) : t.loading} onClose={onClose}>
      {error && <p className="mb-3 rounded-md bg-crit/5 p-3 text-sm text-crit">{error}</p>}
      {plan && results.length === 0 && (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="label">{t.totalCommute}</dt>
              <dd className="num mt-1 text-[1.25rem] font-bold" dir="ltr">{plan.total_commute_km} km</dd>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <dt className="label">{t.totalOvertime}</dt>
              <dd className="num mt-1 text-[1.25rem] font-bold" dir="ltr">AED {plan.total_overtime_aed}</dd>
            </div>
          </dl>
          <ul className="divide-y divide-hairline">
            {plan.assignments.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{a.site}</div>
                  <div className="text-[0.8125rem] text-muted">
                    {a.kind === "vacancy" ? t.vacancy : `${t.atRisk}: ${a.worker}`}
                  </div>
                </div>
                <div className="text-end text-[0.8125rem]">
                  <div className="font-semibold text-ink">{a.candidate.name}</div>
                  <div className="num text-muted" dir="ltr">
                    {a.candidate.commute_km} km, {a.candidate.language}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={approveAll} disabled={busy} className="mt-5 h-11 w-full rounded-xl bg-primary text-[0.9375rem] font-semibold text-primary-fg disabled:opacity-50">
            {busy ? t.loading : t.approveAll}
          </button>
        </>
      )}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <MessageCard key={i} result={r} />
          ))}
        </div>
      )}
    </Sheet>
  );
}
