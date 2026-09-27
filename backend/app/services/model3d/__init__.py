"""3D reconstruction: provider selection.

    capture (6 views) -> POST /api/models -> ModelJob(queued)
      -> worker: provider.submit -> poll -> fetch GLB -> storage -> ModelJob(ready)
      -> GET /api/models/{id}/model.glb -> <model-viewer> (app + storefront)
"""
from __future__ import annotations

from ...config import get_settings
from .base import ANGLES, ProviderError, ProviderStatus, ReconstructionProvider

__all__ = ["ANGLES", "ProviderError", "ProviderStatus", "ReconstructionProvider", "get_provider", "provider_name"]

_instance = None
_instance_key = None


def provider_name() -> str:
    """The provider this deployment will use — or "disabled"."""
    s = get_settings()
    name = s.model3d_provider
    if name == "mock" and s.is_production:
        # A fake model in production is worse than no model.
        return "disabled"
    if name == "meshy" and not s.MESHY_API_KEY.strip():
        return "disabled"
    if name == "local" and not s.MODEL3D_LOCAL_URL.strip():
        return "disabled"
    return name if name in ("meshy", "local", "mock") else "disabled"


def get_provider() -> ReconstructionProvider | None:
    """The configured provider, or None when 3D generation is disabled."""
    global _instance, _instance_key
    s = get_settings()
    name = provider_name()
    key = (name, s.MESHY_AI_MODEL, s.MESHY_API_BASE, s.MODEL3D_LOCAL_URL)
    if _instance is not None and _instance_key == key:
        return _instance
    if name == "meshy":
        from .meshy import MeshyProvider

        _instance = MeshyProvider(s.MESHY_API_KEY, base_url=s.MESHY_API_BASE, ai_model=s.MESHY_AI_MODEL)
    elif name == "local":
        from .local import LocalProvider

        _instance = LocalProvider(s.MODEL3D_LOCAL_URL, token=s.MODEL3D_LOCAL_TOKEN)
    elif name == "mock":
        from .mock import MockProvider

        _instance = MockProvider()
    else:
        _instance = None
    _instance_key = key
    return _instance


def set_provider_for_tests(provider) -> None:
    """Inject a provider (tests only)."""
    global _instance, _instance_key
    _instance = provider
    s = get_settings()
    _instance_key = (provider_name(), s.MESHY_AI_MODEL, s.MESHY_API_BASE, s.MODEL3D_LOCAL_URL)
