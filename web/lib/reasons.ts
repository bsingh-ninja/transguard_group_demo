import type { Reason } from "@/lib/api";
import type { Dict } from "@/lib/i18n";

const pct = (v: number) => Math.round(v * 100);
const whole = (v: number) => Math.round(v);

/** The reason as a full sentence, with the typical guard's figure for comparison. */
export function reasonText(t: Dict, r: Reason): { text: string; typical: string } {
  switch (r.key) {
    case "absence":
      return { text: t.reasonAbsence(pct(r.value)), typical: t.typical(`${pct(r.typical)}%`) };
    case "nights":
      return { text: t.reasonNights(whole(r.value)), typical: t.typical(String(whole(r.typical))) };
    case "overtime":
      return { text: t.reasonOvertime(whole(r.value)), typical: t.typical(`${whole(r.typical)} h`) };
    case "commute":
      return { text: t.reasonCommute(whole(r.value)), typical: t.typical(`${whole(r.typical)} km`) };
  }
}

/** The two biggest reasons as one short line for a list row: "Missed 24% of shifts · 6 nights in a row". */
export function reasonLine(t: Dict, reasons: Reason[] = []): string {
  const short = (r: Reason) =>
    r.key === "absence"
      ? t.reasonAbsenceShort(pct(r.value))
      : r.key === "nights"
        ? t.reasonNights(whole(r.value))
        : r.key === "overtime"
          ? t.reasonOvertimeShort(whole(r.value))
          : t.reasonCommuteShort(whole(r.value));
  return reasons.slice(0, 2).map(short).join(" · ");
}
