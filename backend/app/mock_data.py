"""Realistic fallback data so the demo works with zero API keys / offline.

The mock is keyword-aware: it reads the artisan's transcript and produces a
plausible, well-formed listing. It is intentionally good enough to demo on
stage if the network or key fails.

Every craft carries hand-written `title_hi`/`title_kn`/`desc_hi`/`desc_kn`.
These are real translations, not word substitution: mock mode is what we demo
on when the wifi dies, and "multilingual listing" is the claim being made on
stage, so the Hindi and Kannada text has to actually read as Hindi and Kannada.
"""
from __future__ import annotations

import re

CRAFTS = [
    {
        "keys": ["bamboo", "basket", "cane", "बाँस", "टोकरी", "ಬಿದಿರು", "ಬುಟ್ಟಿ"],
        "title": "Handwoven Bamboo Storage Basket",
        "title_hi": "हस्तनिर्मित बाँस की भंडारण टोकरी",
        "title_kn": "ಕೈಯಿಂದ ಹೆಣೆದ ಬಿದಿರಿನ ಸಂಗ್ರಹ ಬುಟ್ಟಿ",
        "material": "Natural Bamboo",
        "category": "Home & Living / Storage",
        "craft_technique": "Traditional hand-weaving",
        "production_time": "3 days",
        "dimensions": "30 × 30 × 25 cm",
        "tags": ["handmade", "eco-friendly", "bamboo", "storage", "sustainable", "artisan"],
        "gi_candidate": None,
        "desc": "A beautifully handwoven storage basket crafted from natural bamboo by skilled rural artisans. Each basket is made over three days using traditional hand-weaving techniques passed down through generations. Durable, lightweight, and fully biodegradable — perfect for eco-conscious homes.",
        "desc_hi": "कुशल ग्रामीण कारीगरों द्वारा प्राकृतिक बाँस से हाथ से बुनी गई एक सुंदर भंडारण टोकरी। हर टोकरी पीढ़ियों से चली आ रही पारंपरिक बुनाई तकनीकों से तीन दिनों में बनाई जाती है। टिकाऊ, हल्की और पूरी तरह जैव-अपघटनीय — पर्यावरण के प्रति सजग घरों के लिए एकदम सही।",
        "desc_kn": "ನುರಿತ ಗ್ರಾಮೀಣ ಕುಶಲಕರ್ಮಿಗಳು ನೈಸರ್ಗಿಕ ಬಿದಿರಿನಿಂದ ಕೈಯಿಂದ ಹೆಣೆದ ಸುಂದರವಾದ ಸಂಗ್ರಹ ಬುಟ್ಟಿ. ಪ್ರತಿ ಬುಟ್ಟಿಯನ್ನೂ ತಲೆಮಾರುಗಳಿಂದ ಬಂದ ಸಾಂಪ್ರದಾಯಿಕ ಹೆಣಿಗೆ ತಂತ್ರಗಳಿಂದ ಮೂರು ದಿನಗಳಲ್ಲಿ ತಯಾರಿಸಲಾಗುತ್ತದೆ. ಬಾಳಿಕೆ ಬರುವ, ಹಗುರವಾದ ಮತ್ತು ಸಂಪೂರ್ಣ ಜೈವಿಕ ವಿಘಟನೀಯ — ಪರಿಸರ ಪ್ರಜ್ಞೆಯ ಮನೆಗಳಿಗೆ ಸೂಕ್ತ.",
        "base_price": 749,
    },
    {
        "keys": ["pottery", "clay", "terracotta", "vase", "pot", "मिट्टी", "ಮಣ್ಣಿನ"],
        "title": "Hand-thrown Terracotta Vase",
        "title_hi": "हाथ से गढ़ा टेराकोटा फूलदान",
        "title_kn": "ಕೈಯಿಂದ ರೂಪಿಸಿದ ಟೆರಾಕೋಟಾ ಹೂದಾನಿ",
        "material": "Natural Terracotta Clay",
        "category": "Home & Living / Decor",
        "craft_technique": "Wheel-thrown & sun-dried",
        "production_time": "4 days",
        "dimensions": "25 cm height",
        "tags": ["handmade", "terracotta", "pottery", "home-decor", "eco-friendly"],
        "gi_candidate": None,
        "desc": "An elegant hand-thrown terracotta vase shaped on a traditional potter's wheel and finished by hand. Natural clay tones and a matte earthen texture make each piece unique. Crafted over four days by a master potter.",
        "desc_hi": "पारंपरिक चाक पर गढ़ा और हाथ से पूरा किया गया एक सुंदर टेराकोटा फूलदान। प्राकृतिक मिट्टी के रंग और मैट मिट्टी जैसी बनावट हर टुकड़े को अनोखा बनाती है। एक कुशल कुम्हार द्वारा चार दिनों में तैयार।",
        "desc_kn": "ಸಾಂಪ್ರದಾಯಿಕ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ರೂಪಿಸಿ ಕೈಯಿಂದ ಪೂರ್ಣಗೊಳಿಸಿದ ಸೊಗಸಾದ ಟೆರಾಕೋಟಾ ಹೂದಾನಿ. ನೈಸರ್ಗಿಕ ಮಣ್ಣಿನ ಬಣ್ಣ ಮತ್ತು ಮ್ಯಾಟ್ ಮಣ್ಣಿನ ವಿನ್ಯಾಸ ಪ್ರತಿ ತುಣುಕನ್ನೂ ವಿಶಿಷ್ಟವಾಗಿಸುತ್ತದೆ. ನುರಿತ ಕುಂಬಾರರಿಂದ ನಾಲ್ಕು ದಿನಗಳಲ್ಲಿ ತಯಾರಿಸಲಾಗಿದೆ.",
        "base_price": 899,
    },
    {
        "keys": ["silk", "saree", "sari", "weave", "रेशम", "साड़ी", "ರೇಷ್ಮೆ", "ಸೀರೆ"],
        "title": "Handloom Mysore Silk Saree",
        "title_hi": "हथकरघा मैसूर सिल्क साड़ी",
        "title_kn": "ಕೈಮಗ್ಗದ ಮೈಸೂರು ರೇಷ್ಮೆ ಸೀರೆ",
        "material": "Pure Mulberry Silk with Gold Zari",
        "category": "Clothing / Ethnic Wear",
        "craft_technique": "Traditional handloom weaving",
        "production_time": "12 days",
        "dimensions": "6.3 metres with blouse piece",
        "tags": ["handloom", "silk", "saree", "mysore-silk", "zari", "heritage"],
        "gi_candidate": "Mysore Silk (GI)",
        "desc": "A resplendent handloom saree woven from pure mulberry silk with genuine gold zari borders. Hand-woven over twelve days in the Mysore tradition, celebrated for its lustrous finish and enduring craftsmanship.",
        "desc_hi": "शुद्ध शहतूत रेशम से बुनी गई, असली सोने की ज़री किनारी वाली एक भव्य हथकरघा साड़ी। मैसूर परंपरा में बारह दिनों में हाथ से बुनी गई, जो अपनी चमकदार फिनिश और टिकाऊ कारीगरी के लिए प्रसिद्ध है।",
        "desc_kn": "ಶುದ್ಧ ಹಿಪ್ಪುನೇರಳೆ ರೇಷ್ಮೆಯಿಂದ ನೇಯ್ದ, ನೈಜ ಚಿನ್ನದ ಜರಿ ಅಂಚಿನ ಭವ್ಯವಾದ ಕೈಮಗ್ಗದ ಸೀರೆ. ಮೈಸೂರು ಸಂಪ್ರದಾಯದಲ್ಲಿ ಹನ್ನೆರಡು ದಿನಗಳಲ್ಲಿ ಕೈಯಿಂದ ನೇಯಲಾಗಿದೆ; ತನ್ನ ಹೊಳಪು ಮತ್ತು ಬಾಳಿಕೆ ಬರುವ ಕರಕುಶಲತೆಗೆ ಪ್ರಸಿದ್ಧ.",
        "base_price": 8499,
    },
    {
        "keys": ["wooden", "toy", "channapatna", "wood", "लकड़ी", "खिलौना", "ಮರದ", "ಆಟಿಕೆ"],
        "title": "Channapatna Wooden Spinning Top Set",
        "title_hi": "चन्नपटना लकड़ी के लट्टू का सेट",
        "title_kn": "ಚನ್ನಪಟ್ಟಣದ ಮರದ ಬುಗುರಿ ಸೆಟ್",
        "material": "Ivory-wood (Wrightia tinctoria) with natural lac colours",
        "category": "Toys & Games",
        "craft_technique": "Lacquer-turnery (Channapatna)",
        "production_time": "2 days",
        "dimensions": "Set of 4, 6–9 cm each",
        "tags": ["channapatna", "wooden-toys", "handmade", "non-toxic", "kids", "heritage"],
        "gi_candidate": "Channapatna Toys (GI)",
        "desc": "A vibrant set of hand-turned wooden spinning tops made in the famed Channapatna tradition, coloured with safe natural lac dyes. Non-toxic and lovingly finished — a piece of Karnataka's toy-making heritage.",
        "desc_hi": "प्रसिद्ध चन्नपटना परंपरा में हाथ से खरादे गए लकड़ी के लट्टुओं का एक रंगीन सेट, जिन्हें सुरक्षित प्राकृतिक लाख के रंगों से रंगा गया है। गैर-विषैले और प्यार से तैयार — कर्नाटक की खिलौना-निर्माण विरासत का एक हिस्सा।",
        "desc_kn": "ಪ್ರಸಿದ್ಧ ಚನ್ನಪಟ್ಟಣ ಸಂಪ್ರದಾಯದಲ್ಲಿ ಕೈಯಿಂದ ಕಡೆದ ಮರದ ಬುಗುರಿಗಳ ರೋಮಾಂಚಕ ಸೆಟ್, ಸುರಕ್ಷಿತ ನೈಸರ್ಗಿಕ ಅರಗಿನ ಬಣ್ಣಗಳಿಂದ ಬಣ್ಣಿಸಲಾಗಿದೆ. ವಿಷರಹಿತ ಮತ್ತು ಪ್ರೀತಿಯಿಂದ ಪೂರ್ಣಗೊಳಿಸಲಾಗಿದೆ — ಕರ್ನಾಟಕದ ಆಟಿಕೆ ತಯಾರಿಕೆಯ ಪರಂಪರೆಯ ತುಣುಕು.",
        "base_price": 649,
    },
]

