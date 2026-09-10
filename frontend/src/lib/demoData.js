// Client-side fallback so the mobile app keeps working even with NO backend
// reachable (e.g. on a device without the Python server, or offline on stage).
// api.js uses these automatically when a request fails or demo mode is on.

export function demoListing(transcript = "") {
  const t = transcript.toLowerCase();
  if (t.includes("channapatna") || t.includes("wooden toy") || t.includes("toy") || t.includes("आटिका") || t.includes("ಆಟಿಕೆ")) {
    // A registry-verified GI, so the offline demo shows the green Verified GI badge.
    return {
      title: { en: "Channapatna Wooden Spinning Top Set", hi: "चन्नापटना लकड़ी का लट्टू सेट", kn: "ಚನ್ನಪಟ್ಟಣ ಮರದ ಬುಗುರಿ ಸೆಟ್" },
      description: {
        en: "A vibrant set of hand-turned wooden spinning tops made in the famed Channapatna tradition, coloured with safe natural lac dyes. Non-toxic and lovingly finished — a piece of Karnataka's toy-making heritage.",
        hi: "प्रसिद्ध चन्नापटना परंपरा में हाथ से बने लकड़ी के लट्टुओं का जीवंत सेट, सुरक्षित प्राकृतिक लाख रंगों से रंगा। गैर-विषैला और प्यार से तैयार।",
        kn: "ಪ್ರಸಿದ್ಧ ಚನ್ನಪಟ್ಟಣ ಸಂಪ್ರದಾಯದಲ್ಲಿ ಕೈಯಿಂದ ತಿರುಗಿಸಿದ ಮರದ ಬುಗುರಿಗಳ ಸೆಟ್, ಸುರಕ್ಷಿತ ನೈಸರ್ಗಿಕ ಅರಗಿನ ಬಣ್ಣ. ವಿಷರಹಿತ ಮತ್ತು ಪ್ರೀತಿಯಿಂದ ಸಿದ್ಧ.",
      },
      material: "Ivory-wood with natural lac colours",
      category: "Toys & Games",
      craft_technique: "Lacquer-turnery (Channapatna)",
      production_time: "2 days",
      dimensions: "Set of 4, 6–9 cm each",
      tags: ["channapatna", "wooden-toys", "handmade", "non-toxic", "kids", "heritage"],
      gi_candidate: "Channapatna Toys (GI)",
      gi_verified: true,
      gi_registry_name: "Channapatna Toys and Dolls",
      gi_state: "Karnataka",
    };
  }
  if (t.includes("pottery") || t.includes("clay") || t.includes("vase") || t.includes("मिट्टी")) {
    return {
      title: { en: "Hand-thrown Terracotta Vase", hi: "हस्तनिर्मित टेराकोटा फूलदान", kn: "ಕೈಯಿಂದ ಮಾಡಿದ ಟೆರಾಕೋಟಾ ಹೂದಾನಿ" },
      description: {
        en: "An elegant hand-thrown terracotta vase shaped on a traditional potter's wheel and finished by hand. Natural clay tones make each piece unique.",
        hi: "पारंपरिक चाक पर बनी सुंदर टेराकोटा फूलदान, हाथ से तैयार। हर टुकड़ा अनोखा है।",
        kn: "ಸಾಂಪ್ರದಾಯಿಕ ಚಕ್ರದ ಮೇಲೆ ರೂಪಿಸಿದ ಸೊಗಸಾದ ಟೆರಾಕೋಟಾ ಹೂದಾನಿ. ಪ್ರತಿ ತುಣುಕೂ ವಿಶಿಷ್ಟ.",
      },
      material: "Natural Terracotta Clay",
      category: "Home & Living / Decor",
      craft_technique: "Wheel-thrown & sun-dried",
      production_time: "4 days",
      dimensions: "25 cm height",
      tags: ["handmade", "terracotta", "pottery", "home-decor", "eco-friendly"],
      gi_candidate: null,
    };
  }
  // default: bamboo basket (matches the pitch demo)
  return {
    title: { en: "Handwoven Bamboo Storage Basket", hi: "हस्तनिर्मित बाँस की टोकरी", kn: "ಕೈಮಗ್ಗ ಬಿದಿರು ಬುಟ್ಟಿ" },
    description: {
      en: "A beautifully handwoven storage basket crafted from natural bamboo by skilled rural artisans over three days using traditional techniques. Durable, lightweight and biodegradable.",
      hi: "कुशल ग्रामीण कारीगरों द्वारा प्राकृतिक बाँस से तीन दिनों में बुनी गई सुंदर टोकरी। मज़बूत, हल्की और पर्यावरण-अनुकूल।",
      kn: "ನೈಸರ್ಗಿಕ ಬಿದಿರಿನಿಂದ ನುರಿತ ಗ್ರಾಮೀಣ ಕುಶಲಕರ್ಮಿಗಳು ಮೂರು ದಿನಗಳಲ್ಲಿ ನೇಯ್ದ ಸುಂದರ ಬುಟ್ಟಿ. ಬಾಳಿಕೆ, ಹಗುರ ಮತ್ತು ಪರಿಸರ ಸ್ನೇಹಿ.",
    },
    material: "Natural Bamboo",
    category: "Home & Living / Storage",
    craft_technique: "Traditional hand-weaving",
    production_time: "3 days",
    dimensions: "30 × 30 × 25 cm",
    tags: ["handmade", "eco-friendly", "bamboo", "storage", "sustainable", "artisan"],
    gi_candidate: null,
  };
}

