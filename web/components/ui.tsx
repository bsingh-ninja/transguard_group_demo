"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { EASE_OUT } from "@/lib/motion";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Tonight-shaped placeholder: the dark situation card with its ring and maps, and the action cards beside it */
export function Loading() {
  return (
    <div className="flex flex-wrap items-start gap-6" aria-busy="true">
      <div className="night min-w-0 flex-[999_1_600px] space-y-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex-[1_1_300px] space-y-3 [&_.skeleton]:bg-none [&_.skeleton]:bg-night-tile">
            <Skeleton className="h-6 w-56 rounded-full" />
            <Skeleton className="h-11 w-[min(420px,90%)]" />
            <Skeleton className="h-11 w-[min(300px,70%)]" />
            <Skeleton className="h-11 w-40 rounded-[13px]" />
          </div>
          <div className="size-[176px] rounded-full border-[12px] border-night-tile" />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="h-[260px] flex-[1_1_260px] rounded-2xl bg-night-tile" />
          <div className="h-[260px] flex-[1_1_260px] rounded-2xl bg-night-tile" />
        </div>
      </div>
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[250px] rounded-[20px]" />
        <Skeleton className="h-[250px] rounded-[20px]" />
      </div>
    </div>
  );
}

/** Shown while the hosted demo server wakes up; the page keeps retrying by itself. */
export function WakingUp() {
  const { t } = useLang();
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
      <div className="panel max-w-md p-8 text-center">
        <span className="relative mx-auto block size-3">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/60" />
          <span className="absolute inset-0 rounded-full bg-accent" />
        </span>
        <h2 className="title mt-5 text-ink">{t.wakingTitle}</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{t.wakingBody}</p>
      </div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-crit/30 bg-crit/5 p-4 text-sm text-crit">
      <span className="min-w-0 flex-1">{t.apiError(message)}</span>
      {onRetry && (
        <button onClick={onRetry} className="h-9 rounded-lg bg-surface px-3 font-semibold text-ink ring-1 ring-border">
          {t.retry}
        </button>
      )}
    </div>
  );
}

/**
 * A number that springs from what is on screen to its new value (interruptible: re-targets from the live value).
 * `from` sets the first value shown, so a figure can count up when it first appears.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  from,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  from?: number;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(from ?? value);
  const live = useRef(from ?? value);
  useEffect(() => {
    if (reduce) {
      live.current = value;
      setShown(value);
      return;
    }
    const c = animate(live.current, value, {
      type: "spring",
      bounce: 0,
      duration: 0.9,
      onUpdate: (v) => {
        live.current = v;
        setShown(v);
      },
    });
    return () => c.stop();
  }, [value, reduce]);
  return (
    <>
      {shown.toFixed(decimals)}
      {suffix}
    </>
  );
}

export function Figure({
  label,
  value,
  decimals = 0,
  suffix = "",
  unit,
  tone,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  unit?: string;
  tone?: "crit" | "warn";
}) {
  const color = tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="mt-2">
        <span className={`figure text-[2rem] transition-colors duration-500 ${color}`} dir="ltr">
          <AnimatedNumber value={value} decimals={decimals} suffix={suffix} from={0} />
        </span>
        {unit && <span className="ms-1.5 text-[0.8125rem] text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

/* ---------- Night-command building blocks ---------- */

/** First letters of the first and last name: "Anju Varghese" → "AV" */
export const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};

type Tone = "crit" | "warn" | "ok" | "neutral" | "gold";

const PILL: Record<Tone, string> = {
  crit: "bg-crit/10 text-crit",
  warn: "bg-warn/12 text-warn-ink",
  ok: "bg-ok/10 text-ok",
  neutral: "bg-surface-2 text-ink",
  gold: "bg-accent-soft text-gold-ink",
};

