# Transguard Workforce Intelligence (demo)

AI workforce operations demo prepared for Transguard Group by NinjaTech: tonight's guard coverage with likely no-shows and one-click cover, staffing a new contract, a multilingual worker assistant, and facilities ticket triage.

All sites, guards, rosters, payslips and tickets are simulated (fictional names); only area names and the brand are real.

## Run

```bash
./start.sh            # database (:5434), API (:8002), web app (:3002)
./start.sh --reseed   # reset tonight's roster, workforce and tickets first
```

Open http://localhost:3002 (Arabic: http://localhost:3002/?lang=ar). Requires Docker, Python 3.12 and pnpm. The **Reset demo** link on the Tonight screen restores the starting scenario.

### Gemini key

The worker assistant, ticket triage and worker message translation use Google Gemini. Put your key in `backend/.env` (ignored by git):

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash
```

## Screens

| Screen | What it does |
|---|---|
| Tonight | Coverage now and after likely no-shows, map of every post, needs-action list; Find cover (ranked guards) and Fill all gaps (OR-Tools plan); the guard is notified in their own language |
| New contract | Can we staff N guards in an area from free guards, how many to hire, shortfalls, where the crew comes from |
| Worker assistant | Phone-style chat: a guard asks about shift, pay, leave, visa or bus in their language; answers from their records, HR escalation |
| FM tickets | Fault reports (text and optional photo) triaged into trade, priority with response time, parts and checklist; nearest qualified technician; dispatch |

## How it works

- **No-show risk:** logistic regression trained on 200,000 simulated shifts (absence history, commute, consecutive nights, overtime, days since payday).
- **Backfill and new contract:** Google OR-Tools CP-SAT, with licence validity, 12-hour rest, a 60-hour weekly cap, travel and reliability.
- **Assistant and triage:** Gemini function calling and structured output; the assistant must look up the guard's records before answering and replies in the language of the message.

## Layout

```
backend/   FastAPI + Postgres (app/transguard: seed, workforce API, assistant and tickets)
web/       Next.js app (Transguard brand, EN/AR, light/dark)
docs/      plan, brand kit, logo
```