_DEFAULT = {
    "title": "Handcrafted Artisan Product",
    "title_hi": "हस्तनिर्मित कारीगर उत्पाद",
    "title_kn": "ಕೈಯಿಂದ ಮಾಡಿದ ಕರಕುಶಲ ಉತ್ಪನ್ನ",
    "material": "Natural handcrafted materials",
    "category": "Handicrafts",
    "craft_technique": "Traditional handcraft",
    "production_time": "2 days",
    "dimensions": "Standard",
    "tags": ["handmade", "artisan", "handicraft", "traditional", "india"],
    "gi_candidate": None,
    "desc": "A one-of-a-kind handcrafted piece made by a skilled artisan using traditional techniques and natural materials. Every item is unique and made with care.",
    "desc_hi": "एक कुशल कारीगर द्वारा पारंपरिक तकनीकों और प्राकृतिक सामग्री से बनाया गया अनोखा हस्तनिर्मित उत्पाद। हर वस्तु अनूठी है और पूरे ध्यान से बनाई गई है।",
    "desc_kn": "ನುರಿತ ಕುಶಲಕರ್ಮಿಯೊಬ್ಬರು ಸಾಂಪ್ರದಾಯಿಕ ತಂತ್ರಗಳು ಮತ್ತು ನೈಸರ್ಗಿಕ ವಸ್ತುಗಳಿಂದ ತಯಾರಿಸಿದ ಅನನ್ಯ ಕೈಕೆಲಸದ ಉತ್ಪನ್ನ. ಪ್ರತಿ ವಸ್ತುವೂ ವಿಶಿಷ್ಟವಾಗಿದ್ದು ಕಾಳಜಿಯಿಂದ ತಯಾರಿಸಲಾಗಿದೆ.",
    "base_price": 599,
}


