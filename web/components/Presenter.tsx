"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SPRING, SPRING_SNAP } from "@/lib/motion";

/**
 * Presenter mode: the meeting walkthrough from the README as a small overlay (press P, or open with ?present=1).
 * Arrow keys move between steps, open the step's screen and ring what to click. Always English and left-to-right.
 */

const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const pressed = (sel: string) => q(sel)?.getAttribute("aria-pressed") === "true" || q(sel)?.getAttribute("aria-current") === "true";

type Step = { screen: string; path: string; do: string; say: string; target: () => HTMLElement | null };

const STEPS: Step[] = [
  {
    screen: "Tonight",
    path: "/",
    do: "Open the app",
    say: "702 posts tonight. 4 are empty and 3 guards are likely not to show; coverage falls from 99.4% to 94.6% if nothing is done.",
    target: () => q('[data-tour="headline"]'),
  },
  {
    screen: "Tonight",
    path: "/",
    do: "Find cover on Abu Dhabi Downtown Government Building, then Approve and notify",
    say: "Ranked replacements with travel, overtime and reliability. Anju Varghese is assigned and gets the message in Malayalam, with the English beside it.",
    target: () => q('[data-tour="approve-best"]') ?? q('[data-tour="find-cover-S003"]'),
  },
  {
    screen: "Tonight",
    path: "/",
    do: "Fill all gaps, then Approve all and notify",
    say: "The optimiser solves every gap at once, in milliseconds, with no overtime. Every guard is told in their own language.",
    target: () => q('[data-tour="approve-all"]') ?? q('[data-tour="fill-all"]'),
  },
  {
    screen: "New contract",
    path: "/what-if",
    do: "40 guards, Dubai Marina, Check staffing",
    say: "28 from our own free guards, 12 to hire, 2 short on female guards, and where the crew comes from.",
    target: () => q('[data-tour="check-staffing"]'),
  },
  {
    screen: "Worker assistant",
    path: "/assistant",
    do: "Pick Asif Khan (Urdu), tap the first question",
    say: "He asks in Urdu and gets his shift back in Urdu, from his roster. Payslip, leave and visa work the same way.",
    target: () => (pressed('[data-tour="guard-Urdu"]') ? q('[data-tour="first-question"]') : q('[data-tour="guard-Urdu"]')),
  },
  {
    screen: "FM tickets",
    path: "/tickets",
    do: "Deira Hospital lift, Triage with AI, Dispatch technician",
    say: "P1, respond within an hour, likely parts, checklist, and the nearest lift technician assigned.",
    target: () =>
      pressed('[data-tour="ticket-lift"]') ? (q('[data-tour="dispatch"]') ?? q('[data-tour="triage"]')) : q('[data-tour="ticket-lift"]'),
  },
  { screen: "Tonight", path: "/", do: "Reset demo", say: "Ready for the next run.", target: () => q('[data-tour="reset"]') },
];

function read(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

type Box = { x: number; y: number; w: number; h: number };

export default function Presenter() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const path = usePathname();
  const [on, setOn] = useState(false);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  // restore, or turn on with ?present=1
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("present");
    setOn(fromUrl === "1" || (fromUrl !== "0" && read("tg-present") === "1"));
    const saved = Number(read("tg-step"));
    if (saved >= 0 && saved < STEPS.length) setStep(saved);
  }, []);
  useEffect(() => write("tg-present", on ? "1" : "0"), [on]);
  useEffect(() => write("tg-step", String(step)), [step]);

  const go = useCallback(
    (next: number) => {
      const n = Math.max(0, Math.min(STEPS.length - 1, next));
      setStep(n);
      if (STEPS[n].path !== window.location.pathname) router.push(STEPS[n].path);
    },
    [router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      const typing = el instanceof Element && el.closest("input, textarea, select, [contenteditable=true]");
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") setOn((v) => !v);
      else if (!on) return;
      else if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
      else if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) setOn(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, step, go]);

  // keep the ring on the element to click, following layout and scroll
  useEffect(() => {
    if (!on) return setBox(null);
    let frame = 0;
    let last = "";
    let scrolledFor = "";
    const tick = () => {
      const el = STEPS[step].target();
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 ? { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 } : null;
      const key = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.w)},${Math.round(next.h)}` : "";
      if (key !== last) {
        last = key;
        setBox(next);
      }
      const id = `${step}:${el?.dataset.tour ?? ""}`;
      if (el && scrolledFor !== id) {
        scrolledFor = id;
        if (r && (r.top < 0 || r.bottom > window.innerHeight)) el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on, step, path, reduce]);

  const s = STEPS[step];
  return (
    <>
      <AnimatePresence>
        {on && box && (
          <motion.div
            key="ring"
            aria-hidden="true"
            className="tour-ring pointer-events-none fixed left-0 top-0 z-[60] rounded-xl"
            initial={{ opacity: 0, x: box.x, y: box.y, width: box.w, height: box.h }}
            animate={{ opacity: 1, x: box.x, y: box.y, width: box.w, height: box.h }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0.15 } : SPRING}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {on && (
          <motion.aside
            key="presenter"
            dir="ltr"
            lang="en"
            aria-label="Presenter notes"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98, filter: "blur(6px)" }}
            transition={SPRING}
            className="presenter-card fixed bottom-4 left-4 z-[70] w-[min(380px,calc(100vw-2rem))] rounded-2xl p-4 text-[#f2efed]"
            style={{ fontFamily: "var(--font-open-sans), system-ui, sans-serif" }}
          >
            <div className="flex items-center justify-between gap-3 text-[12px] text-[#a39d98]">
              <span>
                Step {step + 1} of {STEPS.length}, {s.screen}
              </span>
              <span>P hides, ← → move</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-[#d71920]" : "bg-white/15"}`}
                />
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                transition={SPRING_SNAP}
              >
                <p className="mt-3 text-[14px] font-bold leading-snug text-white">{s.do}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#e4dfdb]">“{s.say}”</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={() => go(step - 1)}
                disabled={step === 0}
                className="h-8 rounded-lg bg-white/10 px-3 text-[13px] font-semibold disabled:opacity-35"
              >
                Back
              </button>
              <button onClick={() => setOn(false)} className="h-8 rounded-lg px-2 text-[13px] text-[#a39d98] hover:text-white">
                Hide
              </button>
              <button
                onClick={() => go(step + 1)}
                disabled={step === STEPS.length - 1}
                className="h-8 rounded-lg bg-[#d71920] px-3 text-[13px] font-semibold text-white disabled:opacity-35"
              >
                Next
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
