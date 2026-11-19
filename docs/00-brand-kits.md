# Brand Kits

Every demo looks like the client's own product, not a NinjaTech product. All values below were pulled from each company's **live website code and logo files** on 2026-11-18: CSS hex counts, `theme-color` meta tags, `font-family` declarations, and pixels sampled from the logos.

> Ask each client for their official brand guidelines once a meeting is confirmed. The hex values below are what the websites actually render, which can differ slightly from the official guidelines.

## Rules for using client branding

1. **Co-brand, don't impersonate.** The header shows the client logo, with "Prepared for <Client> by NinjaTech" in the footer or login screen. Never publish the demo on a public URL.
2. **Logos come from `assets/logos/`**, used as-is: no recolouring or redrawing.
3. **Free fonts only.** If a client's font is commercial or proprietary, use the closest free substitute listed below. Never embed a font we don't hold a licence for.
4. **Bilingual.** All three are UAE companies. Every demo gets an EN/AR toggle with an RTL layout, with Arabic set in **IBM Plex Sans Arabic** (free, pairs well with all three brand fonts).
5. **Theme = CSS variables.** One shared UI library, with one token file per client (see `01-shared-foundation.md`).

---

## 1. Medad Holding

**Look and feel:** dark, premium, deep-tech venture. Deep navy/teal backgrounds, mint highlights, an amber accent, very wide display type.

| Token | Hex | Where it comes from |
|---|---|---|
| `--bg` | `#0A1824` | `<meta name="theme-color">`, main page background |
| `--bg-deep` | `#002939` / `#012432` | gradient start, section backgrounds |
| `--surface` | `#1A2B3A` | cards |
| `--primary` (mint) | `#AEDEDE` | active buttons and borders (the most-used brand colour in its CSS) |
| `--primary-soft` | `#B8D6D3` | secondary mint |
| `--accent-teal` | `#4FD1C7` | declared as `--accent-teal` in its CSS |
| `--accent-amber` | `#FFB703` | highlights, KPI call-outs |
| `--info` | `#2D5A87` | charts, links |
| `--text` | `#FFFFFF` | |
| `--text-muted` | `#9CA3AF` | |

**Typography**
- Site uses **Sequel / Sequel Wide / Sequel Wide 95**: a commercial wide display face.
- Demo substitute: headings in **Archivo** at `font-stretch: 125%` (Google Fonts, variable width axis) or **Unbounded**. Body text in **Inter**.

**Logo:** `assets/logos/medad-logo-white.svg` (white, for dark backgrounds). Medad also has per-company logos under `/img/logo/sub/white/` (e.g. `medad-technology-logo.svg`). Fetch the ones for companies shown in Plan 1.

**Tone:** "From Idea to Impact", "Fueling Breakthrough Innovation". Ambitious and future-facing, with heavy use of deep-tech vocabulary (AI, Web3, biotech, IP).

---

## 2. Transguard Group

**Look and feel:** corporate, operational, high trust. Light backgrounds, strong red, charcoal text, gold from the Emirates Group Security crest.

| Token | Hex | Where it comes from |
|---|---|---|
| `--primary` (red) | `#D71920` | most-used site colour (`#E01F25` / `#DF2127` hover variants) |
| `--primary-logo` | `#DA021B` | sampled from the logo crest |
| `--gold` | `#A2844B` | sampled from the logo crest laurel |
| `--charcoal` | `#4C4C4D` | body text, headers |
| `--ink` | `#282423` | logo dark, strongest text |
| `--grey` | `#808080` | secondary text |
| `--surface` | `#F7F7F7` / `#F0F0F0` | panels |
| `--border` | `#E6E6E6` | |
| `--warning` | `#F6BC35` | minor accent on site; use for "amber" alerts |
| `--bg` | `#FFFFFF` | |

**Typography**
- Site uses **Open Sans** (400/600/700/800, Google Fonts). Use it directly.
- The site also loads an `emirates_sb` face: this is the Emirates Group's proprietary font. **Don't use it.**

**Logo:** `assets/logos/transguard-logo.png`. This is only 110 px (the Emirates Group Security crest with the "Transguard Group" banner). **Request a vector logo** before the meeting, or use the text wordmark in Open Sans 800 plus the crest at small size.

**Command-centre dark mode (Plan 5):** a control room wants a dark UI. Use the background `#1B1918` (a darkened `--ink`), surfaces `#282423`, red `#E01F25` for critical alerts only, gold `#A2844B` for selected/active states, and `#F6BC35` for warnings. Keeping red reserved for critical alerts preserves its meaning.

**Tone:** "UAE's most trusted business support and outsourcing provider". Factual and scale-driven ("97% of the country's cash volume", "6,000+ ATMs"), with compliance badges (ISO 27001, PCI-DSS, SIRA).

---

## 3. Al Hail Holding