def match_craft(transcript: str) -> dict:
    t = (transcript or "").lower()
    for c in CRAFTS:
        if any(k in t for k in c["keys"]):
            return c
    return _DEFAULT


def mock_listing(transcript: str) -> dict:
    c = match_craft(transcript)
    title = c["title"]
    desc = c["desc"]
    return {
        "title": {"en": title, "hi": c["title_hi"], "kn": c["title_kn"]},
        "description": {"en": desc, "hi": c["desc_hi"], "kn": c["desc_kn"]},
        "material": c["material"],
        "category": c["category"],
        "craft_technique": c["craft_technique"],
        "production_time": c["production_time"],
        "dimensions": c["dimensions"],
        "tags": c["tags"],
        "gi_candidate": c["gi_candidate"],
        "_base_price": c["base_price"],
    }


def mock_price(listing: dict) -> dict:
    # Anchor the suggested price to a realistic value for the craft, then
    # decompose it into an explainable breakdown that sums back to it.
    suggested = int(listing.get("_base_price") or _DEFAULT["base_price"])
    days = _days_from(listing.get("production_time", "2 days"))
    materials = int(suggested * 0.35)
    labour = int(suggested * 0.40)
    skill = int(suggested * 0.20)
    platform = suggested - materials - labour - skill  # remainder keeps the sum exact
    return {
        "suggested_price": max(suggested, 199),
        "min_price": int(suggested * 0.85),
        "max_price": int(suggested * 1.35),
        "currency": "INR",
        "reasoning": [
            f"Materials (~35%): {listing.get('material','natural materials')} → ₹{materials}",
            f"Labour: {days} day(s) of skilled handwork → ₹{labour}",
            "Skill premium for traditional handcraft (~20%)",
            f"Comparable handmade listings in this category sell for ₹{int(suggested * 0.85)}–₹{int(suggested * 1.35)}",
        ],
        "breakdown": [
            {"label": "Materials", "amount": materials},
            {"label": "Labour", "amount": labour},
            {"label": "Skill premium", "amount": skill},
            {"label": "Platform + shipping", "amount": platform},
        ],
        "market_note": "Priced to protect the artisan's margin while staying competitive with mass-market alternatives.",
    }


def _days_from(text: str) -> int:
    m = re.search(r"(\d+)", text or "")
    return int(m.group(1)) if m else 2
