"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getJSON } from "@/lib/api";
import { useLang } from "@/lib/i18n";

/** Pages fire this after anything that changes the counts (an assignment, a dispatch, a reset). */
export const refreshCounts = () => window.dispatchEvent(new Event("tg-refresh"));

/** Count badges: posts that need action tonight, and tickets not yet dispatched. */
function useCounts(path: string) {
  const [counts, setCounts] = useState<{ tonight: number; tickets: number } | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      Promise.all([getJSON<unknown[]>("/transguard/gaps"), getJSON<{ status: string }[]>("/transguard/tickets")])
        .then(([g, t]) => live && setCounts({ tonight: g.length, tickets: t.filter((x) => x.status !== "dispatched").length }))
        .catch(() => {});
    load();
    window.addEventListener("tg-refresh", load);
    return () => {
      live = false;
      window.removeEventListener("tg-refresh", load);
    };
  }, [path]);
  return counts;
}

type Theme = "light" | "dark";

const ICONS: Record<string, React.ReactNode> = {
  tonight: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  whatif: <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />,
  assistant: <path d="M5 5h14v10H9l-4 4zM9 9h6M9 12h4" />,
  tickets: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
};

function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("tg-theme");
    } catch {}
    const initial: Theme =
      saved === "light" || saved === "dark" ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (saved) document.documentElement.dataset.theme = saved;
    setTheme(initial);
  }, []);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tg-theme", next);
    } catch {}
    setTheme(next);
  };
  return { theme, toggle };
}

export default function Sidebar() {
  const { t, lang, setLang } = useLang();
  const path = usePathname();
  const { theme, toggle } = useTheme();
  const reduce = useReducedMotion();
  const counts = useCounts(path);
  const nav = [
    { href: "/", key: "tonight", label: t.navTonight, short: t.tabTonight, ready: true, badge: counts?.tonight, crit: true },
    { href: "/what-if", key: "whatif", label: t.navWhatIf, short: t.tabContract, ready: true },
    { href: "/assistant", key: "assistant", label: t.navAssistant, short: t.tabAssistant, ready: true },
    { href: "/tickets", key: "tickets", label: t.navTickets, short: t.tabTickets, ready: true, badge: counts?.tickets },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const controls = (
    <div className="flex items-center gap-2">
      <div role="group" aria-label="Language" className="flex flex-1 rounded-[11px] bg-surface-2 p-[3px]">
        {(["en", "ar"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`h-[30px] flex-1 rounded-lg px-2.5 text-[12.5px] font-semibold transition-colors ${
              lang === l
                ? "bg-sidebar-active text-sidebar-fg shadow-[0_1px_2px_rgb(0_0_0/0.1)]"
                : "text-sidebar-muted hover:text-sidebar-fg"
            }`}
          >
            {l === "en" ? "English" : "العربية"}
          </button>
        ))}
      </div>
      <button
        onClick={toggle}
        aria-label={t.theme}
        title={t.theme}
        className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-surface-2 text-sidebar-fg hover:bg-border"
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          {theme === "dark" ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          )}
        </svg>
      </button>
    </div>
  );

  return (
    <aside className="z-30 border-b border-hairline bg-sidebar text-sidebar-fg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-e">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4 lg:px-5 lg:pb-7 lg:pt-6">
        <Image src="/transguard-logo.png" alt="" width={42} height={42} priority />
        <div className="min-w-0 leading-tight">
          <div className="whitespace-nowrap text-[15px] font-bold">Transguard Group</div>
          <div className="hidden text-[12.5px] text-sidebar-muted sm:block">{t.product}</div>
        </div>
        <div className="ms-auto lg:hidden">{controls}</div>
      </div>

      <nav
        aria-label="Screens"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-hairline bg-sidebar/95 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:static lg:flex lg:flex-col lg:gap-0.5 lg:border-t-0 lg:bg-transparent lg:px-3 lg:pb-0 lg:pt-0 lg:backdrop-blur-none"
      >
        {nav.map((n) => {
          const on = active(n.href);
          const cls = `press-soft relative flex min-w-0 flex-col items-center gap-1 rounded-[11px] px-1 py-1.5 text-[11px] transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-[14.5px] ${
            on
              ? "font-semibold text-sidebar-fg"
              : n.ready
                ? "text-sidebar-muted hover:bg-surface-2/70 hover:text-sidebar-fg"
                : "cursor-not-allowed text-sidebar-muted/50"
          }`;
          const body = (
            <>
              {on && (
                // one highlight that slides between items instead of jumping
                <motion.span
                  layoutId="nav-active"
                  transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.4 }}
                  className="absolute inset-0 rounded-[11px] bg-sidebar-active shadow-[0_1px_3px_rgb(29_26_25/0.08),0_0_0_1px_var(--border)]"
                  aria-hidden="true"
                />
              )}
              <svg
                viewBox="0 0 24 24"
                className="relative size-[18px] shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {ICONS[n.key]}
              </svg>
              <span className="relative hidden lg:inline">{n.label}</span>
              <span className="relative max-w-full truncate lg:hidden">{n.short}</span>
              {!!n.badge && (
                <span
                  className={`absolute start-[calc(50%+4px)] top-0.5 grid h-[18px] min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold lg:relative lg:start-auto lg:top-auto lg:ms-auto lg:h-5 lg:min-w-[22px] lg:text-[11.5px] ${
                    n.crit ? "bg-primary text-primary-fg" : "bg-surface-2 text-ink"
                  }`}
                >
                  {n.badge}
                </span>
              )}
            </>
          );
          return n.ready ? (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cls}>
              {body}
            </Link>
          ) : (
            <span key={n.href} title={t.comingSoon} className={cls}>
              {body}
            </span>
          );
        })}
      </nav>

      <div className="mt-auto hidden space-y-3.5 px-4 pb-6 lg:block">
        {controls}
        <p className="px-1 text-[11.5px] leading-snug text-sidebar-muted">
          {t.simulatedNote} {t.preparedBy}
        </p>
      </div>
    </aside>
  );
}
