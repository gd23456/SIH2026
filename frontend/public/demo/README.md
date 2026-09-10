# Demo product photos

Drop royalty-free craft photos here, named by category slug, and the product
grids + buyer view will use them automatically (no code change needed):

| File | Craft |
|---|---|
| `bamboo.jpg` | Bamboo / cane basket |
| `terracotta.jpg` | Terracotta / pottery vase |
| `silk.jpg` | Mysore / handloom silk saree |
| `channapatna.jpg` | Channapatna wooden toys |
| `jute.jpg` | Jute bag |
| `brass.jpg` | Brassware |
| `craft.jpg` | Generic handmade (fallback category) |

Square-ish JPGs (≥ 800×800) look best. Until you drop a file, a tasteful
generated gradient placeholder is shown instead of any emoji.

Sourcing: use images you have the right to use (e.g. Unsplash / Pexels
"handmade India" / "Indian handicraft", or your own product photos).

`backend/scripts/seed_demo.py` also picks these up: if the matching file exists
here, the seeded listing is stored with that photo so the storefront looks
premium too.
