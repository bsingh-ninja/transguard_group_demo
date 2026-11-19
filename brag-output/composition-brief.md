# Hyperframes Composition Brief: Transguard Workforce Intelligence

## Objective
A 23.5-second launch-style brag video for the Transguard Workforce Intelligence demo, for an owner meeting.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape, 1920x1080, 30 fps
- Duration: 23.5 s

## Source Material
- Project root: `/home/ninjatech/Demos/transguard_group_demo`
- Files read: README.md, web/lib/i18n.tsx (UI copy), web/app/globals.css (tokens), web/components/CoverSheets.tsx, the running app
- Real screens captured from the running app at 1920x1080 (simulated data, fictional names): `assets/shots/{tonight,plan,cleared,assistant,triage}.png`
- Copy used verbatim from the app: "4 posts open and 3 guards at risk tonight", "Fill all gaps", "7 gaps filled by the optimiser in 9 ms", "Approve all and notify", "Every post is covered tonight", "Workforce Intelligence"
- Grounded numbers: 702 required posts, 4 open posts, 3 likely no-shows (`/transguard/overview`), 7 gaps, 9 ms (plan sheet), P1 lift with Bishnu Rai assigned (triage)

## Creative Direction
- Tone preset: polished
- Creative direction: an operations-room film for a security company's owner
- Angle, hook, outro: see `brag-plan.md`
- Avoid: generic SaaS language, abstract filler, redesigning the product UI

## Visual Identity
- Ground #1f1c1b, ink #f2efed, muted #a39d98, red #d71920 (actions/critical), gold #a2844b (at-risk), app surface #f6f5f4
- Open Sans 800 display, 400/600 body (bundled)
- The app shown in a floating window with a deep shadow; captions in a charcoal pill

## Storyboard
1. Hook, 0-3.70 s: "702 posts tonight." / "4 are empty." (beat-locked 1.60) / "3 guards may not show."
2. Desk, 3.70-13.70 s: Tonight screen, push in, click Fill all gaps (7.5 s); plan sheet slides in at 7.91 s with the caption "7 gaps filled in 9 ms."; click Approve all (10.55 s); cleared screen at 11.06 s, "Every post is covered tonight"
3. Assistant, 13.70-16.86 s: Asif Khan's phone, Urdu; caption "Asked in Urdu. Answered in Urdu."
4. Tickets, 16.86-19.49 s: P1 lift triage; caption "Stuck lift: P1, technician assigned."
5. Outro, 19.49-23.5 s: crest, "Workforce Intelligence", simulated-data line, "Built by NinjaTech"

## Audio
- Music: `assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3`, volume 0.55, fade in 0.3 s, fade out 1.5 s
- Cue source: bundled preset (114.84 BPM). Strong-cue locks at 1.60 s and 3.70 s; scene cuts on beat-grid points 7.91, 11.06, 13.70, 16.86, 19.49; outro line at 21.07 s
- Audio-reactive: per-beat music RMS (extracted with media-use `extract-audio-data.py`) sets the opacity of the warm glow behind the app window. Subtle, no visualiser
- SFX (Kenney CC0, low HF risk): soft impacts on hook lines, ui click on the two presses, card slide for the sheet, bell on the payoff, soft bell under the outro line