// Kept in lock-step with backend/app/services/pricing_service.py so the offline
// demo shows the SAME grounded number, market comparable and wage-floor beat
// the live backend would. Three signals: LLM estimate × market band × wage floor.
const DAILY_FAIR_WAGE = 400; // ₹/day — the fairness guarantee
const MARKET_WEIGHT = 0.45;
const COMPARABLES = [
  { keys: ["silk", "saree", "sari", "handloom", "zari"], cat: "Handloom Silk Saree", median: 8200, low: 5200, high: 15500, count: 23 },
  { keys: ["channapatna", "toy", "wooden toy", "lacquer"], cat: "Channapatna Wooden Toys", median: 640, low: 320, high: 1200, count: 41 },
  { keys: ["bamboo", "cane", "basket", "wicker"], cat: "Bamboo & Cane Storage", median: 720, low: 480, high: 1250, count: 34 },
  { keys: ["terracotta", "pottery", "clay", "vase", "decor"], cat: "Terracotta & Pottery Decor", median: 860, low: 520, high: 1600, count: 29 },
  { keys: ["jute", "tote", "sack"], cat: "Jute Bags", median: 430, low: 240, high: 820, count: 38 },
  { keys: ["brass", "bidri", "dhokra", "metal"], cat: "Brassware & Metal Craft", median: 1450, low: 780, high: 3400, count: 27 },
];
const COMP_DEFAULT = { cat: "Handmade", median: 650, low: 350, high: 1500, count: 46 };

function matchComparable(listing = {}) {
  const hay = [listing.title?.en, listing.category, listing.material, listing.craft_technique]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return COMPARABLES.find((c) => c.keys.some((k) => hay.includes(k))) || COMP_DEFAULT;
}

function daysFrom(text) {
  const m = String(text || "").match(/(\d+)/);
  return m ? Math.max(1, Number(m[1])) : 2;
}

