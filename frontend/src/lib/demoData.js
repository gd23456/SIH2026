// Client-side fallback so the mobile app keeps working even with NO backend
// reachable (e.g. on a device without the Python server, or offline on stage).
// api.js uses these automatically when a request fails or demo mode is on.

export function demoListing(transcript = "") {
  const t = transcript.toLowerCase();
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

export function demoPublish(listing = {}, price = 749) {
  const id = "KARIGAR-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const storefront = `https://karigar.ai/p/${id}`;
  const title = listing?.title?.en || "Handcrafted Product";
  return {
    listing_id: id,
    status: "PUBLISHED",
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
  const mk = (id, title, price, category) => ({
    listing_id: id,
    title,
    price,
    category,
    gi_candidate: null,
    has_image: false,
    image_url: "",
    storefront_url: `https://karigar.ai/p/${id}`,
    created_at: new Date().toISOString(),
    _demo: true,
  });
  return [
    mk("KARIGAR-DEMO0001", demoListing("bamboo basket").title, 749, "Home & Living / Storage"),
    mk("KARIGAR-DEMO0002", demoListing("clay vase").title, 899, "Home & Living / Decor"),
  ];
}
