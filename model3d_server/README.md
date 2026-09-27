# Karigar 3D worker

Turns an artisan's six capture photos into a 3D model (GLB) on your own
machine — no per-model API cost, and photos never leave your hardware.

- **Shape:** Tencent Hunyuan3D-2mv (turbo), conditioned on the FRONT, LEFT,
  BACK and RIGHT photos. Runs on an Apple Silicon Mac GPU (MPS), CUDA, or CPU.
- **Colour:** each surface is coloured from the photos that face it — all six,
  top and bottom included. (Hunyuan's own texture stage needs ~38 GB RAM and a
  CUDA rasteriser, so it is not used.)

The Karigar backend talks to it through `backend/app/services/model3d/local.py`.

## Requirements

- Apple Silicon Mac with **16 GB** unified memory (tested on an M4), or an
  NVIDIA GPU with 8 GB+.
- About **7 GB** of disk: 4.9 GB shape model, 0.4 GB decoder, 0.2 GB background
  remover, ~1.4 GB Python environment.

## Set up

```bash
cd model3d_server
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.txt
uv pip install --python .venv/bin/python --no-deps \
  "hy3dgen @ git+https://github.com/Tencent-Hunyuan/Hunyuan3D-2@f8db63096c8282cb27354314d896feba5ba6ff8a"

# Download only the one weights file we use (the repo folder also has a
# duplicate .ckpt copy — 5 GB you don't need):
.venv/bin/python - <<'EOF'
import os
from huggingface_hub import hf_hub_download
base = os.path.expanduser("~/.cache/hy3dgen/tencent/Hunyuan3D-2mv")
for f in ["config.yaml", "model.fp16.safetensors"]:
    hf_hub_download("tencent/Hunyuan3D-2mv", f"hunyuan3d-dit-v2-mv-turbo/{f}", local_dir=base)
EOF
```

## Run

```bash
MODEL3D_LOCAL_TOKEN=<a long random string> make model3d   # from the repo root; serves :8100
```

Then in `backend/.env`:

```
MODEL3D_PROVIDER=local
MODEL3D_LOCAL_URL=http://127.0.0.1:8100
MODEL3D_LOCAL_TOKEN=<the same string>
```

Try one reconstruction by hand: put `front.jpg right.jpg back.jpg left.jpg
top.jpg bottom.jpg` in a folder and run
`.venv/bin/python reconstruct.py <folder> out.glb`.

## Licence

Hunyuan3D 2.0 is under the **Tencent Hunyuan 3D 2.0 Community Licence** — see
[`NOTICE`](NOTICE). In short: commercial use is allowed (India included); it
does **not** apply in the EU, UK or South Korea; above 1 million monthly
users you need a separate licence from Tencent; you must say Tencent is not
affiliated with the product; outputs are yours.

The background remover is U²-Net (Apache-2.0). hy3dgen's default remover
(BRIA RMBG-2.0) is **non-commercial** and is deliberately not used.