export function demoPrice(listing = {}) {
  const isSilk = (listing.material || "").toLowerCase().includes("silk");
  const llm = isSilk ? 8499 : listing.category?.includes("Decor") ? 899 : 749;

  const band = matchComparable(listing);
  const blended = Math.round((1 - MARKET_WEIGHT) * llm + MARKET_WEIGHT * band.median);

  const labourDays = daysFrom(listing.production_time || "3 days");
  const wageFloor = labourDays * DAILY_FAIR_WAGE;
  const wageFloorApplied = wageFloor > blended;
  const suggested = Math.max(blended, wageFloor);

  const minPrice = Math.min(Math.max(wageFloor, Math.round(suggested * 0.85)), suggested);
  const maxPrice = Math.max(Math.round(suggested * 1.35), band.high, suggested);

  // breakdown scaled to sum to the suggested price
  const materials = Math.round(suggested * 0.35);
  const labour = Math.round(suggested * 0.4);
  const skill = Math.round(suggested * 0.2);
  const platform = suggested - materials - labour - skill;

  return {
    suggested_price: suggested,
    min_price: minPrice,
    max_price: maxPrice,
    currency: "INR",
    reasoning: [
      `Market check: median ₹${band.median.toLocaleString("en-IN")} across ${band.count} similar ${band.cat.toLowerCase()} listings.`,
      `Fair-wage floor: ${labourDays} day(s) × ₹${DAILY_FAIR_WAGE}/day = ₹${wageFloor.toLocaleString("en-IN")}` +
        (wageFloorApplied
          ? " — binding, so the price was raised to protect the artisan's labour."
          : " — the suggested price already clears it."),
      `Skill premium for traditional handcraft (~20%)`,
    ],
    breakdown: [
      { label: "Materials", amount: materials },
      { label: "Labour", amount: labour },
      { label: "Skill premium", amount: skill },
      { label: "Platform + shipping", amount: platform },
    ],
    market_note: `Grounded against ${band.count} comparable listings and a fair-wage floor.`,
    market_median: band.median,
    market_sample_count: band.count,
    market_source: "ONDC/Amazon/Etsy observed listings",
    wage_floor: wageFloor,
    wage_floor_applied: wageFloorApplied,
  };
}

// The channel registry, mirrored from backend/app/services/channels.py so the
// offline demo shows the same "publish everywhere" story. ONDC is the one real
// channel; the rest are honestly-labelled demo adapters.
export function demoChannels() {
  return [
    { id: "ondc", name: "ONDC", kind: "live", logo: "🟢", note: "Open Network for Digital Commerce — a real, schema-correct catalog + storefront.", connected: true, mode: "live", configured: true },
    { id: "meesho", name: "Meesho", kind: "demo", logo: "🛍️", note: "Simulated for the prototype — real seller-API integration is on the roadmap.", connected: false, mode: "demo", configured: false },
    { id: "myntra", name: "Myntra", kind: "demo", logo: "👗", note: "Simulated for the prototype — real seller-API integration is on the roadmap.", connected: false, mode: "demo" },
    { id: "amazon_karigar", name: "Amazon Karigar", kind: "demo", logo: "📦", note: "Simulated for the prototype — real seller-API integration is on the roadmap.", connected: false, mode: "demo" },
    { id: "flipkart_samarth", name: "Flipkart Samarth", kind: "demo", logo: "🛒", note: "Simulated for the prototype — real seller-API integration is on the roadmap.", connected: false, mode: "demo" },
    { id: "whatsapp", name: "WhatsApp Business", kind: "demo", logo: "💬", note: "Simulated for the prototype — WhatsApp Business catalog API is on the roadmap.", connected: false, mode: "demo" },
  ];
}

const _CH_NAMES = Object.fromEntries(demoChannels().map((c) => [c.id, c]));

function demoChannelResults(id, storefront, channels) {
  const selected = Array.from(new Set(["ondc", ...(channels || [])]));
  return selected
    .map((cid) => {
      const ch = _CH_NAMES[cid];
      if (!ch) return null;
      // ONDC is the one real live channel; everything else is a demo record.
      if (cid === "ondc") {
        return { channel_id: cid, name: ch.name, kind: "live", mode: "live", status: "Live on ONDC", ref: id, storefront_url: storefront, qr_url: null };
      }
      const ref = cid.split("_")[0].slice(0, 3).toUpperCase() + "-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      return { channel_id: cid, name: ch.name, kind: "demo", mode: "demo", status: `Published to ${ch.name} (demo)`, ref, storefront_url: null, qr_url: null };
    })
    .filter(Boolean);
}

