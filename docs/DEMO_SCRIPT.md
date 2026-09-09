# The 90-Second Demo

The demo is the product, as far as judges are concerned. Rehearse it until
it's muscle memory.

---

## Pre-flight (do this 30 minutes before, every time)

- [ ] Laptop **and** phone on **your own phone's hotspot** — never venue wifi
      (client isolation will silently break device→laptop calls)
- [ ] `make backend` running; leave the terminal open
- [ ] `make ip` → note your LAN IP
- [ ] On the phone, open `http://<LAN-IP>:8000/api/health` — **must** return JSON.
      If it doesn't, stop and fix this before anything else.
- [ ] Upload one test photo so rembg's model weights are cached (first run
      is slow otherwise)
- [ ] Have a **printed product photo** ready — a real handicraft on a messy
      background. Messy matters: the background removal has to be visible.
- [ ] Phone brightness to max, notifications off, screen timeout to 10 min
- [ ] Battery above 50% on both devices
- [ ] Know your fallbacks cold (bottom of this page)

---

## The script

### Open — 10 seconds

> "There are seven million artisans in India. Almost none of them sell online.
> Not because their craft isn't good enough — because selling online means
> product photography, English copywriting, and pricing. So a middleman takes
> 60% of what their work is worth.
>
> This is Karigar AI. Watch what one artisan can do in ninety seconds."

*Do not explain the tech stack. Nobody has ever awarded points for a tech stack.*

---

### Step 1 — Photo · 15 seconds

Hold up the messy printed photo. Photograph it in the app.

> "She takes one photo. In her workshop. Bad light, cluttered background —
> exactly what a real photo looks like."

*Before/after appears side by side.*

> "The AI cut out the background and studio-lit it. That's a catalog-quality
> product shot, from a phone camera, in a workshop."

**Pause here for two seconds.** Let them look at it. This is the first "oh".

---

### Step 2 — Voice · 20 seconds

Tap the mic. **Speak in Kannada or Hindi**, not English — the language is the
point.

> *"ಕೈಯಿಂದ ಮಾಡಿದ ಬಿದಿರು ಬುಟ್ಟಿ, ಮೂರು ದಿನ ಬೇಕು"*
> (Handmade bamboo basket, takes three days)

> "She never types. She never writes English. She just says what she made,
> in her own language."

---

### Step 3 — The listing · 20 seconds

> "And the AI wrote the whole listing. Title, description, material, category,
> production time, search tags — in **Kannada, Hindi and English** at once."

Toggle the language. **Let them see the same product in three scripts.** (The
grid offers **nine** languages — Tamil, Telugu, Bengali, Marathi, Gujarati and
Odia too — so say *"national, not just Karnataka."*)

> "One artisan just became sellable to the entire country."

**If you demo a Channapatna toy or a Mysore silk saree**, point at the green
**✓ Verified GI** badge:

> "That's not the AI guessing. We matched it against the real Geographical
> Indication registry — this is a *verified* GI craft. The Ministry of Textiles
> protects exactly these."

---

### Step 4 — Fair price · 15 seconds

> "Now the part that actually changes her income. Most artisans underprice —
> they don't know what the market pays."

> "The engine is grounded in three things: a **market median** across real
> comparable listings, a **skill premium**, and — the important one — a
> **fair-wage floor**. Three days of skilled work at a fair daily wage is
> ₹1,200, so the price *cannot* fall below that. The market pays a median of
> ₹720 for these baskets; our floor refuses to let her sell her own labour that
> cheap. She sees every line, so she can argue with it. This is the number a
> middleman was never going to tell her."

*(For a verified-GI craft, also point out the **+15% GI premium** line — "a
verified Channapatna toy is not priced like a generic wooden toy.")*

---

### Step 5 — Publish · 20 seconds

Tap **Publish to ONDC**.

> "One tap. This is a real ONDC retail catalog payload — the government's open
> commerce network. Not our marketplace. *The* network."

**Then hold up the QR code:**

> "Scan this."

*Let a judge scan it with their own phone. Their phone opens the product page
for an item that did not exist ninety seconds ago.*

**This is the moment. Stop talking and let it land.**

---

### Step 6 (optional beat) — The buyer side · 10 seconds

Tap **🛒 Buyer view**. The chrome turns into a buyer app on the ONDC network.
Search for a word from the item you just published — **it's right there.**

> "And here's the other half. The same network she just published to — this is
> what a *buyer* sees. She published thirty seconds ago; a buyer can already
> find her. Seller and buyer, one network, on one phone."

---

### Close — 10 seconds

> "Ninety seconds. One photo, one sentence, in her language. Karigar AI does
> the photography, the copywriting, the translation, the pricing, and the
> distribution.
>
> We're not building another marketplace. We're solving the seller-side
> problem that keeps seven million artisans out of e-commerce."

---

## Fallbacks — memorise these

| It breaks | You do |
|---|---|
| Background removal is slow / fails | Keep talking. It still returns a studio-lit image. Say *"the AI is enhancing the lighting"* — true either way. |
| Gemini is slow or rate-limited | Nothing. Mock fallback is automatic and looks identical. |
| Backend unreachable from the phone | Console: `localStorage.setItem('karigar_demo','1')`, reload. Fully offline. |
| Total meltdown | Play the pre-recorded 90-second video. **Have it on the phone, downloaded, before you walk in.** |

**Never say the words "it's not working."** Say *"let me show you the recorded
run"* and keep the energy up. Judges remember composure.

---

## Questions you will be asked

Full prep in [JUDGE_QA.md](JUDGE_QA.md). The three that always come:

1. **"How do you know that price is fair?"** → the grounded comparables engine
   (market median + skill premium + fair-wage floor), see [JUDGE_QA.md](JUDGE_QA.md)
2. **"Are you actually on ONDC?"** → be honest: schema-correct payload, BPP
   registration is the next step. *Never overclaim this to an ONDC judge.*
3. **"How does an artisan find this app?"** → SHGs, artisan co-operatives, and
   the Development Commissioner (Handicrafts) cluster network — not app-store
   downloads
