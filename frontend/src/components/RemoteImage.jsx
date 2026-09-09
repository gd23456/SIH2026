import React, { useEffect, useState } from "react";

/**
 * An <img> that fetches its bytes first, then renders them from a blob: URL.
 *
 * Why not just <img src={httpUrl}>:
 *
 * In the Android app the WebView origin is https://localhost while the backend
 * is http://<laptop>:8000. Capacitor's allowMixedContent lets fetch/XHR through
 * — verified, /api/listings returns fine — but the WebView still blocks mixed
 * content loaded via <img src>:
 *
 *   Mixed Content: ... requested an insecure image
 *   'http://10.0.2.2:8000/api/listings/<id>/image'.
 *   This request has been blocked; the content must be served over HTTPS.
 *
 * So the QR code and every product thumbnail silently vanished on device while
 * working perfectly in a desktop browser. Fetching the bytes ourselves goes
 * down the allowed path, and a blob: URL is same-origin so <img> accepts it.
 *
 * Falls back to `fallback` if the fetch fails, so a dead image never leaves a
 * broken-image icon on screen during a demo.
 */
export default function RemoteImage({ src, alt, className, fallback = null, onFail }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setFailed(true);
      return undefined;
    }
    let alive = true;
    let created = null;
    setFailed(false);
    setObjectUrl(null);

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        created = URL.createObjectURL(blob);
        if (alive) setObjectUrl(created);
        else URL.revokeObjectURL(created);
      } catch {
        if (alive) {
          setFailed(true);
          onFail?.();
        }
      }
    })();

    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
    // onFail is intentionally not a dependency: callers pass inline closures.
  }, [src]);

  if (failed) return fallback;
  if (!objectUrl) return <div className={className} aria-busy="true" />;
  return <img src={objectUrl} alt={alt} className={className} />;
}
