import math
import threading
from pathlib import Path
from typing import List

from PIL import Image, ImageOps

from app.core.config import YOLO_POSE_WEIGHTS, ULTRALYTICS_WEIGHTS_DIR
from app.core.state import append_log, state_lock, task_state, update_state
from app.core.utils import allowed_image, get_timestamp, normalize_relative_path, safe_bucket_path
from app.shared.storage.media_store import gather_media_items


KP_CONF_MIN = 0.3
MIN_POINTS = 5
SIGMA = 0.08
MAX_POSE_RESULTS = 500

_model_lock = threading.RLock()
_pose_model = None


def _find_full_bipartite_matching(ref_to_cands: List[List[int]], cand_count: int) -> dict[int, int] | None:
    matched_to_ref = [-1] * cand_count

    def dfs(ref_index: int, seen: List[bool]) -> bool:
        for cand_index in ref_to_cands[ref_index]:
            if seen[cand_index]:
                continue
            seen[cand_index] = True
            if matched_to_ref[cand_index] == -1 or dfs(matched_to_ref[cand_index], seen):
                matched_to_ref[cand_index] = ref_index
                return True
        return False

    match = 0
    for ref_index in range(len(ref_to_cands)):
        if dfs(ref_index, [False] * cand_count):
            match += 1

    if match != len(ref_to_cands):
        return None

    result: dict[int, int] = {}
    for cand_index, ref_index in enumerate(matched_to_ref):
        if ref_index != -1:
            result[int(ref_index)] = int(cand_index)
    if len(result) != len(ref_to_cands):
        return None
    return result


def _bottleneck_assignment_min_similarity(matrix: List[List[float]]) -> tuple[float | None, dict[int, int] | None]:
    if not matrix or not matrix[0]:
        return None, None

    ref_count = len(matrix)
    cand_count = len(matrix[0])
    if cand_count < ref_count:
        return None, None

    unique_scores = sorted({round(value, 2) for row in matrix for value in row if value > 0}, reverse=True)
    if not unique_scores:
        return None, None

    for threshold in unique_scores:
        ref_to_cands = []
        for row in matrix:
            ref_to_cands.append([index for index, value in enumerate(row) if value >= threshold])
        matching = _find_full_bipartite_matching(ref_to_cands, cand_count)
        if matching is not None:
            return float(threshold), matching

    return None, None


def _ensure_pose_model():
    global _pose_model
    with _model_lock:
        if _pose_model is not None:
            return _pose_model

        weights_path = Path(YOLO_POSE_WEIGHTS)
        if not weights_path.exists():
            hint = f"请将 YOLO26m-pose.pt 放入 {ULTRALYTICS_WEIGHTS_DIR}，或设置环境变量 YOLO_POSE_WEIGHTS 指向权重文件。"
            raise ValueError(hint)

        try:
            from ultralytics import YOLO
        except Exception as exc:  # pragma: no cover
            raise ValueError(f"未安装 ultralytics：{exc}（请先安装 ultralytics 与 torch）") from exc

        try:
            _pose_model = YOLO(str(weights_path))
        except Exception as exc:
            message = str(exc)
            if "Pose26" not in message:
                raise
            try:
                from ultralytics.nn.modules import head as ultralytics_head
            except Exception:
                raise ValueError(f"模型加载失败：{message}") from exc
            if hasattr(ultralytics_head, "Pose") and not hasattr(ultralytics_head, "Pose26"):
                ultralytics_head.Pose26 = ultralytics_head.Pose
                try:
                    _pose_model = YOLO(str(weights_path))
                except Exception as retry_exc:
                    raise ValueError(f"模型加载失败：{retry_exc}") from retry_exc
            else:
                raise ValueError(f"模型加载失败：{message}") from exc
        return _pose_model


def _open_reference_image(file_storage) -> Image.Image:
    file_storage.stream.seek(0)
    try:
        image = Image.open(file_storage.stream)
        image = ImageOps.exif_transpose(image).convert("RGB")
        return image
    except Exception as exc:
        raise ValueError(f"参考图解析失败：{exc}") from exc


