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

    pose_match_mode = (data.get("pose_match_mode") or "any").strip().lower()
    if pose_match_mode not in {"any", "precise"}:
        pose_match_mode = "any"

    reference_person_ids_raw = data.get("reference_person_ids")
    reference_person_ids: list[int] = []
    if isinstance(reference_person_ids_raw, str) and reference_person_ids_raw.strip():
        try:
            parsed = json.loads(reference_person_ids_raw)
            if isinstance(parsed, list):
                reference_person_ids = [int(item) for item in parsed if str(item).strip()]
        except Exception:
            reference_person_ids = []
    elif isinstance(reference_person_ids_raw, list):
        try:
            reference_person_ids = [int(item) for item in reference_person_ids_raw if str(item).strip()]
        except Exception:
            reference_person_ids = []

    reference_person_ids = sorted(set(reference_person_ids))

    return {
        "mode": mode,
        "bucket": bucket,
        "targets": targets,
        "reference_person_ids": reference_person_ids,
        "pose_match_mode": pose_match_mode,
    }
