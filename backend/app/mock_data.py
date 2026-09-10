"""Realistic fallback data so the demo works with zero API keys / offline.

The mock is keyword-aware: it reads the artisan's transcript and produces a
plausible, well-formed listing. It is intentionally good enough to demo on
stage if the network or key fails.
"""
from __future__ import annotations

import re

# Hand-written translations, keyed by the craft's English title.
#
# This replaced a word-substitution table (one dict of ~17 English words per
# language, regex-swapped into the English string). That approach produced
# titles like "Hand-thrown Terracotta फूलदान" and left every description
# byte-identical to English, because the tables were capitalised while the
# descriptions are lowercase prose. Mock mode is what we demo on when the
# venue wifi dies, and "a listing in nine languages at once" is the claim
# being made on stage - so the text has to actually read as those languages.
#
# WARNING: these were not written by native speakers of every language.
# Hindi and Kannada have had the most eyes on them. Tamil, Telugu, Bengali,
# Marathi, Gujarati and Odia need a native-speaker pass before submission.
_TRANSLATIONS: dict[str, dict[str, dict[str, str]]] = {
    "Handwoven Bamboo Storage Basket": {
        "title": {
            "hi": "हस्तनिर्मित बाँस की भंडारण टोकरी",
            "kn": "ಕೈಯಿಂದ ಹೆಣೆದ ಬಿದಿರಿನ ಸಂಗ್ರಹ ಬುಟ್ಟಿ",
            "ta": "கையால் நெய்த மூங்கில் சேமிப்புக் கூடை",
            "te": "చేతితో అల్లిన వెదురు నిల్వ బుట్ట",
            "bn": "হাতে বোনা বাঁশের সংরক্ষণ ঝুড়ি",
            "mr": "हाताने विणलेली बांबूची साठवण टोपली",
            "gu": "હાથે વણેલી વાંસની સંગ્રહ ટોપલી",
            "or": "ହାତରେ ବୁଣା ବାଉଁଶ ସଂରକ୍ଷଣ ଝୁଡ଼ି",
        },
        "desc": {
            "hi": "कुशल ग्रामीण कारीगरों द्वारा प्राकृतिक बाँस से हाथ से बुनी गई एक सुंदर भंडारण टोकरी। हर टोकरी पीढ़ियों से चली आ रही पारंपरिक बुनाई तकनीकों से तीन दिनों में बनाई जाती है। टिकाऊ, हल्की और पूरी तरह जैव-अपघटनीय — पर्यावरण के प्रति सजग घरों के लिए एकदम सही।",
            "kn": "ನುರಿತ ಗ್ರಾಮೀಣ ಕುಶಲಕರ್ಮಿಗಳು ನೈಸರ್ಗಿಕ ಬಿದಿರಿನಿಂದ ಕೈಯಿಂದ ಹೆಣೆದ ಸುಂದರವಾದ ಸಂಗ್ರಹ ಬುಟ್ಟಿ. ಪ್ರತಿ ಬುಟ್ಟಿಯನ್ನೂ ತಲೆಮಾರುಗಳಿಂದ ಬಂದ ಸಾಂಪ್ರದಾಯಿಕ ಹೆಣಿಗೆ ತಂತ್ರಗಳಿಂದ ಮೂರು ದಿನಗಳಲ್ಲಿ ತಯಾರಿಸಲಾಗುತ್ತದೆ. ಬಾಳಿಕೆ ಬರುವ, ಹಗುರವಾದ ಮತ್ತು ಸಂಪೂರ್ಣ ಜೈವಿಕ ವಿಘಟನೀಯ — ಪರಿಸರ ಪ್ರಜ್ಞೆಯ ಮನೆಗಳಿಗೆ ಸೂಕ್ತ.",
            "ta": "திறமையான கிராமப்புற கைவினைஞர்கள் இயற்கை மூங்கிலால் கையால் நெய்த அழகிய சேமிப்புக் கூடை. ஒவ்வொரு கூடையும் தலைமுறைகளாக வந்த பாரம்பரிய நெசவு நுட்பங்களால் மூன்று நாட்களில் உருவாக்கப்படுகிறது. உறுதியானது, இலகுவானது, முற்றிலும் மட்கக்கூடியது — சுற்றுச்சூழல் நேசிக்கும் வீடுகளுக்கு ஏற்றது.",
            "te": "నైపుణ్యం గల గ్రామీణ కళాకారులు సహజ వెదురుతో చేతితో అల్లిన అందమైన నిల్వ బుట్ట. ప్రతి బుట్టను తరతరాలుగా వస్తున్న సంప్రదాయ అల్లిక పద్ధతులతో మూడు రోజుల్లో తయారు చేస్తారు. మన్నికైనది, తేలికైనది, పూర్తిగా జీవఅధోకరణం చెందేది — పర్యావరణ స్పృహ ఉన్న ఇళ్లకు సరైనది.",
            "bn": "দক্ষ গ্রামীণ কারিগরদের হাতে প্রাকৃতিক বাঁশ দিয়ে বোনা একটি সুন্দর সংরক্ষণ ঝুড়ি। প্রতিটি ঝুড়ি প্রজন্মের পর প্রজন্ম ধরে চলে আসা ঐতিহ্যবাহী বুননশৈলীতে তিন দিনে তৈরি হয়। টেকসই, হালকা এবং সম্পূর্ণ জৈব-অবচনশীল — পরিবেশ-সচেতন ঘরের জন্য উপযুক্ত।",
            "mr": "कुशल ग्रामीण कारागिरांनी नैसर्गिक बांबूपासून हाताने विणलेली सुंदर साठवण टोपली. प्रत्येक टोपली पिढ्यानपिढ्या चालत आलेल्या पारंपरिक विणकाम तंत्राने तीन दिवसांत तयार केली जाते. टिकाऊ, हलकी आणि पूर्णपणे जैवविघटनशील — पर्यावरणाबाबत जागरूक घरांसाठी योग्य.",
            "gu": "કુશળ ગ્રામીણ કારીગરોએ કુદરતી વાંસમાંથી હાથે વણેલી સુંદર સંગ્રહ ટોપલી. દરેક ટોપલી પેઢીઓથી ચાલી આવતી પરંપરાગત વણાટ પદ્ધતિથી ત્રણ દિવસમાં બને છે. ટકાઉ, હલકી અને સંપૂર્ણ જૈવ-વિઘટનશીલ — પર્યાવરણ પ્રત્યે સભાન ઘરો માટે યોગ્ય.",
            "or": "ଦକ୍ଷ ଗ୍ରାମୀଣ କାରିଗରମାନେ ପ୍ରାକୃତିକ ବାଉଁଶରୁ ହାତରେ ବୁଣିଥିବା ଏକ ସୁନ୍ଦର ସଂରକ୍ଷଣ ଝୁଡ଼ି। ପ୍ରତ୍ୟେକ ଝୁଡ଼ି ପିଢ଼ି ପରେ ପିଢ଼ି ଚାଲି ଆସିଥିବା ପାରମ୍ପରିକ ବୁଣା କୌଶଳରେ ତିନି ଦିନରେ ପ୍ରସ୍ତୁତ ହୁଏ। ଟିକାଉ, ହାଲୁକା ଏବଂ ସମ୍ପୂର୍ଣ୍ଣ ଜୈବ-ଅବକ୍ଷୟଶୀଳ — ପରିବେଶ ସଚେତନ ଘର ପାଇଁ ଉପଯୁକ୍ତ।",
        },
    },
    "Hand-thrown Terracotta Vase": {
        "title": {
            "hi": "हाथ से गढ़ा टेराकोटा फूलदान",
            "kn": "ಕೈಯಿಂದ ರೂಪಿಸಿದ ಟೆರಾಕೋಟಾ ಹೂದಾನಿ",
            "ta": "கையால் வடிவமைத்த டெரகோட்டா மலர் ஜாடி",
            "te": "చేతితో మలిచిన టెర్రకోట పూలకుండీ",
            "bn": "হাতে গড়া টেরাকোটা ফুলদানি",
            "mr": "हाताने घडवलेली टेराकोटा फुलदाणी",
            "gu": "હાથે ઘડેલી ટેરાકોટા ફૂલદાની",
            "or": "ହାତରେ ଗଢ଼ା ଟେରାକୋଟା ଫୁଲଦାନୀ",
        },
        "desc": {
            "hi": "पारंपरिक चाक पर गढ़ा और हाथ से पूरा किया गया एक सुंदर टेराकोटा फूलदान। प्राकृतिक मिट्टी के रंग और मैट मिट्टी जैसी बनावट हर टुकड़े को अनोखा बनाती है। एक कुशल कुम्हार द्वारा चार दिनों में तैयार।",
            "kn": "ಸಾಂಪ್ರದಾಯಿಕ ಕುಂಬಾರಿಕೆ ಚಕ್ರದಲ್ಲಿ ರೂಪಿಸಿ ಕೈಯಿಂದ ಪೂರ್ಣಗೊಳಿಸಿದ ಸೊಗಸಾದ ಟೆರಾಕೋಟಾ ಹೂದಾನಿ. ನೈಸರ್ಗಿಕ ಮಣ್ಣಿನ ಬಣ್ಣ ಮತ್ತು ಮ್ಯಾಟ್ ಮಣ್ಣಿನ ವಿನ್ಯಾಸ ಪ್ರತಿ ತುಣುಕನ್ನೂ ವಿಶಿಷ್ಟವಾಗಿಸುತ್ತದೆ. ನುರಿತ ಕುಂಬಾರರಿಂದ ನಾಲ್ಕು ದಿನಗಳಲ್ಲಿ ತಯಾರಿಸಲಾಗಿದೆ.",
            "ta": "பாரம்பரிய குயவன் சக்கரத்தில் வடிவமைக்கப்பட்டு கையால் முடிக்கப்பட்ட நேர்த்தியான டெரகோட்டா மலர் ஜாடி. இயற்கை களிமண் நிறங்களும் மென்மையான மண் அமைப்பும் ஒவ்வொரு துண்டையும் தனித்துவமாக்குகின்றன. திறமையான குயவரால் நான்கு நாட்களில் உருவாக்கப்பட்டது.",
            "te": "సంప్రదాయ కుమ్మరి చక్రంపై మలిచి చేతితో పూర్తి చేసిన అందమైన టెర్రకోట పూలకుండీ. సహజ మట్టి రంగులు, మ్యాట్ మట్టి ఆకృతి ప్రతి ముక్కను ప్రత్యేకంగా చేస్తాయి. నైపుణ్యం గల కుమ్మరి నాలుగు రోజుల్లో తయారు చేశారు.",
            "bn": "ঐতিহ্যবাহী কুমোরের চাকায় গড়া ও হাতে সম্পূর্ণ করা একটি মার্জিত টেরাকোটা ফুলদানি। প্রাকৃতিক মাটির রং ও ম্যাট মাটির বুনট প্রতিটি টুকরোকে অনন্য করে তোলে। একজন দক্ষ কুমোর চার দিনে তৈরি করেছেন।",
            "mr": "पारंपरिक कुंभाराच्या चाकावर घडवलेली आणि हाताने पूर्ण केलेली सुरेख टेराकोटा फुलदाणी. नैसर्गिक मातीचे रंग आणि मॅट मातीचा पोत प्रत्येक नमुना अनोखा बनवतो. कुशल कुंभाराने चार दिवसांत तयार केली.",
            "gu": "પરંપરાગત કુંભારના ચાકડા પર ઘડેલી અને હાથે પૂર્ણ કરેલી સુંદર ટેરાકોટા ફૂલદાની. કુદરતી માટીના રંગો અને મેટ માટીની બનાવટ દરેક નમૂનાને અનોખો બનાવે છે. કુશળ કુંભારે ચાર દિવસમાં તૈયાર કરી.",
            "or": "ପାରମ୍ପରିକ କୁମ୍ଭାର ଚକରେ ଗଢ଼ା ଓ ହାତରେ ସମ୍ପୂର୍ଣ୍ଣ କରାଯାଇଥିବା ଏକ ସୁନ୍ଦର ଟେରାକୋଟା ଫୁଲଦାନୀ। ପ୍ରାକୃତିକ ମାଟିର ରଙ୍ଗ ଓ ମ୍ୟାଟ ମାଟିର ବିନ୍ୟାସ ପ୍ରତ୍ୟେକ ଖଣ୍ଡକୁ ଅନନ୍ୟ କରେ। ଜଣେ ଦକ୍ଷ କୁମ୍ଭାର ଚାରି ଦିନରେ ପ୍ରସ୍ତୁତ କରିଛନ୍ତି।",
        },
    },
    "Handloom Mysore Silk Saree": {
        "title": {
            "hi": "हथकरघा मैसूर सिल्क साड़ी",
            "kn": "ಕೈಮಗ್ಗದ ಮೈಸೂರು ರೇಷ್ಮೆ ಸೀರೆ",
            "ta": "கைத்தறி மைசூர் பட்டுப் புடவை",
            "te": "చేనేత మైసూరు పట్టు చీర",
            "bn": "হ্যান্ডলুম মহীশূর সিল্ক শাড়ি",
            "mr": "हातमाग म्हैसूर सिल्क साडी",
            "gu": "હાથવણાટની મૈસૂર સિલ્ક સાડી",
            "or": "ହାତବୁଣା ମହୀଶୂର ସିଲ୍କ ଶାଢ଼ୀ",
        },
        "desc": {
            "hi": "शुद्ध शहतूत रेशम से बुनी गई, असली सोने की ज़री किनारी वाली एक भव्य हथकरघा साड़ी। मैसूर परंपरा में बारह दिनों में हाथ से बुनी गई, जो अपनी चमकदार फिनिश और टिकाऊ कारीगरी के लिए प्रसिद्ध है।",
            "kn": "ಶುದ್ಧ ಹಿಪ್ಪುನೇರಳೆ ರೇಷ್ಮೆಯಿಂದ ನೇಯ್ದ, ನೈಜ ಚಿನ್ನದ ಜರಿ ಅಂಚಿನ ಭವ್ಯವಾದ ಕೈಮಗ್ಗದ ಸೀರೆ. ಮೈಸೂರು ಸಂಪ್ರದಾಯದಲ್ಲಿ ಹನ್ನೆರಡು ದಿನಗಳಲ್ಲಿ ಕೈಯಿಂದ ನೇಯಲಾಗಿದೆ; ತನ್ನ ಹೊಳಪು ಮತ್ತು ಬಾಳಿಕೆ ಬರುವ ಕರಕುಶಲತೆಗೆ ಪ್ರಸಿದ್ಧ.",
            "ta": "தூய மல்பெரி பட்டால் நெய்யப்பட்ட, உண்மையான தங்க ஜரி விளிம்புகள் கொண்ட ஒரு அற்புதமான கைத்தறிப் புடவை. மைசூர் பாரம்பரியத்தில் பன்னிரண்டு நாட்களில் கையால் நெய்யப்பட்டது; அதன் பளபளப்பான பூர்த்திக்கும் நீடித்த கைவினைத்திறனுக்கும் புகழ்பெற்றது.",
            "te": "స్వచ్ఛమైన మల్బరీ పట్టుతో నేసిన, నిజమైన బంగారు జరీ అంచులతో కూడిన అద్భుతమైన చేనేత చీర. మైసూరు సంప్రదాయంలో పన్నెండు రోజుల్లో చేతితో నేశారు; దాని మెరుపు, మన్నికైన నైపుణ్యానికి ప్రసిద్ధి.",
            "bn": "বিশুদ্ধ মালবেরি সিল্কে বোনা, খাঁটি সোনার জরি পাড়ের একটি অপূর্ব হ্যান্ডলুম শাড়ি। মহীশূর ঐতিহ্যে বারো দিনে হাতে বোনা; এর উজ্জ্বল ফিনিশ ও দীর্ঘস্থায়ী কারুকার্যের জন্য বিখ্যাত।",
            "mr": "शुद्ध तुती रेशमापासून विणलेली, खऱ्या सोन्याच्या जरी काठाची एक भव्य हातमाग साडी. म्हैसूर परंपरेत बारा दिवसांत हाताने विणलेली; तिच्या तेजस्वी फिनिश आणि टिकाऊ कारागिरीसाठी प्रसिद्ध.",
            "gu": "શુદ્ધ શેતૂર રેશમમાંથી વણેલી, અસલી સોનાની જરી કિનારીવાળી એક ભવ્ય હાથવણાટની સાડી. મૈસૂર પરંપરામાં બાર દિવસમાં હાથે વણેલી; તેની ચમકદાર ફિનિશ અને ટકાઉ કારીગરી માટે પ્રખ્યાત.",
            "or": "ଶୁଦ୍ଧ ମଲବେରୀ ରେଶମରୁ ବୁଣା, ପ୍ରକୃତ ସୁନାର ଜରି ପାଢ଼ିଥିବା ଏକ ଭବ୍ୟ ହାତବୁଣା ଶାଢ଼ୀ। ମହୀଶୂର ପରମ୍ପରାରେ ବାର ଦିନରେ ହାତରେ ବୁଣାଯାଇଛି; ଏହାର ଉଜ୍ଜ୍ୱଳ ଫିନିସ୍ ଓ ଦୀର୍ଘସ୍ଥାୟୀ କାରୁକାର୍ଯ୍ୟ ପାଇଁ ପ୍ରସିଦ୍ଧ।",
        },
    },
    "Channapatna Wooden Spinning Top Set": {
        "title": {
            "hi": "चन्नपटना लकड़ी के लट्टू का सेट",
            "kn": "ಚನ್ನಪಟ್ಟಣದ ಮರದ ಬುಗುರಿ ಸೆಟ್",
            "ta": "சென்னப்பட்டணா மரப் பம்பரம் தொகுப்பு",
            "te": "చన్నపట్న చెక్క బొంగరాల సెట్",
            "bn": "চন্নপট্টনা কাঠের লাটিম সেট",
            "mr": "चन्नपटना लाकडी भोवऱ्यांचा संच",
            "gu": "ચન્નપટના લાકડાના ભમરડાનો સેટ",
            "or": "ଚନ୍ନପଟ୍ଟଣା କାଠ ବୁଲାଣି ସେଟ୍",
        },
        "desc": {
            "hi": "प्रसिद्ध चन्नपटना परंपरा में हाथ से खरादे गए लकड़ी के लट्टुओं का एक रंगीन सेट, जिन्हें सुरक्षित प्राकृतिक लाख के रंगों से रंगा गया है। गैर-विषैले और प्यार से तैयार — कर्नाटक की खिलौना-निर्माण विरासत का एक हिस्सा।",
            "kn": "ಪ್ರಸಿದ್ಧ ಚನ್ನಪಟ್ಟಣ ಸಂಪ್ರದಾಯದಲ್ಲಿ ಕೈಯಿಂದ ಕಡೆದ ಮರದ ಬುಗುರಿಗಳ ರೋಮಾಂಚಕ ಸೆಟ್, ಸುರಕ್ಷಿತ ನೈಸರ್ಗಿಕ ಅರಗಿನ ಬಣ್ಣಗಳಿಂದ ಬಣ್ಣಿಸಲಾಗಿದೆ. ವಿಷರಹಿತ ಮತ್ತು ಪ್ರೀತಿಯಿಂದ ಪೂರ್ಣಗೊಳಿಸಲಾಗಿದೆ — ಕರ್ನಾಟಕದ ಆಟಿಕೆ ತಯಾರಿಕೆಯ ಪರಂಪರೆಯ ತುಣುಕು.",
            "ta": "புகழ்பெற்ற சென்னப்பட்டணா பாரம்பரியத்தில் கையால் செதுக்கப்பட்ட மரப் பம்பரங்களின் வண்ணமயமான தொகுப்பு, பாதுகாப்பான இயற்கை அரக்குச் சாயங்களால் வண்ணமிடப்பட்டது. நச்சற்றது, அன்புடன் முடிக்கப்பட்டது — கர்நாடகத்தின் பொம்மை தயாரிப்பு பாரம்பரியத்தின் ஒரு பகுதி.",
            "te": "ప్రసిద్ధ చన్నపట్న సంప్రదాయంలో చేతితో మలిచిన చెక్క బొంగరాల రంగుల సెట్, సురక్షితమైన సహజ లక్క రంగులతో అద్దారు. విషరహితం, ప్రేమతో పూర్తి చేసినది — కర్ణాటక బొమ్మల తయారీ వారసత్వంలో ఒక భాగం.",
            "bn": "বিখ্যাত চন্নপট্টনা ঐতিহ্যে হাতে গড়া কাঠের লাটিমের একটি রঙিন সেট, নিরাপদ প্রাকৃতিক লাক্ষা রঙে রাঙানো। বিষমুক্ত ও যত্নে সম্পূর্ণ — কর্ণাটকের খেলনা তৈরির ঐতিহ্যের একটি অংশ।",
            "mr": "प्रसिद्ध चन्नपटना परंपरेत हाताने घडवलेल्या लाकडी भोवऱ्यांचा रंगीबेरंगी संच, सुरक्षित नैसर्गिक लाखेच्या रंगांनी रंगवलेला. विषारी नसलेला आणि प्रेमाने पूर्ण केलेला — कर्नाटकाच्या खेळणी बनवण्याच्या वारशाचा एक भाग.",
            "gu": "પ્રખ્યાત ચન્નપટના પરંપરામાં હાથે ઘડેલા લાકડાના ભમરડાનો રંગીન સેટ, સલામત કુદરતી લાખના રંગોથી રંગેલો. બિનઝેરી અને પ્રેમથી પૂર્ણ કરેલો — કર્ણાટકના રમકડાં બનાવવાના વારસાનો એક ભાગ.",
            "or": "ପ୍ରସିଦ୍ଧ ଚନ୍ନପଟ୍ଟଣା ପରମ୍ପରାରେ ହାତରେ ଗଢ଼ା କାଠ ବୁଲାଣିର ଏକ ରଙ୍ଗୀନ ସେଟ୍, ନିରାପଦ ପ୍ରାକୃତିକ ଲାହା ରଙ୍ଗରେ ରଙ୍ଗାଯାଇଛି। ବିଷମୁକ୍ତ ଏବଂ ଯତ୍ନରେ ସମ୍ପୂର୍ଣ୍ଣ — କର୍ଣ୍ଣାଟକର ଖେଳନା ନିର୍ମାଣ ପରମ୍ପରାର ଏକ ଅଂଶ।",
        },
    },
    "Handcrafted Artisan Product": {
        "title": {
            "hi": "हस्तनिर्मित कारीगर उत्पाद",
            "kn": "ಕೈಯಿಂದ ಮಾಡಿದ ಕರಕುಶಲ ಉತ್ಪನ್ನ",
            "ta": "கைவினைஞர் கைவேலைப் பொருள்",
            "te": "చేతితో తయారు చేసిన కళాకారుని ఉత్పత్తి",
            "bn": "হাতে তৈরি কারিগরি পণ্য",
            "mr": "हस्तनिर्मित कारागीर उत्पादन",
            "gu": "હસ્તનિર્મિત કારીગર ઉત્પાદન",
            "or": "ହସ୍ତନିର୍ମିତ କାରିଗର ଉତ୍ପାଦ",
        },
        "desc": {
            "hi": "एक कुशल कारीगर द्वारा पारंपरिक तकनीकों और प्राकृतिक सामग्री से बनाया गया अनोखा हस्तनिर्मित उत्पाद। हर वस्तु अनूठी है और पूरे ध्यान से बनाई गई है।",
            "kn": "ನುರಿತ ಕುಶಲಕರ್ಮಿಯೊಬ್ಬರು ಸಾಂಪ್ರದಾಯಿಕ ತಂತ್ರಗಳು ಮತ್ತು ನೈಸರ್ಗಿಕ ವಸ್ತುಗಳಿಂದ ತಯಾರಿಸಿದ ಅನನ್ಯ ಕೈಕೆಲಸದ ಉತ್ಪನ್ನ. ಪ್ರತಿ ವಸ್ತುವೂ ವಿಶಿಷ್ಟವಾಗಿದ್ದು ಕಾಳಜಿಯಿಂದ ತಯಾರಿಸಲಾಗಿದೆ.",
            "ta": "திறமையான கைவினைஞர் ஒருவர் பாரம்பரிய நுட்பங்களையும் இயற்கைப் பொருட்களையும் பயன்படுத்தி உருவாக்கிய தனித்துவமான கைவேலைப் பொருள். ஒவ்வொரு பொருளும் தனித்துவமானது, கவனத்துடன் செய்யப்பட்டது.",
            "te": "నైపుణ్యం గల కళాకారుడు సంప్రదాయ పద్ధతులు, సహజ పదార్థాలతో తయారు చేసిన ప్రత్యేకమైన చేతిపని ఉత్పత్తి. ప్రతి వస్తువూ ప్రత్యేకం, శ్రద్ధతో తయారు చేసినది.",
            "bn": "একজন দক্ষ কারিগর ঐতিহ্যবাহী কৌশল ও প্রাকৃতিক উপকরণ দিয়ে তৈরি করা এক অনন্য হস্তশিল্প। প্রতিটি জিনিস স্বতন্ত্র এবং যত্নসহকারে তৈরি।",
            "mr": "कुशल कारागिराने पारंपरिक तंत्रे आणि नैसर्गिक साहित्य वापरून बनवलेले एक अनोखे हस्तनिर्मित उत्पादन. प्रत्येक वस्तू वेगळी असून काळजीपूर्वक बनवलेली आहे.",
            "gu": "કુશળ કારીગરે પરંપરાગત પદ્ધતિઓ અને કુદરતી સામગ્રીથી બનાવેલું અનોખું હસ્તનિર્મિત ઉત્પાદન. દરેક વસ્તુ અનન્ય છે અને કાળજીપૂર્વક બનાવેલી છે.",
            "or": "ଜଣେ ଦକ୍ଷ କାରିଗର ପାରମ୍ପରିକ କୌଶଳ ଓ ପ୍ରାକୃତିକ ସାମଗ୍ରୀ ବ୍ୟବହାର କରି ତିଆରି କରିଥିବା ଏକ ଅନନ୍ୟ ହସ୍ତଶିଳ୍ପ। ପ୍ରତ୍ୟେକ ବସ୍ତୁ ସ୍ୱତନ୍ତ୍ର ଏବଂ ଯତ୍ନ ସହ ତିଆରି।",
        },
    },
}