export function Pill({ tone = "neutral", className = "", children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${PILL[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const AVATAR: Record<"neutral" | "warn" | "gold" | "night", string> = {
  neutral: "bg-surface-2 text-ink",
  warn: "bg-warn/13 text-warn-ink",
  gold: "bg-accent-soft text-gold-ink ring-2 ring-gold",
  night: "bg-accent-soft text-gold-ink ring-2 ring-gold",
};

export function Avatar({ name, tone = "neutral", size = 40 }: { name: string; tone?: keyof typeof AVATAR; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.33) }}
      className={`grid shrink-0 place-items-center rounded-full font-bold ${AVATAR[tone]}`}
    >
      {initials(name)}
    </span>
  );
}

const SITE_ICON: Record<string, React.ReactNode> = {
  mall: <path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2" />,
  hospital: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  government: <path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />,
  hotel: <path d="M3 20V6M3 13h18v7M21 20v-5M7 10a2 2 0 1 0 0-.01M11 10h7a3 3 0 0 1 3 3" />,
  tower: <path d="M5 21V4h10v17M15 9h4v12M8 8h4M8 12h4M8 16h4M3 21h18" />,
  bank: <path d="M3 9l9-5 9 5M4 9h16M6 9v8M10 9v8M14 9v8M18 9v8M3 20h18" />,
  residential: <path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6" />,
};
const OTHER_ICON = <path d="M12 3l8 4v5c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V7z" />;

/** Rounded square with a site-type icon (mall, hospital, government…) */
export function IconTile({ type, tone = "crit", size = 40 }: { type: string; tone?: "crit" | "warn" | "neutral"; size?: number }) {
  const cls = tone === "crit" ? "bg-crit/10 text-crit" : tone === "warn" ? "bg-warn/12 text-warn-ink" : "bg-surface-2 text-ink";
  return (
    <span aria-hidden="true" style={{ width: size, height: size }} className={`grid shrink-0 place-items-center rounded-xl ${cls}`}>
      <svg
        viewBox="0 0 24 24"
        width={size * 0.48}
        height={size * 0.48}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SITE_ICON[type] ?? OTHER_ICON}
      </svg>
    </span>
  );
}

/** Small figure tile. `dark` for use inside a night card. */
export function StatTile({
  value,
  label,
  tone,
  dark = false,
}: {
  value: React.ReactNode;
  label: string;
  tone?: "ok" | "crit";
  dark?: boolean;
}) {
  const color = tone === "ok" ? (dark ? "text-night-ok" : "text-ok") : tone === "crit" ? (dark ? "text-night-crit" : "text-crit") : "";
  return (
    <div className={`min-w-0 rounded-xl px-2.5 py-2.5 ${dark ? "bg-night-tile" : "bg-surface-2/70"}`}>
      <div className={`num whitespace-nowrap text-[16px] font-bold leading-tight ${color}`} dir="ltr">
        {value}
      </div>
      <div className={`mt-0.5 truncate text-[11.5px] ${dark ? "text-night-muted" : "text-muted"}`}>{label}</div>
    </div>
  );
}

/**
 * Coverage gauge: an outer ring and an optional inner ring that draw from empty.
 * Values are percentages. The inner ring starts after the outer one (it is the consequence).
 */
export function Ring({
  size = 176,
  value,
  inner,
  color = "var(--night-accent)",
  innerColor = "var(--glow-warn)",
  stroke = 12,
  delay = 0.24,
  innerDelay = 0.62,
  label,
  children,
}: {
  size?: number;
  value: number;
  inner?: number;
  color?: string;
  innerColor?: string;
  stroke?: number;
  delay?: number;
  innerDelay?: number;
  label: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const c = size / 2;
  const r = c - stroke / 2 - 2;
  const ri = r - stroke - 4;
  const draw = (to: number, d: number, dur: number) =>
    reduce
      ? { initial: false as const, animate: { pathLength: to } }
      : { initial: { pathLength: 0 }, animate: { pathLength: to }, transition: { duration: dur, ease: EASE_OUT, delay: d } };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth={stroke} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          {...draw(value / 100, delay, 1.1)}
        />
        {inner !== undefined && (
          <>
            <circle cx={c} cy={c} r={ri} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth={stroke * 0.6} />
            <motion.circle
              cx={c}
              cy={c}
              r={ri}
              fill="none"
              stroke={innerColor}
              strokeWidth={stroke * 0.6}
              strokeLinecap="round"
              {...draw(inner / 100, innerDelay, 0.9)}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** A step-by-step progress trail. Steps fill in order on first show; later changes ease in place. */
export function Trail({ steps, dark = false }: { steps: { title: string; sub?: string; done: boolean }[]; dark?: boolean }) {
  const reduce = useReducedMotion();
  const delays = [0.38, 0.5, 0.6, 0.68, 0.74];
  return (
    <ol aria-label="Progress" className={`grid gap-2.5`} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => (
        <li key={i} aria-current={s.done && !steps[i + 1]?.done ? "step" : undefined}>
          <div className={`h-1 overflow-hidden rounded-full ${dark ? "bg-night-line" : "bg-surface-2"}`}>
            <motion.div
              className="h-full origin-left rounded-full rtl:origin-right"
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1, backgroundColor: s.done ? "var(--night-ok)" : "var(--night-line)" }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { scaleX: { duration: 0.44, ease: EASE_OUT, delay: delays[i] ?? 0.7 }, backgroundColor: { duration: 0.42 } }
              }
            />
          </div>
          <div className="mt-2 text-[13px] font-bold">{s.title}</div>
          {s.sub && <div className={`text-[12px] ${dark ? "text-night-muted" : "text-muted"}`}>{s.sub}</div>}
        </li>
      ))}
    </ol>
  );
}

