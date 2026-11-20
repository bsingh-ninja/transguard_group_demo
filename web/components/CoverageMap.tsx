"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Overview, Site } from "@/lib/api";
import { useLang } from "@/lib/i18n";

// Schematic map of the coast from Abu Dhabi to Dubai (equirectangular, scaled by cos(latitude))
const LON0 = 54.28, LON1 = 55.52, LAT0 = 24.28, LAT1 = 25.38;
const W = 1000;
const K = Math.cos((24.83 * Math.PI) / 180);
const H = Math.round((W * (LAT1 - LAT0)) / ((LON1 - LON0) * K));
const x = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * W;
const y = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;

// Approximate coastline, south-west to north-east (land lies to the south-east)
const COAST: [number, number][] = [
  [24.44, 54.28], [24.53, 54.33], [24.58, 54.42], [24.62, 54.52], [24.68, 54.62], [24.76, 54.74], [24.86, 54.86],
  [24.95, 54.96], [25.02, 55.03], [25.07, 55.08], [25.11, 55.12], [25.16, 55.18], [25.21, 55.23], [25.25, 55.27],
  [25.29, 55.3], [25.33, 55.35], [25.38, 55.4],
];
const LAND = [...COAST.map(([la, lo]) => `${x(lo)},${y(la)}`), `${W},${y(25.38)}`, `${W},${H}`, `0,${H}`, `0,${y(24.44)}`].join(" ");

const STYLE: Record<Site["status"], { r: number; fill: string }> = {
  covered: { r: 3.6, fill: "var(--text-muted)" },
  at_risk: { r: 6.5, fill: "var(--warn)" },
  short: { r: 8, fill: "var(--crit)" },
};

export default function CoverageMap({ data, onPick }: { data: Overview; onPick: (s: Site) => void }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const spring = { type: "spring" as const, bounce: 0, duration: 0.6 };
  const ordered = [...data.sites].sort((a, b) => STYLE[a.status].r - STYLE[b.status].r); // important dots on top
  const labelled = data.sites.filter((s) => s.status !== "covered");

  return (
    <figure className="panel overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-5 pt-4">
        <figcaption className="title text-ink">{t.mapTitle}</figcaption>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
          <Legend color="var(--text-muted)" size={7} label={t.legendCovered} />
          <Legend color="var(--warn)" size={10} label={t.legendRisk} />
          <Legend color="var(--crit)" size={12} label={t.legendShort} />
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rotate-45 bg-accent" /> {t.legendHome}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block h-auto w-full" role="img" aria-label={t.mapTitle} style={{ direction: "ltr" }}>
        <rect width={W} height={H} fill="var(--map-sea)" />
        <polygon points={LAND} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth="2" />
        <text x={x(55.4)} y={y(24.98)} fontSize="22" fontWeight="700" fill="var(--text-muted)" opacity="0.6">
          Dubai
        </text>
        <text x={x(54.4)} y={y(24.36)} fontSize="22" fontWeight="700" fill="var(--text-muted)" opacity="0.6">
          Abu Dhabi
        </text>
        {data.accommodation.map((a) => (
          <g key={a.name}>
            <rect x={x(a.lon) - 6} y={y(a.lat) - 6} width="12" height="12" transform={`rotate(45 ${x(a.lon)} ${y(a.lat)})`} fill="var(--accent)" />
            <title>{a.name}</title>
          </g>
        ))}
        {ordered.map((s, i) => {
          const st = STYLE[s.status];
          const open = s.status !== "covered";
          return (
            <g key={s.id} onClick={() => open && onPick(s)} className={open ? "cursor-pointer" : ""}>
              <AnimatePresence>
                {s.status === "short" && (
                  <motion.circle
                    cx={x(s.lon)} cy={y(s.lat)} fill="none" stroke="var(--crit)" strokeWidth="2"
                    initial={{ r: reduce ? 16 : 6, opacity: 0 }}
                    animate={{ r: 16, opacity: 0.45 }}
                    exit={{ r: reduce ? 16 : 28, opacity: 0 }}
                    transition={{ ...spring, delay: reduce ? 0 : 0.3 + (i % 6) * 0.05 }}
                  />
                )}
              </AnimatePresence>
              {/* covered posts are static; open posts pop in, and spring down to "covered" when a guard is assigned */}
              <motion.circle
                cx={x(s.lon)} cy={y(s.lat)} stroke="var(--surface)" strokeWidth="1.5"
                fill={st.fill}
                style={{ transition: "fill 500ms ease" }}
                initial={open && !reduce ? { r: 0, opacity: 1 } : false}
                animate={{ r: st.r, opacity: open ? 1 : 0.55 }}
                transition={{ ...spring, delay: open && !reduce ? 0.25 + (i % 6) * 0.05 : 0 }}
              />
              <title>{`${s.name}: ${s.assigned}/${s.night_required}`}</title>
            </g>
          );
        })}
        <AnimatePresence>
          {labelled.map((s, i) => {
            const right = s.lon < 55.25;
            const lx = x(s.lon) + (right ? 22 : -22);
            return (
              <motion.text key={s.id} x={lx} y={y(s.lat) + 5 + (i % 2) * 2} fontSize="17" fontWeight="700" textAnchor={right ? "start" : "end"}
                fill={s.status === "short" ? "var(--crit)" : "var(--warn)"} stroke="var(--map-land)" strokeWidth="5" paintOrder="stroke"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, delay: reduce ? 0 : 0.45 }}>
                {s.name}
              </motion.text>
            );
          })}
        </AnimatePresence>
      </svg>
      <div className="px-5 pb-3 pt-1 text-[0.75rem] text-muted">{t.schematic}</div>
    </figure>
  );
}

function Legend({ color, size, label }: { color: string; size: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-full" style={{ background: color, width: size, height: size }} />
      {label}
    </span>
  );
}
