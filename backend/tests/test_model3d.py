"""3D pipeline: intake validation, job lifecycle, access control, the Meshy
adapter's HTTP contract, and storefront integration.

The worker is driven explicitly (process_pending_once) so every state
transition is observable and deterministic.
"""
from __future__ import annotations

import io
import json
import struct
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session

from app.config import get_settings
from app.db.models import ModelJob
from app.db.session import get_engine
from app.main import app
from app.services import model3d
from app.services.model3d import jobs
from app.services.model3d.base import ANGLES, ProviderError, validate_glb
from app.services.model3d.meshy import MeshyProvider
from app.services.model3d.mock import MockProvider, build_box_glb

client = TestClient(app)


def _jpeg(colour=(150, 100, 60), size=(640, 480), exif: bytes | None = None) -> bytes:
    buf = io.BytesIO()
    im = Image.new("RGB", size, colour)
    if exif:
        im.save(buf, format="JPEG", exif=exif)
    else:
        im.save(buf, format="JPEG")
    return buf.getvalue()


def _six(**overrides) -> dict:
    files = {}
    for i, a in enumerate(ANGLES):
        data = overrides.get(a, _jpeg((40 * i % 255, 90, 160)))
        files[a] = (f"{a}.jpg", data, "image/jpeg")
    return files


def _create(client_id: str = "", uid: str = "artisan-3d") -> dict:
    r = client.post("/api/models", files=_six(), data={"uid": uid, "client_id": client_id})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture(autouse=True)
def _fresh_mock_provider():
    model3d.set_provider_for_tests(MockProvider())
    yield
    model3d.set_provider_for_tests(MockProvider())


# --- intake -----------------------------------------------------------------


def test_create_requires_all_six_views():
    files = _six()
    files.pop("bottom")
    r = client.post("/api/models", files=files)
    assert r.status_code == 422  # FastAPI: required file missing


def test_create_rejects_non_images_whatever_the_content_type():
    files = _six(top=b"<?php echo 'not an image'; ?>")
    r = client.post("/api/models", files=files)
    assert r.status_code == 400
    assert "image" in r.json()["detail"]


def test_create_rejects_tiny_images():
    r = client.post("/api/models", files=_six(left=_jpeg(size=(80, 80))))
    assert r.status_code == 400


def test_views_are_reencoded_and_exif_stripped():
    exif = Image.Exif()
    exif[0x010F] = "SecretCam"  # Make
    job = _create()
    stored = jobs.view_path(job["job_id"], "front").read_bytes()
    assert Image.open(io.BytesIO(stored)).format == "JPEG"

    # and a photo that DID carry EXIF comes back without it
    r = client.post("/api/models", files=_six(front=_jpeg(exif=exif.tobytes())))
    stored = jobs.view_path(r.json()["job_id"], "front").read_bytes()
    assert not Image.open(io.BytesIO(stored)).getexif()


def test_create_returns_token_once_and_is_idempotent_per_device():
    first = _create(client_id="device-abc-1")
    assert first["token"] and first["status"] == "queued"
    again = client.post("/api/models", files=_six(), data={"uid": "artisan-3d", "client_id": "device-abc-1"})
    assert again.status_code == 201
    assert again.json()["job_id"] == first["job_id"]
    assert again.json()["token"] is None  # never re-disclosed


# --- access control ---------------------------------------------------------


def test_status_needs_the_token():
    job = _create()
    assert client.get(f"/api/models/{job['job_id']}").status_code == 404
    assert client.get(f"/api/models/{job['job_id']}", headers={"X-Model-Token": "wrong"}).status_code == 404
    ok = client.get(f"/api/models/{job['job_id']}", headers={"X-Model-Token": job["token"]})
    assert ok.status_code == 200 and ok.json()["views"] == list(ANGLES)


def test_unpublished_views_are_private():
    job = _create()
    url = f"/api/models/{job['job_id']}/views/front.jpg"
    assert client.get(url).status_code == 404
    assert client.get(url, headers={"X-Model-Token": job["token"]}).status_code == 200


def test_path_traversal_ids_are_rejected():
    assert client.get("/api/models/..%2F..%2Fetc/model.glb").status_code == 404
    assert client.get("/api/models/abc/views/../../x.jpg").status_code == 404


# --- lifecycle ----------------------------------------------------------------