# Language codes the mock can produce beyond English.
_LANGS = tuple(["hi", "kn", "ta", "te", "bn", "mr", "gu", "or"])

CRAFTS = [
    {
        "keys": ["bamboo", "basket", "cane", "बाँस", "टोकरी", "ಬಿದಿರು", "ಬುಟ್ಟಿ"],
        "title": "Handwoven Bamboo Storage Basket",
        "material": "Natural Bamboo",
        "category": "Home & Living / Storage",
        "craft_technique": "Traditional hand-weaving",
        "production_time": "3 days",
        "dimensions": "30 × 30 × 25 cm",
        "tags": ["handmade", "eco-friendly", "bamboo", "storage", "sustainable", "artisan"],
        "gi_candidate": None,
        "desc": "A beautifully handwoven storage basket crafted from natural bamboo by skilled rural artisans. Each basket is made over three days using traditional hand-weaving techniques passed down through generations. Durable, lightweight, and fully biodegradable — perfect for eco-conscious homes.",
        "base_price": 749,
    },
    {
        "keys": ["pottery", "clay", "terracotta", "vase", "pot", "मिट्टी", "ಮಣ್ಣಿನ"],
        "title": "Hand-thrown Terracotta Vase",
        "material": "Natural Terracotta Clay",
        "category": "Home & Living / Decor",
        "craft_technique": "Wheel-thrown & sun-dried",
        "production_time": "4 days",
        "dimensions": "25 cm height",
        "tags": ["handmade", "terracotta", "pottery", "home-decor", "eco-friendly"],
        "gi_candidate": None,
        "desc": "An elegant hand-thrown terracotta vase shaped on a traditional potter's wheel and finished by hand. Natural clay tones and a matte earthen texture make each piece unique. Crafted over four days by a master potter.",
        "base_price": 899,
    },
    {
        "keys": ["silk", "saree", "sari", "weave", "रेशम", "साड़ी", "ರೇಷ್ಮೆ", "ಸೀರೆ"],
        "title": "Handloom Mysore Silk Saree",
        "material": "Pure Mulberry Silk with Gold Zari",
        "category": "Clothing / Ethnic Wear",
        "craft_technique": "Traditional handloom weaving",
        "production_time": "12 days",
        "dimensions": "6.3 metres with blouse piece",
        "tags": ["handloom", "silk", "saree", "mysore-silk", "zari", "heritage"],
        "gi_candidate": "Mysore Silk (GI)",
        "desc": "A resplendent handloom saree woven from pure mulberry silk with genuine gold zari borders. Hand-woven over twelve days in the Mysore tradition, celebrated for its lustrous finish and enduring craftsmanship.",
        "base_price": 8499,
    },
    {
        "keys": ["wooden", "toy", "channapatna", "wood", "लकड़ी", "खिलौना", "ಮರದ", "ಆಟಿಕೆ"],
        "title": "Channapatna Wooden Spinning Top Set",
        "material": "Ivory-wood (Wrightia tinctoria) with natural lac colours",
        "category": "Toys & Games",
        "craft_technique": "Lacquer-turnery (Channapatna)",
        "production_time": "2 days",
        "dimensions": "Set of 4, 6–9 cm each",
        "tags": ["channapatna", "wooden-toys", "handmade", "non-toxic", "kids", "heritage"],
        "gi_candidate": "Channapatna Toys (GI)",
        "desc": "A vibrant set of hand-turned wooden spinning tops made in the famed Channapatna tradition, coloured with safe natural lac dyes. Non-toxic and lovingly finished — a piece of Karnataka's toy-making heritage.",
        "base_price": 649,
    },
]

