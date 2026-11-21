"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui";
import { EASE_OUT, rise } from "@/lib/motion";
import { isRtl, NATIVE } from "@/lib/languages";
import { DemoWorker, getJSON, loadWithWake, postJSON } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; hrCase?: number | null; error?: boolean };

const SUGGESTIONS: Record<string, string[]> = {
  Malayalam: ["എന്റെ ശമ്പളത്തിൽ എന്തിനാണ് കുറവ്?", "ഇന്ന് രാത്രി എന്റെ ഡ്യൂട്ടി എവിടെയാണ്?", "എന്റെ വിസ എപ്പോൾ തീരും?"],
  Urdu: ["میری ڈیوٹی آج رات کہاں ہے؟", "میرا ویزا کب ختم ہو رہا ہے؟", "میری کتنی چھٹیاں باقی ہیں؟"],
  Tagalog: [
    "Anong oras ang bus ko mamaya at saan ako naka-duty?",
    "Magkano ang sahod ko noong Oktubre?",
    "Ilang araw pa ang natitira kong leave?",
  ],
  Nepali: ["मेरो बिदा कति दिन बाँकी छ?", "आज राति मेरो ड्युटी कहाँ छ?", "मेरो भिसा कहिले सकिन्छ?"],
  Bengali: ["আজ রাতে আমার ডিউটি কোথায়?", "আমার বেতন কবে আসবে?", "আমার ছুটি কত দিন বাকি?"],
  Hindi: ["मेरी तनख्वाह में ओवरटाइम कितना है?", "आज रात मेरी ड्यूटी कहाँ है?", "मेरा वीज़ा कब खत्म होगा?"],
  Arabic: ["متى موعد الراتب القادم؟", "أين مناوبتي الليلة؟", "كم يوم إجازة متبقي لي؟"],
  English: ["When is my next pay day?", "Where is my shift tonight?", "My supervisor shouted at me, I want to complain."],
};
export default function Assistant() {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const [workers, setWorkers] = useState<DemoWorker[]>([]);
  const [worker, setWorker] = useState<DemoWorker | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadWithWake(
      () => getJSON<DemoWorker[]>("/transguard/assistant/workers"),
      () => {},
    )
      .then((w) => {
        setWorkers(w);
        setWorker(w[0] ?? null);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [msgs, busy, reduce]);

  const choose = (w: DemoWorker) => {
    setWorker(w);
    setMsgs([]);
  };
  const send = async (text: string) => {
    if (!worker || !text.trim() || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    try {
      const r = await postJSON<{ reply: string; tools: string[]; hr_case: number | null }>("/transguard/assistant", {
        worker_id: worker.id,
        messages: history.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
      });
      setMsgs([...history, { role: "assistant", content: r.reply, tools: r.tools, hrCase: r.hr_case }]);
    } catch (e) {
      setMsgs([...history, { role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  // a bubble grows from its own corner; under reduced motion it only fades
  const bubble = (mine: boolean) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 10, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.42, ease: EASE_OUT },
          style: { transformOrigin: mine ? "100% 100%" : "0% 100%" },
        };
  const scriptFont = (language: string) => (isRtl(language) ? "font-[family-name:var(--font-arabic)]" : "");

  return (
    <div className="flex flex-wrap items-start gap-8">
      <section className="flex min-w-0 flex-[999_1_460px] flex-col gap-[26px]">
        <div>
          <p className="text-[13px] font-bold text-gold-ink">{t.assistantKicker}</p>
          <h1 className="mt-1 max-w-[20ch] text-[clamp(1.75rem,1.4rem+1vw,2.125rem)] font-bold leading-[1.1] tracking-[-0.028em] text-ink rtl:tracking-normal">
            {t.assistantHeadline}
          </h1>
        </div>

        <div>
          <h2 className="mb-2.5 text-[13px] font-bold text-muted">{t.chooseGuard}</h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {workers.length === 0 && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-[98px] rounded-2xl" />)}
            {workers.map((w) => {
              const on = worker?.id === w.id;
              return (
                <button
                  key={w.id}
                  data-tour={`guard-${w.language}`}
                  onClick={() => choose(w)}
                  aria-pressed={on}
                  className={`press-soft flex min-w-0 flex-col gap-0.5 rounded-2xl p-3.5 text-start transition-[background-color,box-shadow,color] duration-300 ${
                    on
                      ? "bg-accent-soft text-ink shadow-[0_0_0_1.5px_var(--gold),0_14px_28px_-20px_rgb(120_95_40/0.5)]"
                      : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-surface-2/50"
                  }`}
                >
                  <span
                    className={`text-[23px] font-semibold leading-[1.35] transition-colors duration-300 ${on ? "text-gold-ink" : ""} ${scriptFont(w.language)}`}
                  >
                    {NATIVE[w.language] ?? w.language}
                  </span>
                  <span className="truncate text-[13.5px] font-bold">{w.name}</span>
                  <span className="text-[12px] text-muted">
                    {w.language} · {w.nationality}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {worker && (
          <div>
            <h2 className="mb-2.5 text-[13px] font-bold text-muted">{t.tryAskingIn(worker.language)}</h2>
            <ul className="flex flex-col gap-2">
              {(SUGGESTIONS[worker.language] ?? SUGGESTIONS.English).map((s, i) => (
                <li key={s}>
                  <button
                    data-tour={i === 0 ? "first-question" : undefined}
                    onClick={() => send(s)}
                    disabled={busy}
                    dir="auto"
                    className={`press-soft flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-surface px-[18px] py-2.5 text-start text-[16.5px] text-ink shadow-[var(--shadow-card)] hover:bg-surface-2/50 disabled:opacity-50 ${scriptFont(worker.language)}`}
                  >
                    <span>{s}</span>
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-surface-2" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        className="size-3.5 rtl:-scale-x-100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-2.5 sm:grid-cols-3">
          {[
            [t.infoLookup, t.infoLookupBody],
            [t.infoKind, t.infoKindBody],
            [t.infoHr, t.infoHrBody],
          ].map(([h, b]) => (
            <div key={h} className="rounded-2xl bg-surface-2 p-3.5">
              <div className="text-[14px] font-bold text-ink">{h}</div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The phone, on a dark stage: what the guard sees. The phone itself is a device, so it keeps its own light colours. */}
      <motion.div
        {...rise(reduce, 0, 18, 0.62)}
        className="night mx-auto w-full max-w-[430px] flex-[1_1_380px] rounded-[28px] px-[22px] pb-[18px] pt-[26px] xl:sticky xl:top-8"
      >
        <div className="rounded-[46px] bg-[#0b0a09] p-2.5 shadow-[0_0_0_1px_rgb(255_255_255/0.1)]">
          <div className="flex h-[min(690px,74vh)] flex-col overflow-hidden rounded-[37px] bg-[#f4f3f0] text-[#1d1a19]">
            <div className="flex items-center gap-[11px] border-b border-[#ebe8e3] bg-white px-[18px] pb-3.5 pt-6">
              <Image src="/transguard-logo.png" alt="" width={34} height={34} />
              <div className="min-w-0 leading-tight">
                <div className="text-[15px] font-bold">{t.assistantName}</div>
                <div className="text-[12px] font-semibold text-[#2e7d32]">{busy ? t.typing : t.fromOwnRecords}</div>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 py-[18px]">
              {msgs.length === 0 && (
                <p className="mx-auto mt-14 max-w-[240px] text-center text-[13px] leading-normal text-[#6b6563]">{t.phoneEmpty}</p>
              )}
              <AnimatePresence initial={false}>
                {msgs.map((m, i) => {
                  const mine = m.role === "user";
                  const sources = (m.tools ?? []).filter((x) => t.source[x]);
                  return (
                    <motion.div key={i} {...bubble(mine)} className={`flex flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
                      <div
                        dir="auto"
                        className={`max-w-[84%] whitespace-pre-wrap px-3.5 py-2.5 text-[15.5px] leading-relaxed ${scriptFont(worker?.language ?? "")} ${
                          mine
                            ? "rounded-[20px] rounded-ee-md bg-[#151311] text-white"
                            : m.error
                              ? "rounded-[20px] rounded-es-md bg-[#fde8e8] text-[#8a1c1c]"
                              : "rounded-[20px] rounded-es-md bg-white shadow-[0_1px_2px_rgb(29_26_25/0.08)]"
                        }`}
                      >
                        {m.content}
                      </div>
                      {/* where the answer came from lands just after the answer */}
                      {(sources.length > 0 || m.hrCase) && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, delay: reduce ? 0 : 0.26 }}
                          className="ms-1 flex flex-wrap gap-1.5"
                        >
                          {sources.map((x) => (
                            <Badge key={x}>{t.source[x]}</Badge>
                          ))}
                          {m.hrCase && <Badge hr>{t.hrOpened(`HR-${String(m.hrCase).padStart(5, "0")}`)}</Badge>}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {busy && (
                <motion.div {...bubble(false)} className="flex justify-start" aria-label={t.typing}>
                  <div className="flex gap-1 rounded-[20px] rounded-es-md bg-white px-4 py-3 shadow-[0_1px_2px_rgb(29_26_25/0.08)]">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="size-2 animate-bounce rounded-full bg-[#a39d98]"
                        style={{ animationDelay: `${d * 120}ms` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-[#ebe8e3] bg-white px-3 pb-[18px] pt-3"
            >
              <label htmlFor="phone-input" className="sr-only">
                {t.typeMessage}
              </label>
              <input
                id="phone-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                dir="auto"
                placeholder={t.typeMessage}
                disabled={busy || !worker}
                className="h-[42px] min-w-0 flex-1 rounded-full bg-[#f0eeea] px-4 text-[15px] text-[#1d1a19] outline-none placeholder:text-[#8f8882]"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={t.send}
                className="grid size-[42px] place-items-center rounded-full bg-[#151311] text-white disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" className="size-[18px] rtl:-scale-x-100" fill="currentColor" aria-hidden="true">
                  <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
        {worker && <p className="mt-3.5 text-center text-[13px] font-semibold text-night-muted">{t.phoneOf(worker.name)}</p>}
      </motion.div>
    </div>
  );
}

function Badge({ hr = false, children }: { hr?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-[3px] pe-[9px] ps-[7px] text-[11.5px] font-semibold ${
        hr ? "bg-[#d71920]/10 text-[#c4161c]" : "bg-[#2e7d32]/10 text-[#2e7d32]"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.5l4.5 4.5L19 7" />
      </svg>
      {children}
    </span>
  );
}
