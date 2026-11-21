"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { refreshCounts } from "@/components/Sidebar";
import { Avatar, ErrorBox, IconTile, Pill, Skeleton, StatTile, Trail, WakingUp } from "@/components/ui";
import { getJSON, loadWithWake, postJSON, SiteOption, Ticket, Triage } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { EASE_OUT, rise, SPRING_SNAP } from "@/lib/motion";

/** Priority tile colours on the dark card: red for P1, amber for P2, gold for P3, quiet for P4 */
const TILE: Record<string, string> = {
  P1: "bg-glow-crit text-white shadow-[0_12px_30px_-10px_rgb(255_77_83/0.6)]",
  P2: "bg-glow-warn text-[#151311] shadow-[0_12px_30px_-10px_rgb(240_166_58/0.5)]",
  P3: "bg-gold text-[#151311]",
  P4: "bg-white/12 text-white",
};
const PILL_TONE: Record<string, "crit" | "warn" | "gold" | "neutral"> = { P1: "crit", P2: "warn", P3: "gold", P4: "neutral" };

export default function Tickets() {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [waking, setWaking] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(
    (select?: number) =>
      getJSON<Ticket[]>("/transguard/tickets").then((rows) => {
        setTickets(rows);
        setSelected((s) => select ?? s ?? rows[rows.length - 1]?.id ?? null);
      }),
    [],
  );
  const first = useCallback(() => {
    setLoadError("");
    loadWithWake(
      () => load(),
      () => setWaking(true),
    )
      .then(() => setLoaded(true))
      .catch((e) => setLoadError(String(e.message)))
      .finally(() => setWaking(false));
  }, [load]);
  useEffect(first, [first]);

  const ticket = typeof selected === "number" ? tickets.find((x) => x.id === selected) : undefined;
  const runTriage = async (body: object) => {
    setBusy(true);
    setError("");
    try {
      const r = await postJSON<Triage & { ticket_id?: number }>("/transguard/tickets/triage", body);
      await load(r.ticket_id);
      refreshCounts();
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
      refreshCounts();
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <ErrorBox message={loadError} onRetry={first} />;
  if (!loaded && waking) return <WakingUp />;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-bold text-gold-ink">{t.ticketsKicker(tickets.length)}</p>
          <h1 className="mt-1 text-[clamp(1.75rem,1.4rem+1vw,2.125rem)] font-bold leading-[1.1] tracking-[-0.028em] text-ink rtl:tracking-normal">
            {t.ticketsHeadline}
          </h1>
        </div>
        <button
          onClick={() => setSelected("new")}
          className="inline-flex h-[46px] items-center gap-2 rounded-[13px] bg-ink px-5 text-[15px] font-bold text-bg hover:opacity-90"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t.newReport}
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-[22px]">
        <ul
          aria-label={t.navTickets}
          aria-busy={!loaded}
          className="card flex max-h-[78vh] min-w-0 max-w-[370px] flex-[1_1_330px] flex-col overflow-y-auto rounded-[22px] p-1.5"
        >
          {!loaded &&
            [0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="space-y-2 px-3.5 py-3">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3.5 w-full" />
              </li>
            ))}
          {tickets.map((tk) => {
            const on = selected === tk.id;
            return (
              <li key={tk.id} className="relative">
                {on && (
                  // the dark selection slides between rows instead of jumping
                  <motion.span
                    layoutId="ticket-on"
                    transition={reduce ? { duration: 0 } : SPRING_SNAP}
                    className="absolute inset-0 rounded-2xl bg-night"
                    aria-hidden="true"
                  />
                )}
                <button
                  data-tour={/^lift/i.test(tk.description) ? "ticket-lift" : undefined}
                  onClick={() => setSelected(tk.id)}
                  aria-current={on}
                  className={`press-soft relative block w-full rounded-2xl px-3.5 py-3 text-start transition-colors duration-200 ${on ? "text-night-ink" : "text-ink hover:bg-surface-2/60"}`}
                >
                  <div className="flex items-center gap-2 text-[12px]">
                    {tk.triage && (
                      <span className={`rounded-md px-1.5 py-px font-extrabold ${on ? TILE[tk.triage.priority] + " shadow-none" : ""}`}>
                        {on ? tk.triage.priority : <Pill tone={PILL_TONE[tk.triage.priority]}>{tk.triage.priority}</Pill>}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${
                        tk.status === "dispatched"
                          ? on
                            ? "bg-night-ok/16 text-night-ok"
                            : "bg-ok/10 text-ok"
                          : on
                            ? "bg-white/10 text-night-soft"
                            : "bg-surface-2 text-muted"
                      }`}
                    >
                      {t.status[tk.status as keyof typeof t.status] ?? tk.status}
                    </span>
                    <span className={`ms-auto ${on ? "text-night-muted" : "text-muted/80"}`}>
                      {tk.channel} · <span dir="ltr">{tk.created}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 text-[14.5px] font-bold">{tk.site}</div>
                  <p dir="auto" className={`line-clamp-2 text-start text-[13px] leading-snug ${on ? "text-night-soft" : "text-muted"}`}>
                    {tk.description}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={String(selected)}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="flex min-w-0 flex-[999_1_520px] flex-col gap-5"
          >
            {error && <p className="rounded-xl bg-crit/5 p-3 text-sm text-crit">{error}</p>}
            {selected === "new" ? (
              <NewReport busy={busy} onSubmit={(body) => runTriage(body)} />
            ) : ticket ? (
              <TicketDetail
                ticket={ticket}
                busy={busy}
                onTriage={() => runTriage({ ticket_id: ticket.id })}
                onDispatch={() => dispatch(ticket)}
              />
            ) : null}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TicketDetail({
  ticket,
  busy,
  onTriage,
  onDispatch,
}: {
  ticket: Ticket;
  busy: boolean;
  onTriage: () => void;
  onDispatch: () => void;
}) {
  const { t } = useLang();
  const tr = ticket.triage;
  if (tr) return <TriageView ticket={ticket} tr={tr} busy={busy} onDispatch={onDispatch} />;
  return (
    <>
      <div className="card rounded-[22px] p-6">
        <div className="text-[13px] font-semibold text-muted">
          {ticket.site} · {ticket.area} · {t.reportedVia(ticket.channel, ticket.created)}
        </div>
        <p dir="auto" className="mt-2 text-start text-[17px] leading-relaxed text-ink">
          {ticket.description}
        </p>
        <button
          data-tour="triage"
          onClick={onTriage}
          disabled={busy}
          className="mt-5 inline-flex h-[46px] items-center gap-2 rounded-[13px] bg-ink px-5 text-[15px] font-bold text-bg hover:opacity-90 disabled:opacity-60"
        >
          {busy && <span className="size-4 animate-spin rounded-full border-2 border-bg/30 border-t-bg" aria-hidden="true" />}
          {busy ? t.triaging : t.triage}
        </button>
      </div>
      {busy && (
        <div className="space-y-5" aria-busy="true">
          <Skeleton className="h-[300px] rounded-3xl" />
          <div className="flex flex-wrap gap-5">
            <Skeleton className="h-[260px] flex-[999_1_360px] rounded-[22px]" />
            <Skeleton className="h-[260px] flex-[1_1_280px] rounded-[22px]" />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The triage, in reading order: the priority lands first, then the progress trail fills step by step,
 * then the checklist and the technician follow. Dispatching turns the last step green in place.
 */
function TriageView({ ticket, tr, busy, onDispatch }: { ticket: Ticket; tr: Triage; busy: boolean; onDispatch: () => void }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const sent = ticket.status === "dispatched";
  const tech = tr.technician;
  return (
    <>
      <motion.section {...rise(reduce, 0, 18, 0.62)} aria-label={t.triage} className="night p-[26px]">
        <div className="flex items-start gap-[18px]">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.52, delay: 0.16 }}
            className={`relative grid size-[76px] shrink-0 place-items-center rounded-[20px] text-[30px] font-extrabold tracking-[-0.03em] ${TILE[tr.priority] ?? TILE.P4}`}
          >
            {tr.priority}
            {tr.priority === "P1" && !reduce && (
              // one quiet ring every few seconds while a P1 waits
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-[20px] shadow-[0_0_0_3px_var(--glow-crit)]"
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: sent ? 0 : [0.75, 0], scale: sent ? 1 : [1, 1.45] }}
                transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.62, repeat: sent ? 0 : Infinity, repeatDelay: 4.9 }}
              />
            )}
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-night-muted">
              {ticket.site} · {tr.trade} · {t.reportedVia(ticket.channel, ticket.created)}
            </div>
            <h2 className="mt-1 text-[26px] font-bold leading-[1.15] tracking-[-0.024em] text-white rtl:tracking-normal">{tr.issue}</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-[7px] rounded-full bg-white/8 px-[11px] py-[5px] text-[13px] font-semibold">
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {t.respondWithin(tr.sla_hours)} · {t.dueBy} <span dir="ltr">{tr.due_by}</span>
              </span>
              {tr.safety_risk && (
                <span className="inline-flex items-center gap-[7px] rounded-full bg-glow-crit/16 px-[11px] py-[5px] text-[13px] font-semibold text-[#ff8a8e]">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                  {t.safetyChip}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-[18px] text-[14.5px] leading-relaxed text-night-soft">{tr.priority_reason}</p>
        {tr.photo_observations && (
          <p className="mt-2 text-[13.5px] text-night-muted">
            <span className="font-semibold text-night-ink">{t.photoShows}</span> {tr.photo_observations}
          </p>
        )}
        <div className="mt-[22px] border-t border-night-line pt-[18px]">
          <Trail
            dark
            steps={[
              { title: t.trailReported, sub: `${ticket.channel}, ${ticket.created}`, done: true },
              { title: t.trailTriaged, sub: `${tr.priority}, ${tr.trade}`, done: true },
              { title: t.trailTech, sub: tech ? `${tech.name}, ${tech.distance_km} km` : "—", done: !!tech },
              {
                title: sent ? t.trailDispatched : t.trailDispatch,
                sub: sent && tech ? t.onTheWay(tech.eta_min) : t.waitingForYou,
                done: sent,
              },
            ]}
          />
        </div>
      </motion.section>

      <div className="flex flex-wrap items-start gap-5">
        <motion.section
          {...rise(reduce, 0.12, 12)}
          aria-label={t.checklist}
          className="card min-w-0 flex-[999_1_360px] rounded-[22px] px-6 py-[22px]"
        >
          <h3 className="mb-3 text-[16px] font-bold tracking-[-0.01em] text-ink">{t.checklist}</h3>
          <ol className="flex flex-col gap-2.5 text-[14.5px] leading-normal text-ink">
            {tr.checklist.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-bg">
                  {i + 1}
                </span>
                {c}
              </li>
            ))}
          </ol>
          <h3 className="mb-2.5 mt-5 text-[13px] font-bold text-muted">{t.likelyParts}</h3>
          <div className="flex flex-wrap gap-1.5">
            {tr.likely_parts.map((p) => (
              <span key={p} className="rounded-full bg-surface-2 px-[11px] py-[5px] text-[13px] font-semibold text-ink">
                {p}
              </span>
            ))}
          </div>
        </motion.section>

        {tech && (
          <motion.section
            {...rise(reduce, 0.18, 12)}
            aria-label={t.nearestTech}
            className="card min-w-0 flex-[1_1_280px] rounded-[22px] p-[22px]"
          >
            <h3 className="text-[13px] font-bold text-muted">{t.nearestTech}</h3>
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={tech.name} tone="gold" size={52} />
              <div>
                <div className="text-[19px] font-bold tracking-[-0.012em] text-ink">{tech.name}</div>
                <div className="text-[13px] text-muted">
                  {tech.trade} · {tech.area}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile value={`${tech.distance_km} km`} label={t.away} />
              <StatTile value={`${tech.eta_min} min`} label={t.eta} />
              <StatTile value={tech.jobs_today} label={t.jobsToday} />
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              {sent ? (
                <motion.div
                  key="sent"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.26, ease: EASE_OUT }}
                  className="mt-4 flex min-h-[50px] items-center gap-2.5 rounded-[14px] bg-ok/10 px-3.5 py-2 text-[14px] font-bold leading-snug text-ok"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                  {t.onTheWay(tech.eta_min)}
                </motion.div>
              ) : (
                <motion.button
                  key="send"
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  data-tour="dispatch"
                  onClick={onDispatch}
                  disabled={busy}
                  className="mt-4 h-[50px] w-full rounded-[14px] bg-ink text-[15px] font-bold text-bg hover:opacity-90 disabled:opacity-60"
                >
                  {t.dispatchTo(tech.name)}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </div>
    </>
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
      className="card space-y-4 rounded-[22px] p-6"
    >
      <h2 className="text-[20px] font-bold tracking-[-0.016em] text-ink">{t.newReport}</h2>
      <div className="flex items-end gap-3">
        <IconTile type={sites.find((s) => s.id === site)?.type ?? ""} tone="neutral" size={46} />
        <div className="min-w-0 flex-1">
          <label htmlFor="site" className="mb-1.5 block text-[13px] font-semibold text-muted">
            {t.site}
          </label>
          <select
            id="site"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="h-[46px] w-full rounded-xl bg-surface-2 px-3 text-[15px] font-semibold text-ink"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="desc" className="mb-1.5 block text-[13px] font-semibold text-muted">
          {t.whatHappened}
        </label>
        <textarea
          id="desc"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={t.whatHappenedHint}
          className="w-full rounded-xl bg-surface-2 px-3.5 py-3 text-ink placeholder:text-muted"
        />
      </div>
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-muted">{t.photoOptional}</span>
        <label className="press-soft flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-border p-4 hover:border-gold">
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
      <button
        type="submit"
        disabled={busy || !site || (!text.trim() && !photo)}
        className="h-[50px] w-full rounded-[14px] bg-ink text-[15px] font-bold text-bg hover:opacity-90 disabled:opacity-50"
      >
        {busy ? t.triaging : t.triage}
      </button>
    </form>
  );
}
