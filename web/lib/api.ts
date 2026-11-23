export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export async function postJSON<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${res.status} ${path}`);
  }
  return res.json();
}

/**
 * Load data, retrying while the hosted server wakes up (network errors and 502/503/504 for up to ~3 minutes).
 * `onWaking` fires once the first attempt has failed or taken longer than 2.5 s.
 */
export async function loadWithWake<T>(load: () => Promise<T>, onWaking: () => void): Promise<T> {
  const slow = setTimeout(onWaking, 2500);
  const deadline = Date.now() + 180_000;
  try {
    for (;;) {
      try {
        return await load();
      } catch (e) {
        const msg = (e as Error).message;
        const transient = e instanceof TypeError || /^(502|503|504) /.test(msg);
        if (!transient || Date.now() > deadline) throw e;
        onWaking();
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  } finally {
    clearTimeout(slow);
  }
}

export type AssignLine = AssignResult & { site_id: string; worker_id: string };

/** Approve a whole plan; `onLine` gets each guard's assignment and message as soon as it is ready. */
export async function assignAll(
  assignments: { site_id: string; worker_id: string; replaces_shift_id: number | null }[],
  onLine: (line: AssignLine | { site_id: string; worker_id: string; error: string }) => void,
): Promise<void> {
  const res = await fetch(`${API}/transguard/backfill/assign-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignments }),
  });
  if (!res.ok || !res.body) throw new Error(`${res.status} /transguard/backfill/assign-all`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) onLine(JSON.parse(l));
  }
  if (buffer.trim()) onLine(JSON.parse(buffer));
}

export type SiteStatus = "covered" | "at_risk" | "short";

export type Site = {
  id: string;
  name: string;
  type: string;
  area: string;
  emirate: string;
  lat: number;
  lon: number;
  night_required: number;
  assigned: number;
  vacancies: number;
  at_risk: number;
  status: SiteStatus;
};

export type Overview = {
  date: string;
  shift: string;
  totals: {
    sites: number;
    required: number;
    assigned: number;
    vacancies: number;
    at_risk: number;
    coverage_pct: number;
    expected_coverage_pct: number;
  };
  workforce: { total: number; active: number; licences_expiring: number };
  sites: Site[];
  accommodation: { name: string; lat: number; lon: number }[];
};

export type Gap = {
  key: string;
  kind: "vacancy" | "at_risk";
  site_id: string;
  site: string;
  area: string;
  shift_id?: number;
  worker?: string;
  worker_id?: string;
  noshow_risk?: number;
  reasons?: Reason[];
};

/** One reason behind a no-show prediction, read from the model. `weight` is its share of the shown push (0 to 1). */
export type Reason = { key: "absence" | "commute" | "nights" | "overtime"; value: number; typical: number; weight: number };

export type Assumptions = { penalty_aed: number; overtime_rate_aed: number; supervisor_minutes: number; supervisor_rate_aed: number };

export type Savings = {
  at_stake: { posts: number; aed: number };
  saved: { filled: number; posts_aed: number; overtime_aed: number; supervisor_minutes: number; supervisor_aed: number; total_aed: number };
  assumptions: Assumptions;
  defaults: Assumptions;
};

export type Candidate = {
  id: string;
  name: string;
  nationality: string;
  language: string;
  gender: string;
  role: string;
  skills: string[];
  accommodation: string;
  commute_km: number;
  weekly_hours: number;
  overtime_hours: number;
  overtime_cost_aed: number;
  reliability_pct: number;
  licence_expiry: string;
  why: string[];
  score: number;
};

export type Plan = {
  assignments: (Gap & { candidate: Candidate })[];
  status: string;
  total_commute_km: number;
  total_overtime_aed: number;
  solve_ms: number;
  estimated_saving_aed: number;
};

export type AssignResult = {
  assigned: { worker: string; site: string };
  message: { language: string; text_local: string; text_en: string; translated_by: string };
};

export type WhatIfResult = {
  emirate: string;
  available_pool: number;
  covered: number;
  hiring_gap: number;
  female: number;
  first_aid: number;
  female_shortfall: number;
  first_aid_shortfall: number;
  avg_commute_km: number | null;
  from_accommodation: { name: string; guards: number }[];
  crew_sample: { name: string; nationality: string; accommodation: string; commute_km: number }[];
  note: string;
};

export const AREAS = [
  "Dubai Marina",
  "JLT",
  "Downtown Dubai",
  "Business Bay",
  "DIFC",
  "Al Barsha",
  "Deira",
  "Al Qusais",
  "Dubai Silicon Oasis",
  "Jebel Ali",
  "Al Quoz",
  "Airport Freezone",
  "Abu Dhabi Downtown",
  "Al Reem Island",
  "Khalifa City",
  "Mussafah",
  "Yas Island",
  "Saadiyat Island",
];

export type DemoWorker = { id: string; name: string; language: string; nationality: string };
export type SiteOption = { id: string; name: string; area: string; type: string };

export type Triage = {
  trade: string;
  issue: string;
  priority: "P1" | "P2" | "P3" | "P4";
  priority_reason: string;
  safety_risk: boolean;
  likely_parts: string[];
  checklist: string[];
  photo_observations: string;
  sla_hours: number;
  due_by: string;
  site: string;
  technician?: { id: string; name: string; trade: string; area: string; distance_km: number; eta_min: number; jobs_today: number };
};

export type Ticket = {
  id: number;
  channel: string;
  description: string;
  photo: boolean;
  created: string;
  status: string;
  triage: Triage | null;
  site: string;
  area: string;
  technician: string | null;
};