def _extract_persons_from_result(result) -> List[dict]:
    persons: List[dict] = []
    if result is None:
        return persons

    boxes = getattr(result, "boxes", None)
    keypoints = getattr(result, "keypoints", None)
    if boxes is None or keypoints is None:
        return persons

    def to_list(value):
        if value is None:
            return None
        if hasattr(value, "cpu"):
            value = value.cpu()
        if hasattr(value, "numpy"):
            value = value.numpy()
        if hasattr(value, "tolist"):
            return value.tolist()
        return list(value)

    xyxy_list = to_list(getattr(boxes, "xyxy", None))
    box_conf_list = to_list(getattr(boxes, "conf", None))
    kpt_xyn_list = to_list(getattr(keypoints, "xyn", None))
    kpt_conf_list = to_list(getattr(keypoints, "conf", None))
    if xyxy_list is None or box_conf_list is None or kpt_xyn_list is None:
        return persons

    if kpt_conf_list is None:
        keypoint_count = len(kpt_xyn_list[0]) if kpt_xyn_list and kpt_xyn_list[0] else 0
        kpt_conf_list = [[1.0 for _ in range(keypoint_count)] for _ in range(len(kpt_xyn_list))]

    count = min(len(xyxy_list), len(box_conf_list), len(kpt_xyn_list), len(kpt_conf_list))
    for index in range(count):
        bbox = xyxy_list[index]
        score = float(box_conf_list[index] or 0.0)
        keypoints_xy = kpt_xyn_list[index]
        keypoints_cf = kpt_conf_list[index]
        keypoints_norm = []
        for (x, y), c in zip(keypoints_xy, keypoints_cf):
            keypoints_norm.append([float(x), float(y), float(c)])
        persons.append({"bbox_xyxy": [float(v) for v in bbox], "score": score, "keypoints_norm": keypoints_norm})
    return persons


def _sort_persons(persons: List[dict]) -> List[dict]:
    def area(person: dict) -> float:
        x1, y1, x2, y2 = person.get("bbox_xyxy") or [0, 0, 0, 0]
        return max(0.0, float(x2) - float(x1)) * max(0.0, float(y2) - float(y1))

    return sorted(persons, key=lambda item: (area(item), float(item.get("score") or 0.0)), reverse=True)


def build_reference_pose_preview(reference_storage) -> dict:
    model = _ensure_pose_model()
    image = _open_reference_image(reference_storage)
    try:
        results = model(image, verbose=False)
    except Exception as exc:  # pragma: no cover
        raise ValueError(f"骨骼点检测失败：{exc}") from exc

    persons = _sort_persons(_extract_persons_from_result(results[0] if results else None))
    orig_shape = getattr(results[0], "orig_shape", None) if results else None
    height = int(orig_shape[0]) if isinstance(orig_shape, (tuple, list)) and len(orig_shape) >= 2 else int(image.size[1])
    width = int(orig_shape[1]) if isinstance(orig_shape, (tuple, list)) and len(orig_shape) >= 2 else int(image.size[0])
    payload = []
    for person_id, person in enumerate(persons):
        payload.append(
            {
                "person_id": person_id,
                "score": round(float(person.get("score") or 0.0), 6),
                "bbox_xyxy": person.get("bbox_xyxy") or [0, 0, 0, 0],
                "keypoints_norm": person.get("keypoints_norm") or [],
            }
        )
    return {"persons": payload, "image_size": {"w": width, "h": height}}


