"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui";
import { DemoWorker, getJSON, loadWithWake, postJSON } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; hrCase?: number | null; error?: boolean };

const SUGGESTIONS: Record<string, string[]> = {
  Malayalam: ["എന്റെ ശമ്പളത്തിൽ എന്തിനാണ് കുറവ്?", "ഇന്ന് രാത്രി എന്റെ ഡ്യൂട്ടി എവിടെയാണ്?", "എന്റെ വിസ എപ്പോൾ തീരും?"],
  Urdu: ["میری ڈیوٹی آج رات کہاں ہے؟", "میرا ویزا کب ختم ہو رہا ہے؟", "میری کتنی چھٹیاں باقی ہیں؟"],
  Tagalog: ["Anong oras ang bus ko mamaya at saan ako naka-duty?", "Magkano ang sahod ko noong Oktubre?", "Ilang araw pa ang natitira kong leave?"],
  Nepali: ["मेरो बिदा कति दिन बाँकी छ?", "आज राति मेरो ड्युटी कहाँ छ?", "मेरो भिसा कहिले सकिन्छ?"],
  Bengali: ["আজ রাতে আমার ডিউটি কোথায়?", "আমার বেতন কবে আসবে?", "আমার ছুটি কত দিন বাকি?"],
  Hindi: ["मेरी तनख्वाह में ओवरटाइम कितना है?", "आज रात मेरी ड्यूटी कहाँ है?", "मेरा वीज़ा कब खत्म होगा?"],
  Arabic: ["متى موعد الراتب القادم؟", "أين مناوبتي الليلة؟", "كم يوم إجازة متبقي لي؟"],
  English: ["When is my next pay day?", "Where is my shift tonight?", "My supervisor shouted at me, I want to complain."],
};
const TOOL_LABEL: Record<string, string> = {
  get_my_shift: "Shift roster",
  get_my_payslip: "Payslip",
  get_my_leave: "Leave balance",
  get_my_documents: "Visa and documents",
  get_my_transport: "Bus schedule",
  escalate_to_hr: "HR case opened",
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
    loadWithWake(() => getJSON<DemoWorker[]>("/transguard/assistant/workers"), () => {})
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

  const lastTools = [...msgs].reverse().find((m) => m.tools)?.tools ?? [];
  const lastCase = [...msgs].reverse().find((m) => m.hrCase)?.hrCase;
  const bubbleIn = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : {};

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0 space-y-8">
        <div>
          <p className="label">{t.navAssistant}</p>
          <h1 className="display mt-2 max-w-[22ch] text-ink">{t.assistantTitle}</h1>
          <p className="mt-3 max-w-[60ch] text-[1.0625rem] leading-relaxed text-muted">{t.assistantIntro}</p>
        </div>

        <div>
          <h2 className="label mb-3">{t.chooseGuard}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {workers.length === 0 && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)}
            {workers.map((w) => (
              <button
                key={w.id}
                data-tour={`guard-${w.language}`}
                onClick={() => choose(w)}
                aria-pressed={worker?.id === w.id}
                className={`press-soft rounded-xl p-3 text-start transition-colors ${
                  worker?.id === w.id ? "bg-accent-soft ring-2 ring-accent" : "bg-surface ring-1 ring-border hover:ring-accent/50"
                }`}
              >
                <div className="truncate font-semibold text-ink">{w.name}</div>
                <div className="text-[0.8125rem] text-muted">
                  {w.language}, {w.nationality}
                </div>
              </button>
            ))}
          </div>
        </div>

        {worker && (
          <div>
            <h2 className="label mb-3">{t.tryAsking}</h2>
            <ul className="space-y-2">
              {(SUGGESTIONS[worker.language] ?? SUGGESTIONS.English).map((s, i) => (
                <li key={s}>
                  <button
                    data-tour={i === 0 ? "first-question" : undefined}
                    onClick={() => send(s)}
                    disabled={busy}
                    dir="auto"
                    className="press-soft w-full rounded-xl bg-surface px-4 py-3 text-start text-[1rem] text-ink ring-1 ring-border hover:ring-accent/60 disabled:opacity-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(lastTools.length > 0 || lastCase) && (
          <div className="rise">
            <h2 className="label mb-2">{t.assistantChecked}</h2>
            <div className="flex flex-wrap gap-2">
              {lastTools.map((x, i) => (
                <span key={x + i} className={`rounded-full px-3 py-1 text-[0.8125rem] font-semibold ${x === "escalate_to_hr" ? "bg-primary/10 text-primary" : "bg-surface-2 text-ink"}`}>
                  {TOOL_LABEL[x] ?? x}
                  {x === "escalate_to_hr" && lastCase ? ` HR-${String(lastCase).padStart(5, "0")}` : ""}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[0.8125rem] text-muted">{t.assistantSimulated}</p>
          </div>
        )}
      </section>

      {/* The phone: what the guard sees */}
      <div className="mx-auto w-full max-w-[400px] xl:sticky xl:top-8 xl:self-start">
        <div className="rounded-[46px] bg-[#1b1918] p-3 shadow-[0_30px_80px_-30px_rgb(31_28_27/0.6)]">
          <div className="flex h-[min(760px,78vh)] flex-col overflow-hidden rounded-[36px] bg-[#efe9e1]">
            <div className="flex items-center gap-3 bg-[#1f1c1b] px-4 pb-3 pt-6 text-white">
              <Image src="/transguard-logo.png" alt="" width={34} height={34} className="rounded-full bg-white/90 p-0.5" />
              <div className="min-w-0 leading-tight">
                <div className="text-[15px] font-bold">{t.assistantName}</div>
                <div className="text-[12px] text-white/60">{busy ? t.typing : t.online}</div>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {msgs.length === 0 && <p className="mx-auto mt-10 max-w-[260px] text-center text-[13px] text-[#6b6563]">{t.phoneEmpty}</p>}
              <AnimatePresence initial={false}>
                {msgs.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.94, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                    style={{ transformOrigin: m.role === "user" ? "100% 100%" : "0% 100%" }}
                    {...bubbleIn}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      dir="auto"
                      className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ${
                        m.role === "user" ? "rounded-ee-md bg-[#dcf8c6] text-[#1f2b1f]" : m.error ? "rounded-es-md bg-[#fde8e8] text-[#8a1c1c]" : "rounded-es-md bg-white text-[#282423]"
                      }`}
                    >
                      {m.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {busy && (
                <div className="flex justify-start" aria-label={t.typing}>
                  <div className="flex gap-1 rounded-2xl rounded-es-md bg-white px-4 py-3 shadow-sm">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="size-2 animate-bounce rounded-full bg-[#a39d98]" style={{ animationDelay: `${d * 120}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 bg-[#f6f2ec] px-3 py-3"
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
                className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-[#282423] outline-none placeholder:text-[#a39d98]"
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label={t.send} className="grid size-11 place-items-center rounded-full bg-primary text-white disabled:opacity-40">
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                  <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
        {worker && <p className="mt-3 text-center text-[0.8125rem] text-muted">{t.phoneOf(worker.name)}</p>}
      </div>
    </div>
  );
}
