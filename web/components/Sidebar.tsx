"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

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
    const initial: Theme = saved === "light" || saved === "dark" ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
  const nav = [
    { href: "/", key: "tonight", label: t.navTonight, ready: true },
    { href: "/what-if", key: "whatif", label: t.navWhatIf, ready: true },
    { href: "/assistant", key: "assistant", label: t.navAssistant, ready: true },
    { href: "/tickets", key: "tickets", label: t.navTickets, ready: true },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const controls = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
        className="h-9 rounded-lg bg-white/8 px-3 text-[13px] font-semibold text-sidebar-fg ring-1 ring-white/12 hover:bg-white/14"
      >
        {lang === "en" ? "العربية" : "English"}
      </button>
      <button
        onClick={toggle}
        aria-label={t.theme}
        title={t.theme}
        className="grid size-9 place-items-center rounded-lg bg-white/8 text-sidebar-fg ring-1 ring-white/12 hover:bg-white/14"
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
    <aside className="z-30 bg-sidebar text-sidebar-fg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex items-center gap-3 px-4 pb-3 pt-4 lg:px-5 lg:pb-7 lg:pt-6">
        <Image src="/transguard-logo.png" alt="" width={40} height={40} priority />
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-bold">Transguard Group</div>
          <div className="text-[12.5px] text-sidebar-muted">{t.product}</div>
        </div>
        <div className="ms-auto lg:hidden">{controls}</div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
        {nav.map((n) => {
          const on = active(n.href);
          const cls = `press-soft relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] transition-colors ${
            on ? "bg-white/10 font-semibold text-white" : n.ready ? "text-sidebar-fg/80 hover:bg-white/6 hover:text-white" : "cursor-not-allowed text-sidebar-fg/35"
          }`;
          const body = (
            <>
              {on && <span className="absolute inset-y-2 start-0 hidden w-[3px] rounded-full bg-primary lg:block" aria-hidden="true" />}
              <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                {ICONS[n.key]}
              </svg>
              {n.label}
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

      <div className="mt-auto hidden space-y-4 px-5 pb-6 lg:block">
        <div className="rounded-lg bg-white/6 p-3 text-[12.5px] leading-snug text-sidebar-muted">
          <div className="font-semibold text-sidebar-fg">{t.shiftNote}</div>
          <div className="mt-1">{t.simulatedNote}</div>
        </div>
        {controls}
        <div className="text-[11.5px] text-sidebar-muted">{t.preparedBy}</div>
      </div>
    </aside>
  );
}