def _compute_pose_similarity_percent(
    reference_kps: List[List[float]],
    candidate_kps: List[List[float]],
    *,
    kp_conf_min: float = KP_CONF_MIN,
    min_points: int = MIN_POINTS,
    sigma: float = SIGMA,
) -> float:
    if not reference_kps or not candidate_kps:
        return 0.0
    if len(reference_kps) < 5 or len(candidate_kps) < 5:
        return 0.0

    valid = []
    for idx in range(min(len(reference_kps), len(candidate_kps))):
        rx, ry, rc = reference_kps[idx]
        cx, cy, cc = candidate_kps[idx]
        if rc >= kp_conf_min and cc >= kp_conf_min:
            valid.append((idx, rc, cc))
    if len(valid) < min_points:
        return 0.0

    weights = [float(rc) * float(cc) for _, rc, cc in valid]
    w_sum = sum(weights)
    if w_sum <= 0:
        return 0.0

    ref_points = [(float(reference_kps[idx][0]), float(reference_kps[idx][1])) for idx, _, _ in valid]
    cand_points = [(float(candidate_kps[idx][0]), float(candidate_kps[idx][1])) for idx, _, _ in valid]

    ref_cx = sum(w * p[0] for w, p in zip(weights, ref_points)) / w_sum
    ref_cy = sum(w * p[1] for w, p in zip(weights, ref_points)) / w_sum
    cand_cx = sum(w * p[0] for w, p in zip(weights, cand_points)) / w_sum
    cand_cy = sum(w * p[1] for w, p in zip(weights, cand_points)) / w_sum

    ref_centered = [(x - ref_cx, y - ref_cy) for x, y in ref_points]
    cand_centered = [(x - cand_cx, y - cand_cy) for x, y in cand_points]

    ref_scale = math.sqrt(sum(w * (x * x + y * y) for w, (x, y) in zip(weights, ref_centered)) / w_sum)
    cand_scale = math.sqrt(sum(w * (x * x + y * y) for w, (x, y) in zip(weights, cand_centered)) / w_sum)
    if ref_scale <= 1e-6 or cand_scale <= 1e-6:
        return 0.0

    ref_norm = [(x / ref_scale, y / ref_scale) for x, y in ref_centered]
    cand_norm = [(x / cand_scale, y / cand_scale) for x, y in cand_centered]

    w_norm = [w / w_sum for w in weights]
    c00 = sum(w * (cx * rx) for w, (cx, _), (rx, _) in zip(w_norm, cand_norm, ref_norm))
    c01 = sum(w * (cx * ry) for w, (cx, _), (_, ry) in zip(w_norm, cand_norm, ref_norm))
    c10 = sum(w * (cy * rx) for w, (_, cy), (rx, _) in zip(w_norm, cand_norm, ref_norm))
    c11 = sum(w * (cy * ry) for w, (_, cy), (_, ry) in zip(w_norm, cand_norm, ref_norm))

    angle = math.atan2(c01 - c10, c00 + c11)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)

    mse = 0.0
    for w, (cx, cy), (rx, ry) in zip(w_norm, cand_norm, ref_norm):
        x_rot = cx * cos_a - cy * sin_a
        y_rot = cx * sin_a + cy * cos_a
        dx = x_rot - rx
        dy = y_rot - ry
        mse += w * (dx * dx + dy * dy)

    value = math.exp(-mse / (2.0 * float(sigma) * float(sigma))) * 100.0
    if not math.isfinite(value):
        return 0.0
    return max(0.0, min(100.0, value))


def _resolve_pose_candidates(targets: List[str], bucket: str) -> List[dict]:
    if not targets:
        return gather_media_items(bucket)

    items: List[dict] = []
    for relative in targets:
        normalized = normalize_relative_path(relative)
        try:
            path = safe_bucket_path(bucket, normalized)
        except ValueError:
            continue
        if not path.exists() or not allowed_image(path.name):
            continue
        stat = path.stat()
        url_prefix = "/uploads" if bucket == "source" else f"/media/{bucket}"
        items.append(
            {
                "name": path.name,
                "path": normalized,
                "relative_path": normalized,
                "bucket": bucket,
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "url": f"{url_prefix}/{normalized}",
            }
        )
    return items


