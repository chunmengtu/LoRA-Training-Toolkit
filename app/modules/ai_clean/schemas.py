import json


def normalize_similarity_payload(data: dict) -> dict:
    bucket = (data.get("bucket") or "source").strip().lower()
    if bucket not in {"source", "generated"}:
        bucket = "source"

    targets_raw = data.get("targets")
    targets: list[str] = []
    if isinstance(targets_raw, str) and targets_raw.strip():
        try:
            parsed = json.loads(targets_raw)
            if isinstance(parsed, list):
                targets = [str(item) for item in parsed if item]
        except Exception:
            targets = []
    elif isinstance(targets_raw, list):
        targets = [str(item) for item in targets_raw if item]

    return {"bucket": bucket, "targets": targets}
