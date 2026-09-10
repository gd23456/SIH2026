import React, { useState } from "react";
import RemoteImage from "./RemoteImage";
import { categoryFor, demoPhotoUrl, placeholderFor } from "../lib/productImage";

// Always a photograph, never an emoji. Layers three sources:
//   1. the artisan's real backend image (has_image + image_url) via RemoteImage
//   2. a category demo photo /demo/<slug>.jpg the team drops in
//   3. a designed gradient placeholder (data URI) — the final, never-broken image
export default function ProductImage({ row, className = "" }) {
  const cat = categoryFor(row);
  const placeholder = placeholderFor(cat);
  const [demoSrc, setDemoSrc] = useState(demoPhotoUrl(cat));

  const fallback = (
    <img
      src={demoSrc}
      alt={row?.title?.en || cat.label}
      className={className}
      onError={(e) => {
        // /demo/<slug>.jpg not supplied → swap to the generated placeholder once.
        if (demoSrc !== placeholder) setDemoSrc(placeholder);
        else e.currentTarget.onerror = null;
      }}
    />
  );

  if (row?.has_image && row?.image_url) {
    return (
      <RemoteImage src={row.image_url} alt={row?.title?.en || cat.label} className={className} fallback={fallback} />
    );
  }
  return fallback;
}
