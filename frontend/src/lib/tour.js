// First-run tour flag. Per device, in localStorage — a convenience, never
// state that matters: if storage is blocked (private window, cleared data) the
// worst case is seeing a skippable tour twice.

const KEY = "karigar_tour_seen";

export function tourSeen() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // can't remember it — don't nag on every launch either
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
}