def _status(job) -> dict:
    return client.get(f"/api/models/{job['job_id']}", headers={"X-Model-Token": job["token"]}).json()


def test_job_goes_queued_processing_ready_and_serves_a_real_glb():
    job = _create()
    jobs.process_pending_once()
    assert _status(job)["status"] == "processing"
    jobs.process_pending_once()  # mock: first poll still building
    jobs.process_pending_once()
    st = _status(job)
    assert st["status"] == "ready" and st["model_url"]
    assert st["is_test_model"] is True  # dev provider is always labelled

    glb = client.get(f"/api/models/{job['job_id']}/model.glb")
    assert glb.status_code == 200
    assert glb.headers["content-type"] == "model/gltf-binary"
    assert "immutable" in glb.headers["cache-control"]
    magic, version, length = struct.unpack("<4sII", glb.content[:12])
    assert magic == b"glTF" and version == 2 and length == len(glb.content)


def test_model_is_404_until_ready():
    job = _create()
    assert client.get(f"/api/models/{job['job_id']}/model.glb").status_code == 404


def test_provider_failure_is_reported_and_retry_requeues():
    model3d.set_provider_for_tests(MockProvider(fail=True))
    job = _create()
    for _ in range(3):
        jobs.process_pending_once()
    st = _status(job)
    assert st["status"] == "failed" and st["error"]
    assert st["model_url"] is None  # never a fake model on failure

    model3d.set_provider_for_tests(MockProvider())
    r = client.post(f"/api/models/{job['job_id']}/retry", headers={"X-Model-Token": job["token"]})
    assert r.json()["status"] == "queued"
    for _ in range(3):
        jobs.process_pending_once()
    assert _status(job)["status"] == "ready"


def test_retryable_submit_errors_are_retried_then_fail():
    class Flaky(MockProvider):
        def submit(self, views):
            raise ProviderError("503", retryable=True)

    model3d.set_provider_for_tests(Flaky())
    job = _create()
    for _ in range(jobs.MAX_SUBMIT_ATTEMPTS - 1):
        jobs.process_pending_once()
        assert _status(job)["status"] == "queued"
    jobs.process_pending_once()
    assert _status(job)["status"] == "failed"


def test_processing_jobs_time_out():
    job = _create()
    jobs.process_pending_once()
    with Session(get_engine()) as s:
        row = s.get(ModelJob, job["job_id"])
        row.submitted_at = datetime.now(UTC) - timedelta(seconds=get_settings().MODEL3D_TIMEOUT_S + 5)
        s.add(row)
        s.commit()
    jobs.process_pending_once()
    st = _status(job)
    assert st["status"] == "failed" and "timed out" in st["error"]


def test_disabled_provider_marks_jobs_unavailable(monkeypatch):
    monkeypatch.setattr(model3d, "provider_name", lambda: "disabled")
    monkeypatch.setattr(jobs, "provider_name", lambda: "disabled")
    job = _create()
    assert job["status"] == "unavailable"


def test_production_refuses_the_dev_provider(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "APP_ENV", "production")
    monkeypatch.setattr(s, "MODEL3D_PROVIDER", "mock")
    assert model3d.provider_name() == "disabled"


def test_blank_provider_defaults_to_meshy_only_with_a_key(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "MODEL3D_PROVIDER", "")
    monkeypatch.setattr(s, "MESHY_API_KEY", "")
    assert model3d.provider_name() == "disabled"
    monkeypatch.setattr(s, "MESHY_API_KEY", "msy_x")
    assert model3d.provider_name() == "meshy"


def test_retention_cleanup_removes_unpublished_jobs_only():
    job = _create()
    with Session(get_engine()) as s:
        row = s.get(ModelJob, job["job_id"])
        row.created_at = datetime.now(UTC) - timedelta(days=get_settings().MODEL3D_RETENTION_DAYS + 1)
        s.add(row)
        s.commit()
    jobs.cleanup_expired()
    assert not jobs.job_dir(job["job_id"]).exists()
    assert _status(job)["status"] == "expired"


# --- publish + storefront ---------------------------------------------------------


