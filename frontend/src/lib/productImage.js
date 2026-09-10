// Product imagery resolver. Grids and cards should show a photograph, never an
// emoji. Priority per item:
//   1. the artisan's real uploaded/enhanced photo (backend image_url)
//   2. a royalty-free category photo the team drops in /public/demo/<slug>.jpg
//   3. a tasteful generated placeholder (warm gradient, no emoji, no cartoon)

const CATEGORIES = [
  { slug: "silk", keys: ["silk", "saree", "sari", "handloom", "zari"], label: "Handloom Silk", from: "#8B5E3C", to: "#c99f74" },
  { slug: "channapatna", keys: ["channapatna", "toy", "wooden toy", "lacquer"], label: "Wooden Toys", from: "#a4652f", to: "#e8a13a" },
  { slug: "bamboo", keys: ["bamboo", "cane", "basket", "wicker", "storage"], label: "Bamboo & Cane", from: "#6d7d3f", to: "#b9b04e" },
  { slug: "terracotta", keys: ["terracotta", "pottery", "clay", "vase", "decor", "ceramic"], label: "Terracotta", from: "#9c4722", to: "#cd7f4e" },
  { slug: "jute", keys: ["jute", "bag", "tote", "sack"], label: "Jute", from: "#7a6a3a", to: "#b7a15e" },
  { slug: "brass", keys: ["brass", "bidri", "dhokra", "metal", "bronze"], label: "Brassware", from: "#8a6d1f", to: "#d8b34a" },
];
const DEFAULT = { slug: "craft", label: "Handmade", from: "#874f27", to: "#c99f74" };

export function categoryFor(row = {}) {
  const hay = [row.title?.en, row.title?.hi, row.category, row.material, row.craft_technique]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return CATEGORIES.find((c) => c.keys.some((k) => hay.includes(k))) || DEFAULT;
}

/** Royalty-free category photo the team supplies; may 404 until dropped in. */
export function demoPhotoUrl(cat) {
  return `/demo/${cat.slug}.jpg`;
}

/** A designed, non-emoji placeholder as a data: URI (warm gradient + label). */
export function placeholderFor(cat) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${cat.from}"/>
        <stop offset="1" stop-color="${cat.to}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <g fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="14">
      <circle cx="200" cy="170" r="86"/>
      <circle cx="200" cy="170" r="126"/>
    </g>
    <text x="200" y="330" text-anchor="middle" font-family="Poppins,system-ui,sans-serif"
      font-size="30" font-weight="700" fill="#ffffff" fill-opacity="0.92">${cat.label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
