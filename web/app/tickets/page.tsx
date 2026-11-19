"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { getJSON, postJSON, SiteOption, Ticket, Triage } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const PRIORITY: Record<string, string> = {
  P1: "bg-crit text-white",
  P2: "bg-warn text-white",
  P3: "bg-accent text-white",
  P4: "bg-surface-2 text-ink",
};
const STATUS: Record<string, string> = { new: "bg-primary/10 text-primary", triaged: "bg-warn/15 text-warn", dispatched: "bg-ok/12 text-ok" };

export default function Tickets() {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    (select?: number) =>
      getJSON<Ticket[]>("/transguard/tickets").then((rows) => {
        setTickets(rows);
        setSelected((s) => select ?? s ?? rows[rows.length - 1]?.id ?? null);
      }),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const ticket = typeof selected === "number" ? tickets.find((x) => x.id === selected) : undefined;
  const runTriage = async (body: object, then?: (id: number) => void) => {
    setBusy(true);
    setError("");
    try {
      const r = await postJSON<Triage & { ticket_id?: number }>("/transguard/tickets/triage", body);
      await load(r.ticket_id);
      then?.(r.ticket_id ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const dispatch = async (tk: Ticket) => {
    if (!tk.triage?.technician) return;
    setBusy(true);
    try {
      await postJSON("/transguard/tickets/dispatch", { ticket_id: tk.id, technician_id: tk.triage.technician.id });
      await load(tk.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">{t.navTickets}</p>
          <h1 className="display mt-2 max-w-[24ch] text-ink">{t.ticketsTitle}</h1>
          <p className="mt-3 max-w-[60ch] text-[1.0625rem] leading-relaxed text-muted">{t.ticketsIntro}</p>
        </div>
        <button onClick={() => setSelected("new")} className="h-11 rounded-xl bg-primary px-5 text-[0.9375rem] font-semibold text-primary-fg">
          {t.newReport}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <ul className="panel max-h-[70vh] overflow-y-auto">
          {tickets.map((tk) => (
            <li key={tk.id} className="border-t border-hairline first:border-t-0">
              <button
                onClick={() => setSelected(tk.id)}
                aria-current={selected === tk.id}
                className={`press-soft block w-full px-4 py-3.5 text-start transition-colors ${selected === tk.id ? "bg-accent-soft" : "hover:bg-surface-2/60"}`}
              >
                <div className="flex items-center gap-2 text-[0.75rem]">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS[tk.status] ?? ""}`}>{t.status[tk.status as keyof typeof t.status] ?? tk.status}</span>
                  {tk.triage && <span className={`rounded px-1.5 py-0.5 font-bold ${PRIORITY[tk.triage.priority]}`}>{tk.triage.priority}</span>}
                  <span className="ms-auto text-muted" dir="ltr">
                    {tk.channel}, {tk.created}
                  </span>
                </div>
                <div className="mt-1.5 truncate font-semibold text-ink">{tk.site}</div>
                <p dir="auto" className="line-clamp-2 text-start text-[0.875rem] leading-snug text-muted">{tk.description}</p>
              </button>
            </li>
          ))}
        </ul>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={String(selected)}
            initial={{ opacity: 0, x: reduce ? 0 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="min-w-0"
          >
            {error && <p className="mb-3 rounded-md bg-crit/5 p-3 text-sm text-crit">{error}</p>}
            {selected === "new" ? (
              <NewReport busy={busy} onSubmit={(body) => runTriage(body)} />
            ) : ticket ? (
              <TicketDetail ticket={ticket} busy={busy} onTriage={() => runTriage({ ticket_id: ticket.id })} onDispatch={() => dispatch(ticket)} />
            ) : null}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TicketDetail({ ticket, busy, onTriage, onDispatch }: { ticket: Ticket; busy: boolean; onTriage: () => void; onDispatch: () => void }) {
  const { t } = useLang();
  const tr = ticket.triage;
  return (
    <div className="space-y-5">
      <div className="panel p-6">
        <div className="label">
          {ticket.site}, {ticket.area}
        </div>
        <p dir="auto" className="mt-2 text-start text-[1.0625rem] leading-relaxed text-ink">{ticket.description}</p>
        {!tr && (
          <button onClick={onTriage} disabled={busy} className="mt-5 h-11 rounded-xl bg-primary px-5 text-[0.9375rem] font-semibold text-primary-fg disabled:opacity-50">
            {busy ? t.triaging : t.triage}
          </button>
        )}
      </div>
      {tr && <TriageCard tr={tr} dispatched={ticket.status === "dispatched"} busy={busy} onDispatch={onDispatch} />}
    </div>
  );
}

function TriageCard({ tr, dispatched, busy, onDispatch }: { tr: Triage; dispatched: boolean; busy: boolean; onDispatch: () => void }) {
  const { t } = useLang();
  return (
    <div className="rise grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="panel p-6">
        <div className="flex items-start gap-4">
          <span className={`figure rounded-xl px-3 py-2 text-[1.5rem] ${PRIORITY[tr.priority]}`}>{tr.priority}</span>
          <div className="min-w-0">
            <div className="label">{tr.trade}</div>
            <h2 className="title mt-0.5 text-ink">{tr.issue}</h2>
            <p className="mt-1 text-[0.9375rem] text-muted">
              {t.respondWithin(tr.sla_hours)}, {t.dueBy} {tr.due_by}
            </p>
          </div>
        </div>
        {tr.safety_risk && <p className="mt-4 rounded-lg bg-crit/8 px-3 py-2 text-[0.875rem] font-semibold text-crit">{t.safetyRisk}</p>}
        <p className="mt-4 text-[0.9375rem] text-ink/85">{tr.priority_reason}</p>
        {tr.photo_observations && (
          <p className="mt-3 text-[0.875rem] text-muted">
            <span className="font-semibold text-ink">{t.photoShows}</span> {tr.photo_observations}
          </p>
        )}
        <h3 className="label mt-5">{t.checklist}</h3>
        <ol className="mt-2 space-y-2">
          {tr.checklist.map((c, i) => (
            <li key={i} className="flex gap-3 text-[0.9375rem] text-ink">
              <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.75rem] font-bold">{i + 1}</span>
              {c}
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-5">
        <div className="panel p-6">
          <h3 className="label">{t.likelyParts}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tr.likely_parts.map((p) => (
              <span key={p} className="rounded-full bg-surface-2 px-3 py-1 text-[0.8125rem] text-ink">
                {p}
              </span>
            ))}
          </div>
        </div>
        {tr.technician && (
          <div className="panel p-6">
            <h3 className="label">{t.technician}</h3>
            <div className="mt-2 text-[1.125rem] font-bold text-ink">{tr.technician.name}</div>
            <div className="text-[0.875rem] text-muted">
              {tr.technician.trade}, {tr.technician.area}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <Stat label={t.distance} value={`${tr.technician.distance_km} km`} />
              <Stat label={t.eta} value={`${tr.technician.eta_min} min`} />
              <Stat label={t.jobsToday} value={String(tr.technician.jobs_today)} />
            </dl>
            {dispatched ? (
              <p className="mt-5 flex items-center gap-2 text-[0.9375rem] font-semibold text-ok">
                <span className="size-2 rounded-full bg-ok" /> {t.dispatched}
              </p>
            ) : (
              <button onClick={onDispatch} disabled={busy} className="mt-5 h-11 w-full rounded-xl bg-primary text-[0.9375rem] font-semibold text-primary-fg disabled:opacity-50">
                {t.dispatch}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.75rem] text-muted">{label}</dt>
      <dd className="num mt-0.5 font-bold text-ink" dir="ltr">
        {value}
      </dd>
    </div>
  );
}

function NewReport({ busy, onSubmit }: { busy: boolean; onSubmit: (body: object) => void }) {
  const { t } = useLang();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [site, setSite] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ b64: string; mime: string; url: string } | null>(null);
  useEffect(() => {
    getJSON<SiteOption[]>("/transguard/sites/list").then((s) => {
      setSites(s);
      setSite(s[0]?.id ?? "");
    });
  }, []);
  const pick = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPhoto({ url, b64: url.split(",")[1], mime: f.type || "image/jpeg" });
    };
    reader.readAsDataURL(f);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ site_id: site, description: text, photo_base64: photo?.b64, photo_mime: photo?.mime });
      }}
      className="panel space-y-4 p-6"
    >
      <h2 className="title text-ink">{t.newReport}</h2>
      <div>
        <label htmlFor="site" className="label mb-1.5 block">
          {t.site}
        </label>
        <select id="site" value={site} onChange={(e) => setSite(e.target.value)} className="h-11 w-full rounded-lg bg-surface-2 px-3 text-ink">
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="desc" className="label mb-1.5 block">
          {t.whatHappened}
        </label>
        <textarea id="desc" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={t.whatHappenedHint} className="w-full rounded-lg bg-surface-2 px-3 py-2.5 text-ink placeholder:text-muted" />
      </div>
      <div>
        <span className="label mb-1.5 block">{t.photoOptional}</span>
        <label className="press-soft flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-border p-4 hover:border-accent">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="" className="size-20 rounded-lg object-cover" />
          ) : (
            <span className="grid size-20 place-items-center rounded-lg bg-surface-2 text-muted">
              <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
          )}
          <span className="text-[0.9375rem] text-ink">{photo ? t.changePhoto : t.addPhoto}</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      </div>
      <button type="submit" disabled={busy || !site || (!text.trim() && !photo)} className="h-11 w-full rounded-xl bg-primary text-[0.9375rem] font-semibold text-primary-fg disabled:opacity-50">
        {busy ? t.triaging : t.triage}
      </button>
    </form>
  );
}