def _publish(job: dict | None, token: str | None = None, uid: str = "artisan-3d", edited=None):
    listing = client.post("/api/generate-listing", json={"transcript": "channapatna toy", "language": "en"}).json()
    body = {
        "listing": listing, "price": 900, "artisan_name": "Asha", "artisan_uid": uid,
        "model_job_id": job["job_id"] if job else None,
        "model_token": token if token is not None else (job["token"] if job else None),
        "edited_fields": edited or [],
    }
    r = client.post("/api/publish", json=body)
    assert r.status_code == 200, r.text
    return r.json()["listing_id"]


def test_publish_attaches_model_and_storefront_offers_3d():
    job = _create()
    for _ in range(3):
        jobs.process_pending_once()
    lid = _publish(job, edited=["description", "not-a-field"])

    page = client.get(f"/p/{lid}").text
    assert "View in 3D" in page
    assert f"/api/models/{job['job_id']}/model.glb" in page
    assert "Test model" in page  # dev provider labelled for buyers too
    assert "Written by the artisan with AI assistance" in page
    assert 'property="og:title"' in page

    # views become public once published (the storefront gallery)
    assert client.get(f"/api/models/{job['job_id']}/views/back.jpg").status_code == 200

    rows = client.get("/api/listings", params={"uid": "artisan-3d"}).json()
    row = next(r for r in rows if r["listing_id"] == lid)
    assert row["model_status"] == "ready" and row["model_url"].endswith("/model.glb")


def test_publish_ignores_a_model_without_its_token():
    job = _create()
    lid = _publish(job, token="guessed")
    page = client.get(f"/p/{lid}").text
    assert "View in 3D" not in page


def test_storefront_hides_3d_until_the_model_is_ready():
    job = _create()
    lid = _publish(job)
    assert "View in 3D" not in client.get(f"/p/{lid}").text
    for _ in range(3):
        jobs.process_pending_once()
    assert "View in 3D" in client.get(f"/p/{lid}").text  # finished after publish


def test_deleting_the_listing_deletes_its_photos_and_model():
    uid = "artisan-del-3d"
    client.post("/api/artisan", json={"uid": uid, "name": "Del"})
    job = _create(uid=uid)
    for _ in range(3):
        jobs.process_pending_once()
    lid = _publish(job, uid=uid)
    assert client.delete(f"/api/listings/{lid}", params={"uid": uid}).status_code == 204
    assert not jobs.job_dir(job["job_id"]).exists()
    assert client.get(f"/api/models/{job['job_id']}/model.glb").status_code == 404


def test_health_reports_model3d_provider():
    assert client.get("/api/health").json()["integrations"]["model3d"] in ("mock", "meshy", "disabled")


# --- Meshy adapter: real request/response handling, no network ----------------------


def _views() -> dict:
    return {a: _jpeg() for a in ANGLES}


def test_meshy_submit_sends_four_side_views_as_data_uris_with_bearer_auth():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["url"] = str(req.url)
        seen["auth"] = req.headers["authorization"]
        seen["body"] = json.loads(req.content)
        return httpx.Response(202, json={"result": "task-123"})

    p = MeshyProvider("msy_key", base_url="https://api.test/openapi/v1", transport=httpx.MockTransport(handler))
    assert p.submit(_views()) == "task-123"
    assert seen["url"] == "https://api.test/openapi/v1/multi-image-to-3d"
    assert seen["auth"] == "Bearer msy_key"
    urls = seen["body"]["image_urls"]
    assert len(urls) == 4 and all(u.startswith("data:image/jpeg;base64,") for u in urls)
    assert seen["body"]["target_formats"] == ["glb"]


def test_meshy_poll_maps_states_and_downloads_glb():
    glb = build_box_glb(_views())

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.host == "assets.test":
            assert "authorization" not in req.headers  # never leak our key to asset hosts
            return httpx.Response(200, content=glb)
        return httpx.Response(200, json={
            "id": "t", "status": "SUCCEEDED", "progress": 100,
            "model_urls": {"glb": "https://assets.test/model.glb?Expires=1"},
            "task_error": {"message": ""},
        })

    p = MeshyProvider("k", base_url="https://api.test/v1", transport=httpx.MockTransport(handler))
    st = p.poll("t")
    assert st.state == "succeeded" and st.glb_url
    assert p.fetch_glb(st)[:4] == b"glTF"


def test_meshy_failed_task_carries_the_error():
    def handler(req):
        return httpx.Response(200, json={"status": "FAILED", "progress": 0, "task_error": {"message": "bad input"}})

    p = MeshyProvider("k", base_url="https://api.test/v1", transport=httpx.MockTransport(handler))
    st = p.poll("t")
    assert st.state == "failed" and st.error == "bad input"