// Apple's momentum projection and rubber-band (Designing Fluid Interfaces)
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);
const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

/**
 * Floating side sheet over a scrim. Enters and leaves from the trailing edge; the scrim fades with it.
 * Drag or flick the header to dismiss: 1:1 tracking, velocity from pointer history, momentum projection
 * decides close vs stay, spring inherits the release velocity, rubber-band past the open edge, interruptible.
 * Focus stays inside while it is open; Esc, the close button and the scrim close it.
 * `header` replaces the default title row (it receives `close`).
 */
export function Sheet({
  title,
  sub,
  onClose,
  header,
  children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  header?: (close: () => void) => React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const sign = 1; // always from the right edge, in both languages
  const [width, setWidth] = useState(500);
  const x = useMotionValue(sign * 560);
  const opacity = useMotionValue(reduce ? 0 : 1);
  const scrim = useTransform(() => (reduce ? opacity.get() : Math.max(0, 1 - Math.abs(x.get()) / width)));
  const grab = useRef<{ startX: number; start: number } | null>(null);
  const hist = useRef<{ x: number; t: number }[]>([]);
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const settle = useCallback(
    (target: number, velocity = 0) => {
      if (reduce) {
        animate(opacity, target === 0 ? 1 : 0, { duration: 0.2 }).then(() => target !== 0 && onClose());
        return;
      }
      animate(x, target, { type: "spring", bounce: Math.abs(velocity) > 400 ? 0.18 : 0, duration: 0.32, velocity }).then(
        () => target !== 0 && onClose(),
      );
    },
    [reduce, opacity, x, onClose],
  );
  const close = useCallback(() => settle(sign * (width + 24)), [settle, sign, width]);

  useEffect(() => {
    const w = Math.min(500, window.innerWidth - 24);
    setWidth(w);
    const back = document.activeElement as HTMLElement | null;
    if (reduce) {
      x.set(0);
      animate(opacity, 1, { duration: 0.2 });
    } else {
      x.set(sign * (w + 24));
      animate(x, 0, { type: "spring", bounce: 0, duration: 0.5 });
    }
    (closeRef.current ?? panel.current?.querySelector<HTMLElement>("button, a[href]"))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(sign * (w + 24));
      if (e.key !== "Tab" || !panel.current) return;
      // keep focus inside the sheet
      const items = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, select, textarea")];
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    x.stop();
    grab.current = { startX: e.clientX, start: x.get() };
    hist.current = [{ x: x.get(), t: performance.now() }];
  };
  const move = (e: React.PointerEvent) => {
    if (!grab.current) return;
    const raw = grab.current.start + (e.clientX - grab.current.startX);
    const outward = sign * raw;
    x.set(outward < 0 ? sign * rubberband(outward, width) : raw);
    hist.current = [...hist.current.slice(-5), { x: x.get(), t: performance.now() }];
  };
  const up = () => {
    if (!grab.current) return;
    grab.current = null;
    const h = hist.current,
      a = h[0],
      b = h[h.length - 1];
    const v = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    settle(sign * (x.get() + project(v)) > width / 2 ? sign * (width + 24) : 0, v);
  };

  return (
    <>
      <motion.div aria-hidden="true" style={{ opacity: scrim }} onClick={close} className="fixed inset-0 z-40 bg-[rgb(15_13_12/0.4)]" />
      <motion.aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ x, opacity, width }}
        className="fixed inset-y-3 end-3 z-40 flex max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-[26px] bg-surface shadow-[0_40px_90px_-30px_rgb(15_13_12/0.6)]"
      >
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="cursor-grab touch-none select-none active:cursor-grabbing"
        >
          {header ? (
            header(close)
          ) : (
            <div className="flex items-start gap-3 px-6 pb-4 pt-6">
              <div className="min-w-0 flex-1">
                <h2 className="title text-ink">{title}</h2>
                {sub && <p className="mt-1 text-[0.875rem] text-muted">{sub}</p>}
              </div>
              <CloseButton ref={closeRef} onClick={close} label={t.close} />
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </motion.aside>
    </>
  );
}

export function CloseButton({
  onClick,
  label,
  dark = false,
  ref,
}: {
  onClick: () => void;
  label: string;
  dark?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={label}
      className={`grid size-9 shrink-0 place-items-center rounded-full ${dark ? "bg-night-tile text-night-ink hover:opacity-80" : "bg-surface-2 text-ink hover:bg-border"}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}