_DEFAULT = {
    "title": "Handcrafted Artisan Product",
    "material": "Natural handcrafted materials",
    "category": "Handicrafts",
    "craft_technique": "Traditional handcraft",
    "production_time": "2 days",
    "dimensions": "Standard",
    "tags": ["handmade", "artisan", "handicraft", "traditional", "india"],
    "gi_candidate": None,
    "desc": "A one-of-a-kind handcrafted piece made by a skilled artisan using traditional techniques and natural materials. Every item is unique and made with care.",
    "base_price": 599,
}


def match_craft(transcript: str) -> dict:
    t = (transcript or "").lower()
    for c in CRAFTS:
        if any(k in t for k in c["keys"]):
            return c
    return _DEFAULT


def mock_listing(transcript: str, language: str = "en") -> dict:
    c = match_craft(transcript)
    title = c["title"]
    desc = c["desc"]

    # en/hi/kn always; plus the artisan's own language when it's one of the
    # extra six, so the chosen language never silently falls back to English.
    langs = ["hi", "kn"]
    if language in _LANGS and language not in langs:
        langs.append(language)

    # Fall back to the English string rather than emitting an empty one: a
    # craft added to CRAFTS without a matching _TRANSLATIONS entry should read
    # as untranslated, not as a blank listing.
    tr = _TRANSLATIONS.get(title, {})
    title_map = {"en": title}
    desc_map = {"en": desc}
    for code in langs:
        title_map[code] = tr.get("title", {}).get(code) or title
        desc_map[code] = tr.get("desc", {}).get(code) or desc

    return {
        "title": title_map,
        "description": desc_map,
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