def find_pose_similar_images(
    reference_storage,
    *,
    reference_person_ids: List[int],
    pose_match_mode: str = "any",
    bucket: str = "source",
    targets: List[str] | None = None,
) -> List[dict]:
    model = _ensure_pose_model()
    candidates = _resolve_pose_candidates(list(targets or []), bucket=bucket)
    if not candidates:
        update_state("ai_clean", status="idle", progress=0, processed=0, total=0, bucket=bucket, message="未找到可筛选的图片")
        return []

    with state_lock:
        if task_state["ai_clean"]["status"] == "running":
            raise RuntimeError("已有 AI 图片清洗任务正在执行")
        update_state(
            "ai_clean",
            status="running",
            progress=0,
            processed=0,
            total=len(candidates),
            bucket=bucket,
            message="正在执行骨骼点筛选",
            log=[],
        )
    append_log("ai_clean", f"[{get_timestamp()}] 🦴 开始骨骼点筛选，共 {len(candidates)} 张图片")

    reference_preview = build_reference_pose_preview(reference_storage)
    persons = reference_preview.get("persons") or []
    if not persons:
        update_state("ai_clean", status="error", progress=100, message="参考图未检测到人体/关键点")
        append_log("ai_clean", f"[{get_timestamp()}] ❌ 参考图未检测到人体/关键点")
        raise ValueError("参考图未检测到人体/关键点")
    if not reference_person_ids:
        raise ValueError("请先在参考图中选择基准人体")

    valid_reference_ids = [rid for rid in reference_person_ids if isinstance(rid, int) and 0 <= rid < len(persons)]
    if not valid_reference_ids:
        raise ValueError("参考图基准人体选择无效，请重新选择")

    pose_match_mode = (pose_match_mode or "any").strip().lower()
    if pose_match_mode not in {"any", "precise"}:
        pose_match_mode = "any"

    reference_kps_list: List[List[List[float]]] = []
    for rid in valid_reference_ids:
        reference_kps_list.append(persons[rid].get("keypoints_norm") or [])

    def best_similarity_any(cand_kps: List[List[float]]) -> float:
        return max((_compute_pose_similarity_percent(ref_kps, cand_kps) for ref_kps in reference_kps_list), default=0.0)

    def best_similarity_precise(cand_people: List[dict]) -> tuple[float | None, dict[int, int] | None]:
        if not cand_people:
            return None, None
        ref_count = len(reference_kps_list)
        if len(cand_people) < ref_count:
            return None, None

        matrix: List[List[float]] = []
        for ref_kps in reference_kps_list:
            row = []
            for cand in cand_people:
                row.append(_compute_pose_similarity_percent(ref_kps, cand.get("keypoints_norm") or []))
            matrix.append(row)
        threshold, matching = _bottleneck_assignment_min_similarity(matrix)
        if threshold is None or matching is None:
            return None, None
        return float(threshold), matching

    total = len(candidates)
    processed = 0
    results: List[dict] = []
    for item in candidates:
        best_score = 0.0
        best_kps = None
        people_count = 0
        try:
            relative_path = item.get("relative_path") or ""
            image_path = safe_bucket_path(bucket, relative_path)
            if not image_path.exists():
                raise FileNotFoundError(relative_path)
            predictions = model(str(image_path), verbose=False)
            persons_pred = _sort_persons(_extract_persons_from_result(predictions[0] if predictions else None))
            people_count = len(persons_pred)
            if pose_match_mode == "precise":
                score, matching = best_similarity_precise(persons_pred)
                if score is None:
                    continue
                best_score = float(score)
                if matching:
                    matched_keypoints: List[List[List[float]]] = []
                    best_value = 0.0
                    best_kps = None
                    for ref_index, cand_index in matching.items():
                        if not (0 <= cand_index < len(persons_pred)):
                            continue
                        cand_kps = persons_pred[cand_index].get("keypoints_norm") or []
                        if cand_kps:
                            matched_keypoints.append(cand_kps)
                        value = _compute_pose_similarity_percent(reference_kps_list[ref_index], cand_kps)
                        if value > best_value:
                            best_value = value
                            best_kps = cand_kps or None
                    if matched_keypoints:
                        item = {**item, "pose_keypoints_list": matched_keypoints}
            else:
                for person in persons_pred:
                    cand_kps = person.get("keypoints_norm") or []
                    score = best_similarity_any(cand_kps)
                    if score > best_score:
                        best_score = score
                        best_kps = cand_kps
        except Exception:
            pass
        finally:
            processed += 1
            if processed == total or processed % 10 == 0:
                update_state(
                    "ai_clean",
                    progress=int(processed / total * 100) if total else 100,
                    processed=processed,
                    message=f"已处理 {processed}/{total} 张图片",
                )

        if best_score <= 0:
            continue

        payload = {**item, "probability": round(float(best_score), 2), "pose_people": people_count}
        if best_kps:
            payload["pose_keypoints"] = best_kps
        results.append(payload)

    results.sort(key=lambda entry: entry.get("probability", 0), reverse=True)
    results = results[:MAX_POSE_RESULTS]
    update_state(
        "ai_clean",
        status="success",
        progress=100,
        processed=processed,
        message=f"骨骼点筛选完成，共 {len(results)} 张图片",
    )
    append_log("ai_clean", f"[{get_timestamp()}] ✅ 骨骼点筛选完成，共 {len(results)} 张图片")
    return results