**Look and feel:** institutional, calm, investment-grade. Navy and silver from the logo, sand/gold warmth, plenty of white space.

| Token | Hex | Where it comes from |
|---|---|---|
| `--primary` (logo navy) | `#062B49` | sampled from the logo square |
| `--primary-site` | `#1D2351` | most-used navy in site code |
| `--bg-dark` | `#09131F` | `<meta name="theme-color">` |
| `--surface-dark` | `#172638` | dark sections |
| `--silver` | `#9A9C9F` | sampled from the logo "h" mark |
| `--sand` | `#D8C39E` | warm accent |
| `--sky` | `#99BDDF` | light blue accent, charts |
| `--slate` | `#536B84` | secondary text on light |
| `--sector-2` | `#354775` | chart series |
| `--sector-3` | `#A5C5AD` | chart series (sage) |
| `--sector-4` | `#AFABD0` | chart series (lavender) |
| `--bg` | `#FFFFFF` | |

Note: `#E01F25` red also appears on alhail.com. It is most likely the Transguard red used on its sectors page. Don't use it as an Al Hail colour, except on the Transguard card.

**Typography**
- Site uses **Manrope** (variable). It's free on Google Fonts, so use it directly.
- Arabic: the logo uses a rounded Arabic wordmark. Use **IBM Plex Sans Arabic** for Arabic UI text.

**Logo:** `assets/logos/alhail-logo.png` (2846×1600, bilingual stacked: "الحيل القابضة" / "Al Hail Holding", navy square with a silver "h"). Crop it for the header, keeping the square mark alone at small sizes.

**Five sector colours for portfolio charts (Plan 3):** Financial Services & Tech `#062B49`, Critical Logistics `#536B84`, Energy `#D8C39E`, Real Estate `#99BDDF`, Infrastructure `#A5C5AD`.

**Tone:** "Powering Everyday Progress". Measured, long-term, governance-oriented.

---

## 4. Joint Medad + Transguard (Plan 4)

Use a **neutral NinjaTech platform shell** in which each tenant workspace switches to its own brand theme (Medad dark or Transguard light). The theme switch is the visual proof that it is "one platform, your brand". Never blend the two palettes on one screen.

---

## Ready-to-use token files

Drop these into `packages/ui/themes/` (see `01-shared-foundation.md`).

```css
/* themes/medad.css */
[data-theme="medad"] {
  --bg:#0A1824; --bg-deep:#002939; --surface:#1A2B3A; --border:#012432;
  --primary:#AEDEDE; --primary-fg:#0A1824; --accent:#4FD1C7; --highlight:#FFB703;
  --info:#2D5A87; --text:#FFFFFF; --text-muted:#9CA3AF;
  --ok:#4FD1C7; --warn:#FFB703; --crit:#FF5A5F;
  --font-display:"Archivo",sans-serif; --font-display-stretch:125%;
  --font-body:"Inter",sans-serif; --font-ar:"IBM Plex Sans Arabic",sans-serif;
}
/* themes/transguard.css (light, corporate) */
[data-theme="transguard"] {
  --bg:#FFFFFF; --surface:#F7F7F7; --border:#E6E6E6;
  --primary:#D71920; --primary-fg:#FFFFFF; --accent:#A2844B; --highlight:#F6BC35;
  --text:#282423; --text-muted:#4C4C4D;
  --ok:#2E7D32; --warn:#F6BC35; --crit:#D71920;
  --font-display:"Open Sans",sans-serif; --font-body:"Open Sans",sans-serif;
  --font-ar:"IBM Plex Sans Arabic",sans-serif;
}
/* themes/transguard-ops.css (dark command-centre) */
[data-theme="transguard-ops"] {
  --bg:#1B1918; --surface:#282423; --border:#3A3634;
  --primary:#A2844B; --primary-fg:#1B1918; --accent:#A2844B; --highlight:#F6BC35;
  --text:#F7F7F7; --text-muted:#B0ADAA;
  --ok:#43A047; --warn:#F6BC35; --crit:#E01F25;
  --font-display:"Open Sans",sans-serif; --font-body:"Open Sans",sans-serif;
  --font-ar:"IBM Plex Sans Arabic",sans-serif;
}
/* themes/alhail.css */
[data-theme="alhail"] {
  --bg:#FFFFFF; --surface:#F5F7FA; --border:#E3E8EE;
  --primary:#062B49; --primary-fg:#FFFFFF; --accent:#D8C39E; --highlight:#99BDDF;
  --text:#09131F; --text-muted:#536B84; --silver:#9A9C9F;
  --ok:#A5C5AD; --warn:#D8C39E; --crit:#B3261E;
  --font-display:"Manrope",sans-serif; --font-body:"Manrope",sans-serif;
  --font-ar:"IBM Plex Sans Arabic",sans-serif;
}
```
