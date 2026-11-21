/**
 * One motion language for the whole app.
 * Springs for anything a person can touch (interruptible, start from the live value);
 * one ease-out curve for entrances. Bounce only after a flick.
 */

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;
export const SPRING_SNAP = { type: "spring", bounce: 0, duration: 0.3 } as const;
export const SPRING_SLOW = { type: "spring", bounce: 0, duration: 0.9 } as const;

/** Delays for a group that read as a wave, not a metronome: each gap is shorter than the last. */
export function stagger(i: number, first = 0.08, decay = 0.8, cap = 6): number {
  let d = 0;
  for (let k = 0; k < Math.min(i, cap); k++) d += first * decay ** k;
  return d;
}

/** Entrance: fade and rise. Under reduced motion, a short fade with no movement or delay. */
export function rise(reduce: boolean | null, delay = 0, y = 14, duration = 0.56) {
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration, ease: EASE_OUT, delay } };
}

/** Decoration: fade only. */
export function fade(reduce: boolean | null, delay = 0, duration = 0.5) {
  return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: reduce ? { duration: 0.2 } : { duration, ease: EASE_OUT, delay } };
}

/** The Tonight screen timeline (seconds), matched to the approved design. */
export const TONIGHT = {
  ring: 0.24,
  ringAfter: 0.62,
  lights: 0.28,
  haloCrit: 0.7,
  haloWarn: 0.93,
  side: [0.09, 0.16, 0.24],
};
