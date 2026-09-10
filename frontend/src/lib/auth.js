// Auth wrapper. Two modes, chosen automatically:
//
//  - CONFIGURED: VITE_FIREBASE_* env vars present → real Firebase Web SDK
//    (Google popup + phone-number OTP via reCAPTCHA). Firebase is dynamically
//    imported so an unconfigured build never pulls it into the main bundle and
//    the offline demo never depends on it.
//  - DEMO: no config (or Firebase fails) → a local "demo account" persisted in
//    localStorage. This is the stage-insurance path: a login/Firebase misconfig
//    can NEVER block the demo.
//
// The shape returned everywhere is a plain artisan object:
//   { uid, name, email, phone, photoURL, demo }

const LS_KEY = "karigar_account";

const CFG = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET,
};

/** True inside the Capacitor Android shell rather than a browser. */
function isNative() {
  return typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.();
}

/**
 * Is real sign-in available?
 *
 * Two different sources of truth, because the two platforms configure Firebase
 * in completely different places:
 *
 *  - WEB reads VITE_FIREBASE_* at build time, so we can check them here.
 *  - NATIVE reads google-services.json, which is compiled into the APK and is
 *    invisible to JS. There is nothing to inspect, so we report configured and
 *    let the attempt fail loudly if the file was missing at build time. An
 *    error the artisan can see beats silently pretending to sign them in,
 *    which is what the old code did.
 */
export function isFirebaseConfigured() {
  if (isNative()) return true;
  return Boolean(CFG.apiKey && CFG.authDomain && CFG.projectId && CFG.appId);
}

// ---- local persistence -----------------------------------------------------

export function loadStoredAccount() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAccount(acc) {
  try {
    if (acc) localStorage.setItem(LS_KEY, JSON.stringify(acc));
    else localStorage.removeItem(LS_KEY);
  } catch {}
  return acc;
}

// ---- demo account ----------------------------------------------------------

export function demoAccount() {
  return storeAccount({
    uid: "demo-" + (loadStoredAccount()?.uid?.replace("demo-", "") || Math.random().toString(36).slice(2, 10)),
    name: "Demo Artisan",
    email: "",
    phone: "",
    photoURL: "",
    demo: true,
  });
}

// ---- firebase (lazy) -------------------------------------------------------

let _fb = null; // { app, auth, mod }
async function fb() {
  if (_fb) return _fb;
  const [{ initializeApp }, authMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);
  const app = initializeApp(CFG);
  const auth = authMod.getAuth(app);
  _fb = { app, auth, mod: authMod };
  return _fb;
}

function normalize(user) {
  return storeAccount({
    uid: user.uid,
    name: user.displayName || user.phoneNumber || "Artisan",
    email: user.email || "",
    phone: user.phoneNumber || "",
    photoURL: user.photoURL || "",
    demo: false,
  });
}

/** Google sign-in (popup). Returns the artisan object. */
export async function signInWithGoogle() {
  // signInWithPopup CANNOT work on Android. Capacitor builds its WebView with
  // multiple-window support disabled, so the popup is swallowed with no error
  // and no window — the same reason target="_blank" links were dead. On device
  // we go through Google Play Services instead, via the native plugin.
  if (isNative()) return signInWithGoogleNative();

  const { auth, mod } = await fb();
  const provider = new mod.GoogleAuthProvider();
  const cred = await mod.signInWithPopup(auth, provider);
  return normalize(cred.user);
}

async function signInWithGoogleNative() {
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  const result = await FirebaseAuthentication.signInWithGoogle();

  // The plugin authenticates against the NATIVE Firebase SDK. Mirror that into
  // the JS SDK with the same credential so the rest of the app — onAuth,
  // signOut, anything reading auth.currentUser — sees one consistent user
  // rather than two SDKs disagreeing about who is signed in.
  const idToken = result?.credential?.idToken;
  if (idToken && isFirebaseWebConfigured()) {
    try {
      const { auth, mod } = await fb();
      const credential = mod.GoogleAuthProvider.credential(idToken);
      const cred = await mod.signInWithCredential(auth, credential);
      return normalize(cred.user);
    } catch {
      // Web config missing or mismatched — the native sign-in still succeeded,
      // so fall through and use what the plugin gave us.
    }
  }

  const u = result?.user || {};
  return storeAccount({
    uid: u.uid || "",
    name: u.displayName || u.email || "Artisan",
    email: u.email || "",
    phone: u.phoneNumber || "",
    photoURL: u.photoUrl || u.photoURL || "",
    demo: false,
  });
}

/** Web-SDK config specifically — native does not need it. */
function isFirebaseWebConfigured() {
  return Boolean(CFG.apiKey && CFG.authDomain && CFG.projectId && CFG.appId);
}

/**
 * Phone OTP — step 1. Sends the code, returns a confirmation handle whose
 * `.confirm(code)` resolves to the artisan object.
 * @param phone e.g. "+919999999999"
 * @param recaptchaContainerId id of a DOM node to host the invisible reCAPTCHA
 */
export async function startPhoneSignIn(phone, recaptchaContainerId) {
  // Phone OTP is still web-only. RecaptchaVerifier needs a real browser origin
  // and cannot render inside the Capacitor WebView, so on device this throws
  // rather than hanging on an invisible widget that will never appear. The
  // caller turns it into a visible message; Google sign-in is the native path.
  if (isNative()) throw new Error("phone-otp-not-available-on-device");

  const { auth, mod } = await fb();
  const verifier = new mod.RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
  const confirmation = await mod.signInWithPhoneNumber(auth, phone, verifier);
  return {
    confirm: async (code) => normalize((await confirmation.confirm(code)).user),
  };
}

/** Sign out of whichever mode is active and clear local state. */
export async function signOut() {
  // Sign out of BOTH SDKs. The native plugin holds its own session through
  // Play Services, so clearing only the JS side left the artisan still signed
  // in natively — the next "sign in" would silently reuse the old account.
  if (isNative()) {
    try {
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      await FirebaseAuthentication.signOut();
    } catch {
      /* plugin unavailable or already signed out */
    }
  }
  try {
    if (_fb) await _fb.mod.signOut(_fb.auth);
  } catch {}
  storeAccount(null);
}

/**
 * Subscribe to auth state. Fires once immediately with the current account
 * (stored demo account, or the Firebase user once it resolves).
 */
export function onAuth(cb) {
  const stored = loadStoredAccount();
  if (stored) cb(stored);

  if (!isFirebaseConfigured()) {
    if (!stored) cb(null);
    return () => {};
  }

  let unsub = () => {};
  fb()
    .then(({ auth, mod }) => {
      unsub = mod.onAuthStateChanged(auth, (user) => cb(user ? normalize(user) : loadStoredAccount()));
    })
    .catch(() => cb(stored)); // Firebase failed to load → keep stored/demo
  return () => unsub();
}