export function demoPublish(listing = {}, price = 749, channels = ["ondc"]) {
  const id = "KARIGAR-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const storefront = `https://karigar.ai/p/${id}`;
  const title = listing?.title?.en || "Handcrafted Product";
  return {
    listing_id: id,
    status: "PUBLISHED",
    channel_results: demoChannelResults(id, storefront, channels),
    // No backend reachable, so nothing was actually persisted and there is no
    // page for a QR code to point at. PublishStep reads this flag and shows
    // the share link without a dead QR.
    _demo: true,
    storefront_url: storefront,
    whatsapp_share_url:
      "https://wa.me/?text=" +
      encodeURIComponent(`🧺 ${title}\n💰 ₹${price} (handmade, fair-price)\nBuy on ONDC 👉 ${storefront}`),
    ondc_catalog: {
      context: { domain: "ONDC:RET10", country: "IND", action: "on_search", core_version: "1.2.0" },
      message: {
        catalog: {
          "bpp/descriptor": { name: "Karigar AI Seller App" },
          "bpp/providers": [
            {
              id: "artisan",
              items: [
                {
                  id,
                  descriptor: { name: title, long_desc: listing?.description?.en || "" },
                  price: { currency: "INR", value: String(price) },
                  category_id: listing.category || "Handicrafts",
                },
              ],
            },
          ],
        },
      },
    },
  };
}

// Canned "My Products" rows for when the backend is unreachable. Shapes match
// ListingSummary from the API so the grid renders identically either way.
export function demoListings() {
  const mk = (id, title, price, category, gi = {}) => ({
    listing_id: id,
    title,
    price,
    category,
    gi_candidate: gi.gi_candidate ?? null,
    gi_verified: gi.gi_verified ?? false,
    gi_state: gi.gi_state ?? null,
    has_image: false,
    image_url: "",
    storefront_url: `https://karigar.ai/p/${id}`,
    created_at: new Date().toISOString(),
    _demo: true,
  });
  const silkTitle = {
    en: "Handloom Mysore Silk Saree",
    hi: "हस्तनिर्मित मैसूर रेशम साड़ी",
    kn: "ಕೈಮಗ್ಗ ಮೈಸೂರು ರೇಷ್ಮೆ ಸೀರೆ",
  };
  const juteTitle = {
    en: "Handwoven Jute Tote Bag",
    hi: "हस्तनिर्मित जूट बैग",
    kn: "ಕೈಮಗ್ಗ ಸೆಣಬು ಚೀಲ",
  };
  return [
    mk("KARIGAR-DEMO0001", demoListing("bamboo basket").title, 1200, "Home & Living / Storage"),
    mk("KARIGAR-DEMO0002", demoListing("clay vase").title, 1600, "Home & Living / Decor"),
    mk("KARIGAR-DEMO0003", demoListing("channapatna toy").title, 897, "Toys & Games", {
      gi_verified: true,
      gi_state: "Karnataka",
    }),
    mk("KARIGAR-DEMO0004", silkTitle, 5520, "Clothing / Ethnic Wear", {
      gi_verified: true,
      gi_state: "Karnataka",
    }),
    mk("KARIGAR-DEMO0005", juteTitle, 480, "Bags & Accessories"),
  ];
}

// Offline demo impact numbers, so the Impact card is never blank on stage.
export function demoImpact() {
  return {
    products: 3,
    channels_reached: 2,
    total_views: 47,
    total_scans: 0,
    fair_value_uplift: 1420,
    currency: "INR",
    baseline_method:
      "Estimated additional income vs typical underpricing — based on our fair-price engine.",
  };
}

// Offline buyer-side search: filter the demo catalogue by title / category so
// the buyer view still "finds" a product with no backend reachable.
export function demoSearch(query = "") {
  const q = query.trim().toLowerCase();
  const rows = demoListings();
  if (!q) return rows;
  return rows.filter((r) => {
    const hay = [r.title?.en, r.title?.hi, r.title?.kn, r.category, r.gi_state]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
