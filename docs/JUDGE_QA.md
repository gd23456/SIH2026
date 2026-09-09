# Judge Q&A Prep

Rehearse these out loud. The demo gets you noticed; the Q&A gets you scored.

**Rule one: never bluff.** SIH panels include domain experts — ONDC people,
Ministry of Textiles people. "That's not built yet, here's our plan" scores
better than a claim that collapses under one follow-up question.

---

## The three you will definitely get

### "How do you know that price is fair?"

> "Three grounded inputs, and it shows her the breakdown so she can disagree
> with any line of it.
>
> One — a **market median** from real comparable listings in that category;
> for a bamboo basket that's ₹720 across 34 observed listings.
>
> Two — a **fair-wage floor**: the production time she told us, times a fair
> daily wage. Three days of skilled work is ₹1,200, and the price *cannot* go
> below that. That's the important one — it means the engine will never let
> her sell her own labour below cost, which is the single most common way
> artisans get exploited.
>
> Three — a **skill premium**, and for a verified-GI craft a documented +15%
> on top, because a verified Channapatna toy should not be priced like a
> generic wooden toy.
>
> The point isn't that the number is perfect. Today nobody tells her anything
> at all — a middleman just names a price. This gives her a defensible starting
> position, grounded in comparable listings and her own labour cost."

**Why can the fair price come out *above* the market median?** That's the
feature, not a bug. If three days of skilled labour is worth ₹1,200 and the
market only pays ₹720, the market is underpaying — and the floor says so out
loud. We'd rather defend a fair number than a cheap one.

### "Are you actually publishing to ONDC?"

> "We generate a schema-correct ONDC RET10 retail catalog payload — the real
> shape, not a mock. What we haven't done is register as a seller app, a BPP,
> on the live network; that's an organisational process, not a technical one.
> That's our immediate next step. We built to the spec so that registration
> is the only thing standing between this and live."

**Do not say "we're on ONDC."** An ONDC judge will ask for your subscriber ID.

### "How does an artisan ever find this app?"

> "They don't find it on an app store — that's the wrong distribution model
> for this user. They get it through the institutions they're already in:
> self-help groups, artisan co-operatives, and the cluster network run by the
> Development Commissioner for Handicrafts. One digitally-confident person
> per cluster onboards twenty artisans. That's how BHIM and Jan Dhan reached
> this exact demographic."

---

## Technical

**"What if the AI describes the product wrong?"**
> "The artisan reviews and edits everything before publishing — nothing goes
> live unseen. The AI drafts; she approves. That ordering is deliberate: it
> keeps her in authorship of her own product."

**"Why Gemini? What if it's down or costs money at scale?"**
> "Free tier covers the hackathon. Architecturally the model is behind a
> service interface with a full fallback path — you can see it running right
> now with the key removed. At scale we'd fine-tune a smaller open model on
> craft vocabulary; the prompts and the schema are the actual asset, not the
> vendor."

**"Does the background removal work on every craft?"**
> "U²-Net handles distinct objects well — pottery, baskets, toys. Textiles
> on a cluttered surface are harder. When the cutout isn't confident we fall
> back to lighting and colour correction, which still substantially improves
> a workshop photo. We'd rather degrade than produce a mangled cutout."

**"What about very low-end phones and bad networks?"**
> "It's a PWA — it installs without the Play Store and runs in about 3MB. The
> app shell is cached offline, and we compress aggressively on slow
> connections. Voice input matters more than you'd think here: speaking one
> sentence uses far less data and far less literacy than filling a form."

**"What's your accuracy? Have you tested with real artisans?"**
> "Honestly: not yet at scale. That's the biggest gap in this project and
> we're not going to pretend otherwise. What we'd do first with support is a
> 30-artisan pilot through one cluster, measuring listing completion rate and
> realised price versus their previous middleman price. Those are the two
> numbers that decide whether this works."

*Never invent a statistic. "We haven't measured that yet" is a strong answer.*

---

## Business

**"How do you make money?"**
> "A small take rate on completed orders — meaningfully below what a middleman
> takes today, so the artisan is better off even after our cut. Free to list,
> always; charging an artisan to try it would kill adoption. Later:
> value-added services like GST filing and working-capital access, priced to
> institutions rather than to artisans."

**"What stops Amazon or Meesho from building this?"**
> "Nothing technically. But they're demand-side businesses — their problem is
> buyers, and their seller tooling assumes a seller who can already
> photograph, write and price. We're built for the seller who can't, in a
> language they speak, on ONDC rather than inside one company's walled
> garden. The moat is the artisan relationship and the cluster distribution,
> not the model."

**"Why hasn't this been done?"**
> "Voice-to-catalog in Indian languages only became viable very recently, and
> ONDC only recently made distribution possible without owning a marketplace.
> Both preconditions landed at roughly the same time. That's the opening."

---

## Social impact

**"Does this replace the middleman? What happens to them?"**
> "It changes their job rather than deleting it. Aggregators still do
> logistics, quality control and bulk orders — genuinely useful work. What
> we remove is the information asymmetry that lets them take 60% for
> introductions. We're compressing rent, not employment."

**"Could this hurt artisans by driving prices down?"**
> "That's exactly why the price engine has a floor and not just a ceiling. It
> will refuse to suggest a price below the artisan's own labour cost, and it
> tells her when she's underpricing — which, in practice, is the far more
> common failure. And the GI verification pushes premium crafts *up*, because
> a verified Channapatna toy should not be priced like a generic wooden toy."

---

## If you get stumped

> "I don't have a good answer to that yet — can I take it down and come back
> to you?"

Then actually write it down. Judges watch how you handle not knowing, and
they have seen every possible bluff.

---

## Do NOT say

| ❌ | ✅ |
|---|---|
| "We're live on ONDC" | "Schema-correct payload; BPP registration is next" |
| "It's 95% accurate" | "We haven't measured that yet — here's how we'd measure it" |
| "It works for every craft" | "It's strongest on distinct objects; textiles are harder" |
| "There's no competition" | "Marketplaces solve the buyer side; we solve the seller side" |
| "It's not working" *(on stage)* | "Let me show you the recorded run" |
