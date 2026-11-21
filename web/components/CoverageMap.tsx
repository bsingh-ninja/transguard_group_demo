"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Overview, Site } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { EASE_OUT, TONIGHT } from "@/lib/motion";

// The coast from Abu Dhabi to Dubai, south-west to north-east (land lies to the south-east)
const COAST: [number, number][] = [
  [24.2, 54.1],
  [24.44, 54.28],
  [24.53, 54.33],
  [24.58, 54.42],
  [24.62, 54.52],
  [24.68, 54.62],
  [24.76, 54.74],
  [24.86, 54.86],
  [24.95, 54.96],
  [25.02, 55.03],
  [25.07, 55.08],
  [25.11, 55.12],
  [25.16, 55.18],
  [25.21, 55.23],
  [25.25, 55.27],
  [25.29, 55.3],
  [25.33, 55.35],
  [25.38, 55.4],
  [25.5, 55.55],
];

/** Each inset is one city, drawn equirectangular and scaled by cos(latitude) so distances look right. */
const REGIONS = {
  dubai: { lon0: 54.98, lon1: 55.46, lat0: 24.98, lat1: 25.33 },
  abudhabi: { lon0: 54.3, lon1: 54.7, lat0: 24.3, lat1: 24.6 },
} as const;
export type Region = keyof typeof REGIONS;

const W = 360;

function projection(region: Region) {
  const r = REGIONS[region];
  const k = Math.cos((((r.lat0 + r.lat1) / 2) * Math.PI) / 180);
  const sx = W / (r.lon1 - r.lon0);
  const sy = sx / k;
  const H = Math.round((r.lat1 - r.lat0) * sy);
  const x = (lon: number) => (lon - r.lon0) * sx;
  const y = (lat: number) => (r.lat1 - lat) * sy;
  const inside = (lat: number, lon: number) => lon >= r.lon0 - 0.01 && lon <= r.lon1 + 0.01 && lat >= r.lat0 - 0.01 && lat <= r.lat1 + 0.01;
  const land = [...COAST.map(([la, lo]) => `${x(lo)},${y(la)}`), `${x(56)},${y(25.5)}`, `${x(56)},${y(24)}`, `${x(54)},${y(24)}`].join(" ");
  return { H, x, y, inside, land };
}

const short = (name: string) => name.replace("Government", "Gov.").replace("Office ", "");

/**
 * One city at night: covered posts are warm city lights, open posts glow red, likely no-shows glow amber,
 * staff residences are gold diamonds. Lights come on together; problem sites then glow, red before amber.
 */
