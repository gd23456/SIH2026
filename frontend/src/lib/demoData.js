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

export function demoPrice(listing = {}) {
  const isSilk = (listing.material || "").toLowerCase().includes("silk");
  const suggested = isSilk ? 8499 : listing.category?.includes("Decor") ? 899 : 749;
  return {
    suggested_price: suggested,
    min_price: Math.round(suggested * 0.85),
    max_price: Math.round(suggested * 1.35),
    currency: "INR",
    reasoning: [
      `Materials (~35%): ${listing.material || "natural materials"}`,
      `Labour: ${listing.production_time || "3 days"} of skilled handwork`,
      "Skill premium for traditional handcraft (~20%)",
      `Comparable handmade listings sell for ₹${Math.round(suggested * 0.85)}–₹${Math.round(suggested * 1.35)}`,
    ],
    breakdown: [
      { label: "Materials", amount: Math.round(suggested * 0.35) },
      { label: "Labour", amount: Math.round(suggested * 0.4) },
      { label: "Skill premium", amount: Math.round(suggested * 0.2) },
      { label: "Platform + shipping", amount: Math.round(suggested * 0.05) },
    ],
    market_note: "Priced to protect the artisan's margin while staying competitive with mass-market alternatives.",
  };
}

export function demoPublish(listing = {}, price = 749) {
  const id = "KARIGAR-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const storefront = `https://karigar.ai/p/${id}`;
  const title = listing?.title?.en || "Handcrafted Product";
  return {
    listing_id: id,
    status: "PUBLISHED",
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
