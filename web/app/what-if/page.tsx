"use client";

import { useEffect, useState } from "react";
import { AREAS, postJSON, WhatIfResult } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function WhatIf() {
  const { t } = useLang();
  const [area, setArea] = useState("Dubai Marina");
  const [guards, setGuards] = useState(40);
  const [female, setFemale] = useState(6);
  const [firstAid, setFirstAid] = useState(10);
  const [start, setStart] = useState("2026-12-01");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await postJSON<WhatIfResult>("/transguard/what-if", { area, guards, female_guards: female, first_aid: firstAid, start }));
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
  const coveredPct = result ? (result.covered / guards) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="label">{t.whatIfLabel}</p>
        <h1 className="display mt-2 text-ink">{t.whatIfTitle}</h1>
        <p className="mt-3 max-w-[64ch] text-[1.0625rem] leading-relaxed text-muted">{t.whatIfIntro}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)_auto] lg:items-end"
      >
        <Field id="area" label={t.area}>
          <select id="area" value={area} onChange={(e) => setArea(e.target.value)} className="h-11 w-full rounded-lg bg-surface-2 px-3 text-ink">
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
        <Field id="guards" label={t.guardsNeeded}>
          <input id="guards" type="number" min={1} max={200} value={guards} onChange={(e) => setGuards(+e.target.value)} className="num h-11 w-full rounded-lg bg-surface-2 px-3 text-ink" />
        </Field>
        <Field id="female" label={t.femaleNeeded}>
          <input id="female" type="number" min={0} max={guards} value={female} onChange={(e) => setFemale(+e.target.value)} className="num h-11 w-full rounded-lg bg-surface-2 px-3 text-ink" />
        </Field>
        <Field id="firstaid" label={t.firstAidNeeded}>
          <input id="firstaid" type="number" min={0} max={guards} value={firstAid} onChange={(e) => setFirstAid(+e.target.value)} className="num h-11 w-full rounded-lg bg-surface-2 px-3 text-ink" />
        </Field>
        <Field id="start" label={t.startDate}>
          <input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="num h-11 w-full rounded-lg bg-surface-2 px-3 text-ink" />
        </Field>
        <button type="submit" disabled={busy} className="h-11 rounded-xl bg-primary px-5 text-[0.9375rem] font-semibold text-primary-fg disabled:opacity-50">
          {busy ? t.loading : t.run}
        </button>
      </form>

      {error && <p className="rounded-md bg-crit/5 p-3 text-sm text-crit">{error}</p>}

      {result && (
        <div className="rise grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="panel p-6">
            <div className="flex flex-wrap items-end gap-x-12 gap-y-5">
              <div>
                <div className="label">{t.covered}</div>
                <div className="figure mt-2 text-[3rem] text-ink" dir="ltr">
                  {result.covered}
                  <span className="ms-2 text-[1rem] font-semibold text-muted">/ {guards}</span>
                </div>
              </div>
              <div>
                <div className="label">{t.hiringGap}</div>
                <div className={`figure mt-2 text-[3rem] ${result.hiring_gap ? "text-crit" : "text-ok"}`} dir="ltr">
                  {result.hiring_gap}
                </div>
              </div>
              {result.avg_commute_km !== null && (
                <div>
                  <div className="label">{t.avgCommute}</div>
                  <div className="figure mt-2 text-[2rem] text-ink" dir="ltr">
                    {result.avg_commute_km}
                    <span className="ms-1.5 text-[0.875rem] font-semibold text-muted">km</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-crit/15" aria-hidden="true">
              <div className="h-full rounded-full bg-ink" style={{ width: `${coveredPct}%` }} />
            </div>
            {(result.female_shortfall > 0 || result.first_aid_shortfall > 0) && (
              <ul className="mt-4 space-y-1 text-[0.9375rem] font-semibold text-warn">
                {result.female_shortfall > 0 && <li>{t.shortfall(result.female_shortfall, t.femaleWord)}</li>}
                {result.first_aid_shortfall > 0 && <li>{t.shortfall(result.first_aid_shortfall, t.firstAidWord)}</li>}
              </ul>
            )}
            <p className="mt-5 text-[0.8125rem] text-muted">{result.note}</p>
          </section>

          <section className="panel p-6">
            <h2 className="title text-[1.0625rem] text-ink">{t.fromAcc}</h2>
            <ul className="mt-4 space-y-3">
              {result.from_accommodation.map((a) => (
                <li key={a.name}>
                  <div className="flex justify-between text-[0.875rem]">
                    <span className="text-ink">{a.name}</span>
                    <span className="num font-semibold text-ink">{a.guards}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(a.guards / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <h3 className="label mt-6">{t.crewSample}</h3>
            <ul className="mt-2 divide-y divide-hairline text-[0.875rem]">
              {result.crew_sample.slice(0, 5).map((c) => (
                <li key={c.name + c.accommodation} className="flex justify-between gap-3 py-2">
                  <span className="truncate text-ink">
                    {c.name} <span className="text-muted">({c.nationality})</span>
                  </span>
                  <span className="num shrink-0 text-muted" dir="ltr">
                    {c.commute_km} km
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