export default function NightMap({ data, region, onPick }: { data: Overview; region: Region; onPick: (s: Site) => void }) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const { H, x, y, inside, land } = projection(region);
  const city = region === "dubai" ? t.dubai : t.abuDhabi;
  const sites = data.sites.filter((s) => inside(s.lat, s.lon));
  const covered = sites.filter((s) => s.status === "covered");
  const problems = sites
    .filter((s) => s.status !== "covered")
    .sort((a, b) => (a.status === "short" ? 0 : 1) - (b.status === "short" ? 0 : 1));
  const homes = data.accommodation.filter((a) => inside(a.lat, a.lon));
  let crit = 0,
    warn = 0;

  return (
    <figure className="relative m-0 min-w-0 flex-1 basis-[260px] overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgb(255_255_255/0.07)]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.mapOf(city)} className="block h-auto w-full" style={{ direction: "ltr" }}>
        <rect width={W} height={H} fill="var(--night-sea)" />
        {Array.from({ length: Math.ceil(W / 40) }, (_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2={H} stroke="#fff" strokeOpacity="0.035" />
        ))}
        {Array.from({ length: Math.ceil(H / 40) }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2={W} y2={i * 40} stroke="#fff" strokeOpacity="0.035" />
        ))}
        <polygon points={land} fill="var(--night-land)" stroke="var(--night-coast)" strokeWidth="1.2" />

        {homes.map((a) => (
          <rect
            key={a.name}
            x={x(a.lon) - 4}
            y={y(a.lat) - 4}
            width="8"
            height="8"
            transform={`rotate(45 ${x(a.lon)} ${y(a.lat)})`}
            fill="var(--gold)"
          >
            <title>{a.name}</title>
          </rect>
        ))}

        <motion.g
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: TONIGHT.lights }}
        >
          {covered.map((s) => (
            <g key={s.id}>
              <circle cx={x(s.lon)} cy={y(s.lat)} r="5" fill="var(--night-light)" fillOpacity="0.08" />
              <circle cx={x(s.lon)} cy={y(s.lat)} r="2.2" fill="var(--night-light)" fillOpacity="0.85" />
              <title>{`${s.name}: ${s.assigned}/${s.night_required}`}</title>
            </g>
          ))}
        </motion.g>

        <AnimatePresence>
          {problems.map((s) => {
            const red = s.status === "short";
            const color = red ? "var(--glow-crit)" : "var(--glow-warn)";
            // red sites glow first, then amber; each gap a little shorter than the last
            const delay = red
              ? TONIGHT.haloCrit + [0, 0.08, 0.14, 0.18][Math.min(crit++, 3)]
              : TONIGHT.haloWarn + [0, 0.05, 0.09, 0.12][Math.min(warn++, 3)];
            const cx = x(s.lon),
              cy = y(s.lat);
            const right = cx < W * 0.62;
            return (
              <motion.g
                key={s.id}
                onClick={() => onPick(s)}
                className="cursor-pointer"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.25 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.3 } }}
                transition={reduce ? { duration: 0.2 } : { duration: 0.62, ease: EASE_OUT, delay }}
              >
                <circle cx={cx} cy={cy} r="20" fill={color} fillOpacity="0.1" />
                <circle cx={cx} cy={cy} r="12" fill={color} fillOpacity="0.22" />
                <circle cx={cx} cy={cy} r="5.5" fill={color} stroke="#fff" strokeWidth="1.5" />
                {red && !reduce && (
                  // one quiet ping every few seconds, only on open posts
                  <motion.circle
                    cx={cx}
                    cy={cy}
                    r="5.5"
                    fill="none"
                    stroke="var(--glow-crit)"
                    strokeWidth="2"
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    initial={{ opacity: 0, scale: 1 }}
                    animate={{ opacity: [0.7, 0], scale: [1, 2.8] }}
                    transition={{
                      duration: 1.3,
                      ease: EASE_OUT,
                      delay: 2.6 + delay - TONIGHT.haloCrit,
                      repeat: Infinity,
                      repeatDelay: 4.7,
                    }}
                  />
                )}
                <text
                  x={cx + (right ? 18 : -18)}
                  y={cy - 1}
                  textAnchor={right ? "start" : "end"}
                  fill="var(--night-ink)"
                  fontSize="12.5"
                  fontWeight="700"
                  stroke="var(--night-land)"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {short(s.name)}
                </text>
                <text
                  x={cx + (right ? 18 : -18)}
                  y={cy + 13}
                  textAnchor={right ? "start" : "end"}
                  fill={red ? "var(--night-crit)" : "var(--night-warn)"}
                  fontSize="11"
                  fontWeight="600"
                  stroke="var(--night-land)"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {red ? t.postsOpen(s.vacancies) : t.legendRisk}
                </text>
                <title>{`${s.name}: ${s.assigned}/${s.night_required}`}</title>
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
      <figcaption className="absolute bottom-2.5 start-2.5 rounded-full bg-[rgb(21_19_17/0.8)] px-2.5 py-1 text-[12px] font-bold text-night-ink shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
        {city} · <span dir="ltr">{t.nSites(sites.length)}</span>
      </figcaption>
    </figure>
  );
}

export function MapLegend() {
  const { t } = useLang();
  const dot = (bg: string, size: number, glow: string) => (
    <span
      className="rounded-full"
      style={{ width: size, height: size, background: bg, boxShadow: `0 0 0 ${size > 6 ? 4 : 3}px ${glow}` }}
    />
  );
  return (
    <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[12.5px] text-night-muted">
      <span className="inline-flex items-center gap-[7px]">
        {dot("var(--night-light)", 6, "rgb(243 223 174 / 0.15)")}
        {t.legendCovered}
      </span>
      <span className="inline-flex items-center gap-[7px]">
        {dot("var(--glow-warn)", 9, "rgb(240 166 58 / 0.2)")}
        {t.legendRisk}
      </span>
      <span className="inline-flex items-center gap-[7px]">
        {dot("var(--glow-crit)", 9, "rgb(255 77 83 / 0.2)")}
        {t.legendShort}
      </span>
      <span className="inline-flex items-center gap-[7px]">
        <span className="size-[7px] rotate-45 bg-gold" />
        {t.legendHome}
      </span>
    </div>
  );
}
