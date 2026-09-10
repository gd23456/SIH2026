# Demo photo attributions

These category photos were sourced by `frontend/scripts/fetch_demo_photos.py`
via the **Openverse** API and **Wikimedia Commons**, filtered to
Creative-Commons **commercial-use** licenses, then centre-cropped to a square
~1000px JPEG. They are demo assets — swap any file freely (drop a new
`<slug>.jpg` here, or re-run the script for fresh picks + exact per-image
credits).

| File | Source | License |
|---|---|---|
| `bamboo.jpg` | Wikimedia Commons (bamboo weaving) | Creative Commons |
| `terracotta.jpg` | Openverse (glazed pottery vase) | CC, commercial-use |
| `silk.jpg` | Wikimedia Commons (handloom weaving) | Creative Commons |
| `channapatna.jpg` | Openverse (handmade wooden toys) | CC, commercial-use |
| `jute.jpg` | Openverse (jute tote bag) | CC, commercial-use |
| `brass.jpg` | Openverse (brass metal craft) | CC, commercial-use |
| `craft.jpg` | Openverse (Indian handicraft) | CC, commercial-use |

Re-running `python frontend/scripts/fetch_demo_photos.py` regenerates this file
with the exact creator + license + source URL for each image it fetches.
