"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";

export function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-10 w-2/3 animate-pulse rounded bg-surface-2" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[520px] animate-pulse rounded-xl bg-surface-2" />
        <div className="h-[520px] animate-pulse rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  const { t } = useLang();
  return <div className="rounded-lg border border-crit/30 bg-crit/5 p-4 text-sm text-crit">{t.apiError(message)}</div>;
}

/** A number that springs from what is on screen to its new value (interruptible: re-targets from the live value). */
export function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const live = useRef(value);
  useEffect(() => {
    if (reduce) {
      live.current = value;
      setShown(value);
      return;
    }
    const c = animate(live.current, value, {
      type: "spring",
      bounce: 0,
      duration: 0.7,
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

export function Figure({ label, value, decimals = 0, suffix = "", unit, tone }: {
  label: string; value: number; decimals?: number; suffix?: string; unit?: string; tone?: "crit" | "warn";
}) {
  const color = tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="mt-2">
        <span className={`figure text-[2rem] transition-colors duration-500 ${color}`} dir="ltr">
          <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
        </span>
        {unit && <span className="ms-1.5 text-[0.8125rem] text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

// Apple's momentum projection and rubber-band (Designing Fluid Interfaces)
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);
const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

/**
 * Side sheet that enters and leaves from the trailing edge. Drag or flick the header to dismiss:
 * 1:1 tracking, velocity from pointer history, momentum projection decides close vs stay,
 * spring inherits the release velocity, rubber-band past the open edge, interruptible.
 */
export function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  const { t, lang } = useLang();
  const reduce = useReducedMotion();
  const sign = lang === "ar" ? -1 : 1;
  const [width, setWidth] = useState(520);
  const x = useMotionValue(sign * 560);
  const opacity = useMotionValue(reduce ? 0 : 1);
  const grab = useRef<{ startX: number; start: number } | null>(null);
  const hist = useRef<{ x: number; t: number }[]>([]);
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

  useEffect(() => {
    const w = Math.min(520, window.innerWidth);
    setWidth(w);
    const back = document.activeElement as HTMLElement | null;
    if (reduce) {
      x.set(0);
      animate(opacity, 1, { duration: 0.2 });
    } else {
      x.set(sign * w);
      animate(x, 0, { type: "spring", bounce: 0, duration: 0.36 });
    }
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && settle(sign * w);
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
    const h = hist.current, a = h[0], b = h[h.length - 1];
    const v = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    settle(sign * (x.get() + project(v)) > width / 2 ? sign * width : 0, v);
  };

  return (
    <motion.aside
      role="dialog"
      aria-label={title}
      style={{ x, opacity, width }}
      className="sheet-material fixed inset-y-0 end-0 z-40 flex max-w-full flex-col border-s border-border"
    >
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="flex cursor-grab touch-none select-none items-start gap-3 border-b border-hairline px-6 pb-4 pt-6 active:cursor-grabbing"
      >
        <span className="mt-1 h-10 w-1 shrink-0 rounded-full bg-border" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="title text-ink">{title}</h2>
          {sub && <p className="mt-1 text-[0.875rem] text-muted">{sub}</p>}
        </div>
        <button ref={closeRef} onClick={() => settle(sign * width)} aria-label={t.close} className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink hover:bg-border">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
    </motion.aside>
  );
}
