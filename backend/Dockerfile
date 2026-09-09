# ---------------------------------------------------------------------------
# Karigar AI — backend
#
# This exists mainly as an ESCAPE HATCH: if a teammate can't get Python 3.11
# working on their machine, they can run the backend here instead of losing
# an evening to pip.
#
#   docker compose up backend
# ---------------------------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# libgl/libglib are needed by Pillow + onnxruntime image ops
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Core deps first — this layer caches well and must never fail
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Heavy vision deps are OPTIONAL. Build with --build-arg WITH_AI=1 to include
# them; the image is ~1GB larger and the app works fine without them.
ARG WITH_AI=0
COPY requirements-ai.txt .
RUN if [ "$WITH_AI" = "1" ]; then pip install --no-cache-dir -r requirements-ai.txt; fi

COPY app ./app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

# 0.0.0.0 so the container is reachable from the host and the LAN
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
