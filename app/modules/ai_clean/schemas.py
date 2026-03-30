import json


def normalize_ai_clean_payload(data: dict) -> dict:
    bucket = (data.get("bucket") or "source").strip().lower()
    if bucket not in {"source", "generated"}:
        bucket = "source"

    mode = (data.get("mode") or "similarity").strip().lower()
    if mode not in {"similarity", "pose"}:
        mode = "similarity"

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

    reference_person_id = data.get("reference_person_id")
    if reference_person_id is None:
        reference_person_id = data.get("reference_person")
    try:
        reference_person_id = int(reference_person_id) if reference_person_id is not None and str(reference_person_id).strip() else None
    except Exception:
        reference_person_id = None

    return {
        "mode": mode,
        "bucket": bucket,
        "targets": targets,
        "reference_person_id": reference_person_id,
    }
