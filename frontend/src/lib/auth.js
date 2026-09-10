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
// On ANDROID the Web SDK's signInWithPopup cannot work: it opens an OAuth popup
// and waits for a callback the WebView never delivers, and Google will not
// redirect back to Capacitor's https://localhost origin. So native runs through
// @capacitor-firebase/authentication instead, which uses the real Google
// Sign-In and Play Services SMS flows and reads its config from
// android/app/google-services.json rather than the VITE_FIREBASE_* vars.
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

function isNative() {
  return Boolean(typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.());
}

let _native = null;
async function nativeAuth() {
  // Wrapped in an object on purpose. A Capacitor plugin proxy answers ANY
  // property access, including `then`, so returning it straight out of an async
  // function makes JS treat it as a thenable and call `.then()` on it - which
  // Capacitor forwards to native and fails with
  //   "FirebaseAuthentication.then()" is not implemented on android
  if (!_native) {
    const mod = await import("@capacitor-firebase/authentication");
    _native = { FA: mod.FirebaseAuthentication };
  }
  return _native;
}

export function isFirebaseConfigured() {
  // Native reads google-services.json at build time, so the VITE_ vars are not
  // required there - requiring them would drop the APK into demo mode even
  // with Firebase correctly wired.
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

/** Google sign-in. Native uses real Google Sign-In; web uses the popup. */
export async function signInWithGoogle() {
  if (isNative()) {
    const { FA } = await nativeAuth();
    const { user } = await FA.signInWithGoogle();
    if (!user) throw new Error("google-signin-cancelled");
    return normalize(user);
  }
  const { auth, mod } = await fb();
  const provider = new mod.GoogleAuthProvider();
  const cred = await mod.signInWithPopup(auth, provider);
  return normalize(cred.user);
}

/**
 * Phone OTP — step 1. Sends the code, returns a confirmation handle whose
 * `.confirm(code)` resolves to the artisan object.
 * @param phone e.g. "+919999999999"
 * @param recaptchaContainerId id of a DOM node to host the invisible reCAPTCHA
 */
export async function startPhoneSignIn(phone, recaptchaContainerId) {
  if (isNative()) {
    // Play Services handles verification natively - no reCAPTCHA widget, which
    // would hit the same WebView limitation as the Google popup. Android can
    // also auto-verify, in which case a user comes back immediately and there
    // is no code to enter.
    const { FA } = await nativeAuth();
    const res = await FA.signInWithPhoneNumber({ phoneNumber: phone });
    if (res?.user) {
      const acc = normalize(res.user);
      return { confirm: async () => acc, autoVerified: true };
    }
    const verificationId = res?.verificationId;
    if (!verificationId) throw new Error("phone-verification-unavailable");
    return {
      confirm: async (code) => {
        const out = await FA.confirmVerificationCode({
          verificationId,
          verificationCode: code,
        });
        if (!out?.user) throw new Error("phone-verification-failed");
        return normalize(out.user);
      },
    };
  }

  const { auth, mod } = await fb();
  const verifier = new mod.RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
  const confirmation = await mod.signInWithPhoneNumber(auth, phone, verifier);
  return {
    confirm: async (code) => normalize((await confirmation.confirm(code)).user),
  };
}

/** Sign out of whichever mode is active and clear local state. */
export async function signOut() {
  try {
    if (isNative()) {
      const { FA } = await nativeAuth();
      await FA.signOut();
    } else if (isFirebaseConfigured() && _fb) {
      await _fb.mod.signOut(_fb.auth);
    }
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
