// UI strings in English / Hindi / Kannada. The artisan picks their language
// once; the whole interface + generated listing follow.

export const LANGS = [
  { code: "en", label: "English", native: "English", speech: "en-IN" },
  { code: "hi", label: "Hindi", native: "हिन्दी", speech: "hi-IN" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", speech: "kn-IN" },
];

const STR = {
  appName: { en: "Karigar AI", hi: "करिगर AI", kn: "ಕರಿಗರ್ AI" },
  tagline: {
    en: "Your voice. Your craft. A national storefront.",
    hi: "आपकी आवाज़। आपका हुनर। देशभर की दुकान।",
    kn: "ನಿಮ್ಮ ಧ್ವನಿ. ನಿಮ್ಮ ಕಲೆ. ರಾಷ್ಟ್ರಮಟ್ಟದ ಅಂಗಡಿ.",
  },
  chooseLang: { en: "Choose your language", hi: "अपनी भाषा चुनें", kn: "ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ" },
  start: { en: "Start selling", hi: "बेचना शुरू करें", kn: "ಮಾರಾಟ ಪ್ರಾರಂಭಿಸಿ" },
  step: { en: "Step", hi: "चरण", kn: "ಹಂತ" },
  // photo
  addPhoto: { en: "Add a photo of your product", hi: "अपने उत्पाद की फ़ोटो जोड़ें", kn: "ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಫೋಟೋ ಸೇರಿಸಿ" },
  takePhoto: { en: "Take / choose photo", hi: "फ़ोटो लें / चुनें", kn: "ಫೋಟೋ ತೆಗೆಯಿರಿ / ಆರಿಸಿ" },
  enhancing: { en: "AI is cleaning up your photo…", hi: "AI आपकी फ़ोटो साफ़ कर रहा है…", kn: "AI ನಿಮ್ಮ ಫೋಟೋ ಸ್ವಚ್ಛಗೊಳಿಸುತ್ತಿದೆ…" },
  before: { en: "Before", hi: "पहले", kn: "ಮೊದಲು" },
  after: { en: "After", hi: "बाद में", kn: "ನಂತರ" },
  bgRemoved: { en: "Background removed & studio-lit ✨", hi: "बैकग्राउंड हटाया गया ✨", kn: "ಹಿನ್ನೆಲೆ ತೆಗೆದುಹಾಕಲಾಗಿದೆ ✨" },
  // voice
  describe: { en: "Tell us about it — just speak", hi: "बस बोलकर बताइए", kn: "ಮಾತನಾಡಿ ಹೇಳಿ" },
  tapMic: { en: "Tap the mic and speak", hi: "माइक दबाएँ और बोलें", kn: "ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ" },
  listening: { en: "Listening…", hi: "सुन रहा है…", kn: "ಕೇಳುತ್ತಿದೆ…" },
  hintEx: {
    en: 'e.g. "Handmade bamboo basket, takes 3 days to make"',
    hi: 'जैसे "हाथ से बना बाँस का टोकरा, बनाने में 3 दिन"',
    kn: 'ಉದಾ "ಕೈಯಿಂದ ಮಾಡಿದ ಬಿದಿರು ಬುಟ್ಟಿ, 3 ದಿನ ಬೇಕು"',
  },
  orType: { en: "or type it", hi: "या टाइप करें", kn: "ಅಥವಾ ಟೈಪ್ ಮಾಡಿ" },
  generate: { en: "Create my listing", hi: "मेरी लिस्टिंग बनाएँ", kn: "ನನ್ನ ಪಟ್ಟಿ ರಚಿಸಿ" },
  generating: { en: "AI is writing your listing…", hi: "AI आपकी लिस्टिंग लिख रहा है…", kn: "AI ನಿಮ್ಮ ಪಟ್ಟಿ ಬರೆಯುತ್ತಿದೆ…" },
  // review
  yourListing: { en: "Your listing is ready", hi: "आपकी लिस्टिंग तैयार है", kn: "ನಿಮ್ಮ ಪಟ್ಟಿ ಸಿದ್ಧವಾಗಿದೆ" },
  material: { en: "Material", hi: "सामग्री", kn: "ಸಾಮಗ್ರಿ" },
  category: { en: "Category", hi: "श्रेणी", kn: "ವರ್ಗ" },
  technique: { en: "Technique", hi: "तकनीक", kn: "ತಂತ್ರ" },
  time: { en: "Made in", hi: "बनाने का समय", kn: "ತಯಾರಿ ಸಮಯ" },
  giTag: { en: "Possible GI tag", hi: "संभावित GI टैग", kn: "ಸಂಭಾವ್ಯ GI ಟ್ಯಾಗ್" },
  next: { en: "Looks good — set price", hi: "ठीक है — दाम तय करें", kn: "ಸರಿ — ಬೆಲೆ ನಿಗದಿಪಡಿಸಿ" },
  // price
  fairPrice: { en: "Fair price", hi: "उचित दाम", kn: "ನ್ಯಾಯಯುತ ಬೆಲೆ" },
  suggested: { en: "AI suggested price", hi: "AI सुझाया दाम", kn: "AI ಸೂಚಿಸಿದ ಬೆಲೆ" },
  whyPrice: { en: "Why this price?", hi: "यह दाम क्यों?", kn: "ಈ ಬೆಲೆ ಏಕೆ?" },
  marketMedianLabel: { en: "Market median", hi: "बाज़ार मध्यमान", kn: "ಮಾರುಕಟ್ಟೆ ಮಧ್ಯಮ" },
  comparableListings: { en: "comparable listings", hi: "तुलनीय लिस्टिंग", kn: "ಹೋಲಿಕೆ ಪಟ್ಟಿಗಳು" },
  wageProtected: {
    en: "Protected by a fair-wage floor — never below the artisan's labour cost.",
    hi: "उचित-मज़दूरी सीमा से सुरक्षित — कारीगर की श्रम लागत से कभी कम नहीं।",
    kn: "ನ್ಯಾಯಯುತ-ವೇತನ ಮಿತಿಯಿಂದ ರಕ್ಷಿತ — ಕುಶಲಕರ್ಮಿಯ ಶ್ರಮ ವೆಚ್ಚಕ್ಕಿಂತ ಎಂದಿಗೂ ಕಡಿಮೆ ಇಲ್ಲ.",
  },
  publish: { en: "Publish to ONDC", hi: "ONDC पर प्रकाशित करें", kn: "ONDC ಗೆ ಪ್ರಕಟಿಸಿ" },
  publishing: { en: "Publishing to the ONDC network…", hi: "ONDC नेटवर्क पर प्रकाशित हो रहा है…", kn: "ONDC ನೆಟ್‌ವರ್ಕ್‌ಗೆ ಪ್ರಕಟಿಸಲಾಗುತ್ತಿದೆ…" },
  // published
  published: { en: "You're live on ONDC! 🎉", hi: "आप ONDC पर लाइव हैं! 🎉", kn: "ನೀವು ONDC ನಲ್ಲಿ ಲೈವ್! 🎉" },
  publishedSub: {
    en: "Buyers across every ONDC app can now find your product.",
    hi: "हर ONDC ऐप पर खरीदार अब आपका उत्पाद पा सकते हैं।",
    kn: "ಪ್ರತಿ ONDC ಅಪ್ಲಿಕೇಶನ್‌ನಲ್ಲಿ ಖರೀದಿದಾರರು ನಿಮ್ಮ ಉತ್ಪನ್ನವನ್ನು ಕಾಣಬಹುದು.",
  },
  shareWhatsapp: { en: "Share on WhatsApp", hi: "WhatsApp पर साझा करें", kn: "WhatsApp ನಲ್ಲಿ ಹಂಚಿಕೊಳ್ಳಿ" },
  sellAnother: { en: "Sell another product", hi: "और उत्पाद बेचें", kn: "ಇನ್ನೊಂದು ಉತ್ಪನ್ನ ಮಾರಿ" },
  ondcPayload: { en: "ONDC catalog (technical)", hi: "ONDC कैटलॉग (तकनीकी)", kn: "ONDC ಕ್ಯಾಟಲಾಗ್ (ತಾಂತ್ರಿಕ)" },
  back: { en: "Back", hi: "वापस", kn: "ಹಿಂದೆ" },
  retake: { en: "Retake", hi: "फिर से", kn: "ಮತ್ತೆ" },
  // storefront QR (publish screen)
  scanToVisit: { en: "Scan to open your storefront", hi: "अपनी दुकान खोलने के लिए स्कैन करें", kn: "ನಿಮ್ಮ ಅಂಗಡಿ ತೆರೆಯಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ" },
  scanHint: {
    en: "Point any phone camera at this code",
    hi: "किसी भी फ़ोन का कैमरा इस कोड पर रखें",
    kn: "ಯಾವುದೇ ಫೋನ್ ಕ್ಯಾಮೆರಾವನ್ನು ಈ ಕೋಡ್‌ಗೆ ತೋರಿಸಿ",
  },
  openStorefront: { en: "Open storefront", hi: "दुकान खोलें", kn: "ಅಂಗಡಿ ತೆರೆಯಿರಿ" },
  qrUnavailable: {
    en: "The storefront needs the server — you're in offline demo mode.",
    hi: "दुकान के लिए सर्वर चाहिए — आप ऑफ़लाइन डेमो मोड में हैं।",
    kn: "ಅಂಗಡಿಗೆ ಸರ್ವರ್ ಬೇಕು — ನೀವು ಆಫ್‌ಲೈನ್ ಡೆಮೊ ಮೋಡ್‌ನಲ್ಲಿದ್ದೀರಿ.",
  },
  // my products
  myProducts: { en: "My products", hi: "मेरे उत्पाद", kn: "ನನ್ನ ಉತ್ಪನ್ನಗಳು" },
  myProductsSub: {
    en: "Everything you have published so far",
    hi: "अब तक आपने जो प्रकाशित किया",
    kn: "ಇಲ್ಲಿಯವರೆಗೆ ನೀವು ಪ್ರಕಟಿಸಿದ ಎಲ್ಲವೂ",
  },
  loadingProducts: { en: "Loading your products…", hi: "आपके उत्पाद लोड हो रहे हैं…", kn: "ನಿಮ್ಮ ಉತ್ಪನ್ನಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…" },
  noProducts: { en: "Nothing published yet", hi: "अभी कुछ प्रकाशित नहीं हुआ", kn: "ಇನ್ನೂ ಏನೂ ಪ್ರಕಟವಾಗಿಲ್ಲ" },
  noProductsSub: {
    en: "Your listings will appear here as soon as you publish one.",
    hi: "जैसे ही आप कुछ प्रकाशित करेंगे, आपकी लिस्टिंग यहाँ दिखेगी।",
    kn: "ನೀವು ಪ್ರಕಟಿಸಿದ ತಕ್ಷಣ ನಿಮ್ಮ ಪಟ್ಟಿಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  },
  live: { en: "Live", hi: "लाइव", kn: "ಲೈವ್" },
  done: { en: "Done", hi: "हो गया", kn: "ಮುಗಿದಿದೆ" },
  // connection sheet (Android needs this: there is no JS console on a phone)
  connection: { en: "Connection", hi: "कनेक्शन", kn: "ಸಂಪರ್ಕ" },
  connectionSub: {
    en: "Point the app at your laptop",
    hi: "ऐप को अपने लैपटॉप से जोड़ें",
    kn: "ಅಪ್ಲಿಕೇಶನ್ ಅನ್ನು ನಿಮ್ಮ ಲ್ಯಾಪ್‌ಟಾಪ್‌ಗೆ ತೋರಿಸಿ",
  },
  serverAddress: { en: "Server address", hi: "सर्वर का पता", kn: "ಸರ್ವರ್ ವಿಳಾಸ" },
  connectHint: {
    en: "Your laptop's address on this Wi-Fi, e.g. http://192.168.1.42:8000",
    hi: "इस Wi-Fi पर आपके लैपटॉप का पता, जैसे http://192.168.1.42:8000",
    kn: "ಈ Wi-Fi ನಲ್ಲಿ ನಿಮ್ಮ ಲ್ಯಾಪ್‌ಟಾಪ್ ವಿಳಾಸ, ಉದಾ http://192.168.1.42:8000",
  },
  testConnection: { en: "Test connection", hi: "कनेक्शन जाँचें", kn: "ಸಂಪರ್ಕ ಪರೀಕ್ಷಿಸಿ" },
  checking: { en: "Checking…", hi: "जाँच हो रही है…", kn: "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…" },
  connected: { en: "Connected", hi: "जुड़ गया", kn: "ಸಂಪರ್ಕಗೊಂಡಿದೆ" },
  unreachable: { en: "Can't reach that address", hi: "यह पता नहीं मिल रहा", kn: "ಆ ವಿಳಾಸ ತಲುಪಲಾಗುತ್ತಿಲ್ಲ" },
  save: { en: "Save", hi: "सहेजें", kn: "ಉಳಿಸಿ" },
  close: { en: "Close", hi: "बंद करें", kn: "ಮುಚ್ಚಿ" },
  offlineDemo: { en: "Offline demo data", hi: "ऑफ़लाइन डेमो डेटा", kn: "ಆಫ್‌ಲೈನ್ ಡೆಮೊ ಡೇಟಾ" },
  offlineDemoSub: {
    en: "Run the whole flow with no server at all",
    hi: "बिना किसी सर्वर के पूरा फ़्लो चलाएँ",
    kn: "ಯಾವುದೇ ಸರ್ವರ್ ಇಲ್ಲದೆ ಸಂಪೂರ್ಣ ಹರಿವು ಚಲಾಯಿಸಿ",
  },
};

export function t(key, lang = "en") {
  const entry = STR[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}