def test_meshy_rate_limit_is_retryable_but_auth_errors_are_not():
    def limited(req):
        return httpx.Response(429, json={"message": "slow down"})

    def unauthorised(req):
        return httpx.Response(401, json={"message": "Invalid API key"})

    with pytest.raises(ProviderError) as e:
        MeshyProvider("k", base_url="https://api.test/v1", transport=httpx.MockTransport(limited)).submit(_views())
    assert e.value.retryable
    with pytest.raises(ProviderError) as e:
        MeshyProvider("k", base_url="https://api.test/v1", transport=httpx.MockTransport(unauthorised)).submit(_views())
    assert not e.value.retryable


def test_non_glb_downloads_are_refused():
    with pytest.raises(ProviderError):
        validate_glb(b"<html>not a model</html>")


def test_a_model_can_be_attached_after_publishing():
    uid = "artisan-late-3d"
    client.post("/api/artisan", json={"uid": uid, "name": "Late"})
    lid = _publish(None, uid=uid)  # went live before its photos uploaded
    job = _create(uid=uid)
    for _ in range(3):
        jobs.process_pending_once()

    url = f"/api/listings/{lid}/model"
    # wrong owner / wrong token are both refused
    assert client.post(url, data={"job_id": job["job_id"], "uid": "someone-else"},
                       headers={"X-Model-Token": job["token"]}).status_code == 404
    assert client.post(url, data={"job_id": job["job_id"], "uid": uid},
                       headers={"X-Model-Token": "nope"}).status_code == 404

    r = client.post(url, data={"job_id": job["job_id"], "uid": uid}, headers={"X-Model-Token": job["token"]})
    assert r.status_code == 200 and r.json()["status"] == "ready"
    assert "View in 3D" in client.get(f"/p/{lid}").text


# --- Local (self-hosted Hunyuan3D) adapter ---------------------------------------


def test_local_provider_submits_all_six_views_with_bearer_token():
    from app.services.model3d.local import LocalProvider

    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["auth"] = req.headers.get("authorization")
        seen["body"] = req.content
        return httpx.Response(200, json={"id": "abc123", "model_version": "hunyuan3d-test"})

    p = LocalProvider("http://gpu.local:8100", token="s3cret", transport=httpx.MockTransport(handler))
    assert p.submit(_views()) == "abc123"
    assert seen["auth"] == "Bearer s3cret"
    for a in ANGLES:  # unlike Meshy, the local worker gets every view
        assert f'name="{a}"'.encode() in seen["body"]
    assert p.model_version == "hunyuan3d-test"


def test_local_provider_poll_download_and_lost_jobs():
    from app.services.model3d.local import LocalProvider

    glb = build_box_glb(_views())

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/jobs/done":
            return httpx.Response(200, json={"status": "succeeded", "progress": 100, "error": ""})
        if req.url.path == "/jobs/done/model.glb":
            return httpx.Response(200, content=glb)
        if req.url.path == "/jobs/busy":
            return httpx.Response(200, json={"status": "processing", "progress": 40, "error": ""})
        return httpx.Response(404, json={"detail": "no such job"})

    p = LocalProvider("http://gpu.local:8100", transport=httpx.MockTransport(handler))
    assert p.poll("busy").state == "processing"
    st = p.poll("done")
    assert st.state == "succeeded" and p.fetch_glb(st)[:4] == b"glTF"
    with pytest.raises(ProviderError) as e:
        p.poll("gone")  # worker restarted and forgot the job
    assert not e.value.retryable


def test_local_provider_unreachable_worker_is_retryable():
    from app.services.model3d.local import LocalProvider

    def down(req):
        raise httpx.ConnectError("refused")

    with pytest.raises(ProviderError) as e:
        LocalProvider("http://gpu.local:8100", transport=httpx.MockTransport(down)).submit(_views())
    assert e.value.retryable


def test_local_provider_needs_a_url(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "MODEL3D_PROVIDER", "local")
    monkeypatch.setattr(s, "MODEL3D_LOCAL_URL", "")
    assert model3d.provider_name() == "disabled"
    monkeypatch.setattr(s, "MODEL3D_LOCAL_URL", "http://127.0.0.1:8100")
    assert model3d.provider_name() == "local"
