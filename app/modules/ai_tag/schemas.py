def normalize_tag_payload(data: dict) -> dict:
    return {
        "prompt": (data.get("prompt") or "").strip(),
        "provider": (data.get("provider") or "").strip(),
        "model": (data.get("model") or "").strip(),
        "api_key": (data.get("api_key") or "").strip(),
        "base_url": (data.get("base_url") or "").strip() or None,
        "targets": data.get("targets") or [],
    }
