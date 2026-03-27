import base64
import copy
import mimetypes
import re
import time
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List

import requests

from app.core.config import (
    RUNNINGHUB_API_BASE,
    RUNNINGHUB_QUERY_URL,
    RUNNINGHUB_SITE_BASE,
    RUNNINGHUB_UPLOAD_URL,
)


RUNNINGHUB_MAX_RETRIES = 3
RUNNINGHUB_POLL_INTERVAL_SECONDS = 5
RUNNINGHUB_MAX_POLL_ROUNDS = 120
class RunningHubError(RuntimeError):
    pass


class ValidationError(RunningHubError):
    pass


class UploadError(RunningHubError):
    pass


class TaskFailedError(RunningHubError):
    pass


class TaskTimeoutError(RunningHubError):
    pass


@dataclass(frozen=True)
class ModelSpec:
    model_name: str
    label: str
    endpoint: str
    adapter_type: str
    required_fields: tuple[str, ...]
    optional_fields: tuple[str, ...] = ()
    enum_constraints: dict[str, tuple[str, ...]] = field(default_factory=dict)
    max_input_images: int = 10
    image_size_limit: int = 10 * 1024 * 1024
    max_output_images: int | None = None
    supports_aspect_ratio: bool = False


@dataclass
class UnifiedImageRequest:
    model: str
    prompt: str
    images: list[str] = field(default_factory=list)
    resolution: str = ""
    aspect_ratio: str = ""
    width: int | None = None
    height: int | None = None
    size: str = ""
    quality: str = ""
    input_fidelity: str = ""
    sequential_image_generation: str = ""
    max_images: int | None = None
    webhook_url: str = ""
    extra_params: dict[str, Any] = field(default_factory=dict)
    endpoint_override: str = ""
    query_url: str = ""


def _full_api_url(path: str) -> str:
    return f"{RUNNINGHUB_API_BASE}/{path.lstrip('/')}"


MODEL_SPECS: dict[str, ModelSpec] = {
    "rhart-image-n-pro-official": ModelSpec(
        model_name="rhart-image-n-pro-official",
        label="RhArt Image N Pro",
        endpoint=_full_api_url("rhart-image-n-pro-official/edit"),
        adapter_type="resolution_aspect_ratio",
        required_fields=("imageUrls", "prompt", "resolution"),
        optional_fields=("aspectRatio", "webhookUrl"),
        enum_constraints={
            "resolution": ("1k", "2k", "4k"),
            "aspect_ratio": ("1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"),
        },
        max_input_images=10,
        image_size_limit=10 * 1024 * 1024,
        supports_aspect_ratio=True,
    ),
    "rhart-image-n-g31-flash": ModelSpec(
        model_name="rhart-image-n-g31-flash",
        label="RhArt Image N G31 Flash",
        endpoint=_full_api_url("rhart-image-n-g31-flash/image-to-image"),
        adapter_type="resolution_aspect_ratio",
        required_fields=("imageUrls", "prompt", "resolution"),
        optional_fields=("aspectRatio", "webhookUrl"),
        enum_constraints={
            "resolution": ("1k", "2k", "4k"),
            "aspect_ratio": ("1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "21:9", "1:4", "4:1", "1:8", "8:1"),
        },
        max_input_images=10,
        image_size_limit=30 * 1024 * 1024,
        supports_aspect_ratio=True,
    ),
    "seedream-v5-lite": ModelSpec(
        model_name="seedream-v5-lite",
        label="Seedream V5 Lite",
        endpoint=_full_api_url("seedream-v5-lite/image-to-image"),
        adapter_type="width_height",
        required_fields=("imageUrls", "prompt"),
        optional_fields=(
            "width",
            "height",
            "resolution",
            "sequentialImageGeneration",
            "maxImages",
            "webhookUrl",
        ),
        enum_constraints={
            "resolution": ("2k", "3k"),
            "sequential_image_generation": ("disabled", "auto"),
        },
        max_input_images=10,
        image_size_limit=10 * 1024 * 1024,
        max_output_images=15,
    ),
    "rhart-image-g-1.5-official": ModelSpec(
        model_name="rhart-image-g-1.5-official",
        label="RhArt Image G 1.5",
        endpoint=_full_api_url("rhart-image-g-1.5-official/image-to-image"),
        adapter_type="size_quality",
        required_fields=("imageUrls", "prompt", "size", "quality"),
        optional_fields=("inputFidelity", "webhookUrl"),
        enum_constraints={
            "size": ("auto", "1024*1024", "1024*1536", "1536*1024"),
            "quality": ("low", "medium", "high"),
            "input_fidelity": ("low", "high"),
        },
        max_input_images=10,
        image_size_limit=50 * 1024 * 1024,
    ),
}

GENERIC_AI_APP_PREFIX = "run/ai-app/"
GENERIC_AI_APP_LABEL = "RunningHub AI App"
GENERIC_AI_APP_IMAGE_LIMIT = 50 * 1024 * 1024


def normalize_model_name(model_name: str = "") -> str:
    normalized = (model_name or "").strip()
    if not normalized:
        return ""
    if normalized.startswith(("http://", "https://")):
        return guess_model_from_endpoint(normalized)
    normalized = re.sub(r"^https://www\.runninghub\.cn/openapi/v2/", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"^openapi/v2/", "", normalized, flags=re.IGNORECASE)
    return normalized.strip().strip("/").lower()


def is_generic_ai_app_model(model_name: str = "") -> bool:
    return normalize_model_name(model_name).startswith(GENERIC_AI_APP_PREFIX)


def build_generic_ai_app_spec(model_name: str) -> ModelSpec:
    normalized = normalize_model_name(model_name)
    return ModelSpec(
        model_name=normalized,
        label=GENERIC_AI_APP_LABEL,
        endpoint=_full_api_url(normalized),
        adapter_type="node_info_list",
        required_fields=("nodeInfoList",),
        optional_fields=("instanceType", "usePersonalQueue", "webhookUrl"),
        max_input_images=10,
        image_size_limit=GENERIC_AI_APP_IMAGE_LIMIT,
        supports_aspect_ratio=True,
    )


def resolve_model_name(model_name: str = "", endpoint: str = "") -> str:
    explicit = normalize_model_name(model_name)
    if explicit:
        return explicit
    inferred = guess_model_from_endpoint(endpoint)
    if inferred:
        return inferred
    raise ValidationError("未能识别 RunningHub 模型，请先通过自动解析回填，或手动填写正确的模型名 / 接口地址")


def get_model_spec(model_name: str, extra_params: dict[str, Any] | None = None) -> ModelSpec:
    normalized = normalize_model_name(model_name)
    
    # 如果提供了python_code，使用python_code适配器
    if extra_params and extra_params.get("python_code"):
        return ModelSpec(
            model_name=normalized or "custom-python-model",
            label="Custom Python Model",
            endpoint="",  # 将从python_code中提取
            adapter_type="python_code",
            required_fields=("imageUrls", "prompt"),
            optional_fields=(),
            max_input_images=10,
            image_size_limit=50 * 1024 * 1024,
        )
    
    if normalized in MODEL_SPECS:
        return MODEL_SPECS[normalized]
    if is_generic_ai_app_model(normalized):
        return build_generic_ai_app_spec(normalized)
    for spec in MODEL_SPECS.values():
        endpoint_suffix = guess_model_from_endpoint(spec.endpoint)
        if normalized == endpoint_suffix:
            return spec
        if normalized.startswith(f"{spec.model_name}/"):
            return spec
    raise ValidationError(f"不支持的 RunningHub 模型：{normalized}")


def guess_model_from_endpoint(endpoint: str) -> str:
    normalized = (endpoint or "").strip().lower()
    if not normalized:
        return ""
    match = re.search(r"/openapi/v2/([^?#]+)", normalized)
    if match:
        suffix = match.group(1).strip().strip("/")
        if suffix in {"query", "media/upload/binary"}:
            return ""
        return suffix
    return ""


def parse_json_response(response: requests.Response) -> dict[str, Any] | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    return payload if isinstance(payload, dict) else None


def extract_error_message(response: requests.Response, payload: dict[str, Any] | None = None) -> str:
    if isinstance(payload, dict):
        for key in ("errorMessage", "message", "msg", "detail"):
            value = payload.get(key)
            if value:
                return str(value)
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("message", "msg", "detail"):
                value = data.get(key)
                if value:
                    return str(value)
    return response.text.strip() or f"HTTP {response.status_code}"


def extract_result_urls(result: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    containers = [result]
    if isinstance(result.get("data"), dict):
        containers.append(result["data"])
    for container in containers:
        for item in container.get("results") or []:
            if isinstance(item, str):
                urls.append(item)
                continue
            if not isinstance(item, dict):
                continue
            for key in ("url", "fileUrl", "downloadUrl"):
                value = item.get(key)
                if value:
                    urls.append(str(value))
            for nested_key in ("files", "images", "outputs", "results"):
                for nested_item in item.get(nested_key) or []:
                    if isinstance(nested_item, str):
                        urls.append(nested_item)
                    elif isinstance(nested_item, dict):
                        for key in ("url", "fileUrl", "downloadUrl"):
                            value = nested_item.get(key)
                            if value:
                                urls.append(str(value))
            text_output = item.get("text")
            if isinstance(text_output, str) and text_output.startswith("http"):
                urls.append(text_output)
    seen: set[str] = set()
    ordered: list[str] = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered


def decode_data_uri(data_uri: str) -> tuple[str, bytes]:
    if not data_uri.startswith("data:") or "," not in data_uri:
        raise ValidationError("无效的 Data URI")
    header, encoded = data_uri.split(",", 1)
    mime = header[5:].split(";", 1)[0] if ";" in header else header[5:] or "application/octet-stream"
    if ";base64" not in header:
        raise ValidationError("仅支持 Base64 Data URI")
    try:
        return mime or "application/octet-stream", base64.b64decode(encoded)
    except Exception as exc:
        raise ValidationError("无法解码 Base64 Data URI") from exc


class BaseAdapter:
    adapter_type = "base"

    def validate(self, request: UnifiedImageRequest, spec: ModelSpec) -> None:
        if not request.prompt.strip():
            raise ValidationError("prompt 为必填项")
        if not request.images:
            raise ValidationError("imageUrls 为必填项")
        if len(request.images) > spec.max_input_images:
            raise ValidationError(f"{spec.label} 最多支持 {spec.max_input_images} 张输入图片")

    def build_payload(self, request: UnifiedImageRequest, spec: ModelSpec) -> dict[str, Any]:
        raise NotImplementedError

    @staticmethod
    def _require_value(name: str, value: Any, message: str) -> Any:
        if value in (None, ""):
            raise ValidationError(message)
        return value

    @staticmethod
    def _validate_enum(name: str, value: str, allowed: Iterable[str], label: str | None = None) -> None:
        if value in ("", None):
            return
        if value not in allowed:
            readable = " / ".join(allowed)
            raise ValidationError(f"{label or name} 仅支持：{readable}")

    @staticmethod
    def _merge_common_payload(
        request: UnifiedImageRequest,
        payload: dict[str, Any],
        ignore_keys: Iterable[str] = (),
    ) -> dict[str, Any]:
        if request.webhook_url:
            payload["webhookUrl"] = request.webhook_url
        ignored = set(ignore_keys)
        for key, value in (request.extra_params or {}).items():
            if key in ignored or value in ("", None):
                continue
            if key not in payload:
                payload[key] = value
        return payload


class ResolutionAspectRatioAdapter(BaseAdapter):
    adapter_type = "resolution_aspect_ratio"

    def validate(self, request: UnifiedImageRequest, spec: ModelSpec) -> None:
        super().validate(request, spec)
        self._require_value("resolution", request.resolution, "resolution 为必填项")
        self._validate_enum("resolution", request.resolution, spec.enum_constraints.get("resolution", ()), "resolution")
        normalized_aspect_ratio = (request.aspect_ratio or "").strip()
        if normalized_aspect_ratio and normalized_aspect_ratio.lower() != "auto":
            self._validate_enum(
                "aspect_ratio",
                normalized_aspect_ratio,
                spec.enum_constraints.get("aspect_ratio", ()),
                "aspectRatio",
            )

    def build_payload(self, request: UnifiedImageRequest, spec: ModelSpec) -> dict[str, Any]:
        self.validate(request, spec)
        payload = {
            "imageUrls": request.images,
            "prompt": request.prompt,
            "resolution": request.resolution,
        }
        normalized_aspect_ratio = (request.aspect_ratio or "").strip()
        if normalized_aspect_ratio and normalized_aspect_ratio.lower() != "auto":
            payload["aspectRatio"] = normalized_aspect_ratio
        return self._merge_common_payload(request, payload, ignore_keys={"resolution", "aspectRatio"})


class WidthHeightAdapter(BaseAdapter):
    adapter_type = "width_height"

    def validate(self, request: UnifiedImageRequest, spec: ModelSpec) -> None:
        super().validate(request, spec)
        if request.resolution:
            self._validate_enum(
                "resolution",
                request.resolution,
                spec.enum_constraints.get("resolution", ()),
                "resolution",
            )
        else:
            has_width = request.width is not None
            has_height = request.height is not None
            if has_width != has_height:
                raise ValidationError("width 和 height 需要同时填写，或同时留空")
            if has_width:
                if not 1600 <= request.width <= 4704:
                    raise ValidationError("width 仅支持 1600 到 4704")
                if not 1344 <= request.height <= 4096:
                    raise ValidationError("height 仅支持 1344 到 4096")

        if request.max_images is not None and not 1 <= request.max_images <= (spec.max_output_images or 15):
            raise ValidationError(f"maxImages 仅支持 1 到 {spec.max_output_images or 15}")
        self._validate_enum(
            "sequential_image_generation",
            request.sequential_image_generation,
            spec.enum_constraints.get("sequential_image_generation", ()),
            "sequentialImageGeneration",
        )

    def build_payload(self, request: UnifiedImageRequest, spec: ModelSpec) -> dict[str, Any]:
        self.validate(request, spec)
        payload: dict[str, Any] = {"imageUrls": request.images, "prompt": request.prompt}
        if request.resolution:
            payload["resolution"] = request.resolution
        else:
            if request.width not in (None, 0):
                payload["width"] = request.width
            if request.height not in (None, 0):
                payload["height"] = request.height
        if request.sequential_image_generation:
            payload["sequentialImageGeneration"] = request.sequential_image_generation
        if request.max_images is not None:
            payload["maxImages"] = request.max_images
        return self._merge_common_payload(
            request,
            payload,
            ignore_keys={"resolution", "width", "height", "sequentialImageGeneration", "maxImages"},
        )


class SizeQualityAdapter(BaseAdapter):
    adapter_type = "size_quality"

    def validate(self, request: UnifiedImageRequest, spec: ModelSpec) -> None:
        super().validate(request, spec)
        self._require_value("size", request.size, "size 为必填项")
        self._require_value("quality", request.quality, "quality 为必填项")
        self._validate_enum("size", request.size, spec.enum_constraints.get("size", ()), "size")
        self._validate_enum("quality", request.quality, spec.enum_constraints.get("quality", ()), "quality")
        self._validate_enum(
            "input_fidelity",
            request.input_fidelity,
            spec.enum_constraints.get("input_fidelity", ()),
            "inputFidelity",
        )

    def build_payload(self, request: UnifiedImageRequest, spec: ModelSpec) -> dict[str, Any]:
        self.validate(request, spec)
        payload = {
            "imageUrls": request.images,
            "prompt": request.prompt,
            "size": request.size,
            "quality": request.quality,
        }
        if request.input_fidelity:
            payload["inputFidelity"] = request.input_fidelity
        return self._merge_common_payload(request, payload, ignore_keys={"size", "quality", "inputFidelity"})


class PythonCodeAdapter(BaseAdapter):
    adapter_type = "python_code"

    def validate(self, request: UnifiedImageRequest, spec: ModelSpec) -> None:
        super().validate(request, spec)
        python_code = (request.extra_params or {}).get("python_code")
        if not python_code or not isinstance(python_code, str):
            raise ValidationError("当前模型需要 python_code 配置，请先上传Python示例代码")

    def build_payload(self, request: UnifiedImageRequest, spec: ModelSpec) -> dict[str, Any]:
        self.validate(request, spec)
        from app.shared.integrations.python_parser import parse_python_example, build_payload_from_parsed
        
        python_code = request.extra_params.get("python_code", "")
        parsed_info = parse_python_example(python_code)
        
        user_params = {
            "resolution": request.resolution,
            "aspectRatio": request.aspect_ratio,
            "width": request.width,
            "height": request.height,
            "size": request.size,
            "quality": request.quality,
            "inputFidelity": request.input_fidelity,
            "sequentialImageGeneration": request.sequential_image_generation,
            "maxImages": request.max_images,
        }
        
        # 移除空值
        user_params = {k: v for k, v in user_params.items() if v not in (None, "")}
        
        # 合并extra_params中的其他参数
        for key, value in request.extra_params.items():
            if key != "python_code" and value not in (None, ""):
                user_params[key] = value
        
        payload = build_payload_from_parsed(
            parsed_info,
            request.prompt,
            request.images,
            user_params
        )
        
        if request.webhook_url:
            payload["webhookUrl"] = request.webhook_url
        
        return payload


class NodeInfoListAdapter(BaseAdapter):
    adapter_type = "node_info_list"

    def validate(self, request: UnifiedImageRequest, spec: ModelSpec) -> None:
        super().validate(request, spec)
        node_info_list = (request.extra_params or {}).get("nodeInfoList")
        if not isinstance(node_info_list, list) or not node_info_list:
            raise ValidationError("当前 RunningHub AI App 需要 nodeInfoList 配置，请先通过自动解析回填示例，或在高级设置中补全")
        image_nodes = [node for node in node_info_list if _node_field_name(node) == "image"]
        if image_nodes and len(request.images) > len(image_nodes):
            raise ValidationError(f"当前 AI App 仅识别到 {len(image_nodes)} 个图像节点，但你传入了 {len(request.images)} 张图片")

    def build_payload(self, request: UnifiedImageRequest, spec: ModelSpec) -> dict[str, Any]:
        self.validate(request, spec)
        payload = copy.deepcopy(request.extra_params or {})
        node_info_list = payload.get("nodeInfoList") or []
        image_nodes = [node for node in node_info_list if _node_field_name(node) == "image"]
        image_queue = list(request.images)

        for node in image_nodes:
            if not image_queue:
                break
            node["fieldValue"] = image_queue.pop(0)

        _apply_node_value(node_info_list, "prompt", request.prompt)
        _apply_node_value(node_info_list, "aspectratio", (request.aspect_ratio or "").strip())
        _apply_node_value(node_info_list, "resolution", request.resolution)
        _apply_node_value(node_info_list, "size", request.size)
        _apply_node_value(node_info_list, "quality", request.quality)
        _apply_node_value(node_info_list, "inputfidelity", request.input_fidelity)
        _apply_node_value(node_info_list, "width", request.width)
        _apply_node_value(node_info_list, "height", request.height)
        _apply_node_value(node_info_list, "sequentialimagegeneration", request.sequential_image_generation)
        _apply_node_value(node_info_list, "maximages", request.max_images)

        if not image_nodes:
            payload["imageUrls"] = request.images
        if request.prompt and not _has_node_field(node_info_list, "prompt"):
            payload.setdefault("prompt", request.prompt)
        normalized_aspect_ratio = (request.aspect_ratio or "").strip()
        if normalized_aspect_ratio and not _has_node_field(node_info_list, "aspectratio"):
            payload.setdefault("aspectRatio", normalized_aspect_ratio)
        if request.resolution and not _has_node_field(node_info_list, "resolution"):
            payload.setdefault("resolution", request.resolution)
        if request.size and not _has_node_field(node_info_list, "size"):
            payload.setdefault("size", request.size)
        if request.quality and not _has_node_field(node_info_list, "quality"):
            payload.setdefault("quality", request.quality)
        if request.input_fidelity and not _has_node_field(node_info_list, "inputfidelity"):
            payload.setdefault("inputFidelity", request.input_fidelity)
        if request.width not in (None, 0) and not _has_node_field(node_info_list, "width"):
            payload.setdefault("width", request.width)
        if request.height not in (None, 0) and not _has_node_field(node_info_list, "height"):
            payload.setdefault("height", request.height)
        if request.sequential_image_generation and not _has_node_field(node_info_list, "sequentialimagegeneration"):
            payload.setdefault("sequentialImageGeneration", request.sequential_image_generation)
        if request.max_images is not None and not _has_node_field(node_info_list, "maximages"):
            payload.setdefault("maxImages", request.max_images)
        if request.webhook_url:
            payload["webhookUrl"] = request.webhook_url
        return payload


def _node_field_name(node: Any) -> str:
    if not isinstance(node, dict):
        return ""
    return str(node.get("fieldName") or "").strip().lower()


def _has_node_field(node_info_list: list[dict[str, Any]], field_name: str) -> bool:
    normalized = (field_name or "").strip().lower()
    return any(_node_field_name(node) == normalized for node in node_info_list if isinstance(node, dict))


def _apply_node_value(node_info_list: list[dict[str, Any]], field_name: str, value: Any) -> None:
    if value in (None, ""):
        return
    normalized = (field_name or "").strip().lower()
    for node in node_info_list:
        if _node_field_name(node) == normalized:
            node["fieldValue"] = value


ADAPTERS: dict[str, BaseAdapter] = {
    "resolution_aspect_ratio": ResolutionAspectRatioAdapter(),
    "width_height": WidthHeightAdapter(),
    "size_quality": SizeQualityAdapter(),
    "node_info_list": NodeInfoListAdapter(),
    "python_code": PythonCodeAdapter(),
}


class RunningHubClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = RUNNINGHUB_SITE_BASE,
        *,
        query_url: str = RUNNINGHUB_QUERY_URL,
        upload_url: str = RUNNINGHUB_UPLOAD_URL,
        log: Callable[[str], None] | None = None,
        session: requests.Session | None = None,
    ) -> None:
        self.api_key = (api_key or "").strip()
        self.base_url = (base_url or RUNNINGHUB_SITE_BASE).rstrip("/")
        self.query_url = (query_url or f"{self.base_url}/openapi/v2/query").strip()
        self.upload_url = (upload_url or f"{self.base_url}/openapi/v2/media/upload/binary").strip()
        self.log = log
        self.session = session or requests.Session()
        if not self.api_key:
            raise ValidationError("请填写 RunningHub API Key")

    def run(
        self,
        request: UnifiedImageRequest,
        wait: bool = True,
        interval: int = RUNNINGHUB_POLL_INTERVAL_SECONDS,
        timeout: int = RUNNINGHUB_POLL_INTERVAL_SECONDS * RUNNINGHUB_MAX_POLL_ROUNDS,
    ) -> dict[str, Any]:
        task = self.submit_task(request)
        if not wait:
            return task["response"]
        result = self.wait_for_task(task["taskId"], request.query_url or self.query_url, interval=interval, timeout=timeout)
        urls = extract_result_urls(result)
        if urls:
            self._log(f"成功结果链接：{', '.join(urls)}")
        return result

    def submit_task(self, request: UnifiedImageRequest) -> dict[str, Any]:
        resolved_model_name = resolve_model_name(request.model, request.endpoint_override)
        spec = get_model_spec(resolved_model_name, request.extra_params)
        adapter = ADAPTERS[spec.adapter_type]
        normalized_request = replace(
            request,
            model=spec.model_name,
            aspect_ratio=(request.aspect_ratio or "").strip(),
            prompt=(request.prompt or "").strip(),
            endpoint_override=(request.endpoint_override or "").strip(),
            query_url=(request.query_url or "").strip(),
        )
        adapter.validate(normalized_request, spec)
        image_urls = self.prepare_image_urls(normalized_request.images, spec)
        prepared_request = replace(normalized_request, images=image_urls)
        payload = adapter.build_payload(prepared_request, spec)
        
        # 如果使用python_code适配器，从解析结果中获取endpoint
        endpoint = prepared_request.endpoint_override or spec.endpoint
        if spec.adapter_type == "python_code" and not endpoint:
            from app.shared.integrations.python_parser import parse_python_example
            python_code = prepared_request.extra_params.get("python_code", "")
            parsed_info = parse_python_example(python_code)
            endpoint = parsed_info.get("endpoint", "")
            if not endpoint:
                raise ValidationError("无法从Python代码中提取API endpoint")
        
        self._log(f"提交任务：model={spec.model_name}, endpoint={endpoint}")
        response = self.session.post(
            endpoint,
            headers=self._json_headers(),
            json=payload,
            timeout=120,
        )
        parsed = parse_json_response(response)
        if response.status_code != 200:
            raise RunningHubError(f"提交任务失败：HTTP {response.status_code} - {extract_error_message(response, parsed)}")
        if not parsed:
            raise RunningHubError("提交任务失败：接口未返回有效 JSON")
        task_id = str(parsed.get("taskId") or parsed.get("data", {}).get("taskId") or "").strip()
        if not task_id:
            raise RunningHubError(f"提交任务失败：未返回 taskId，响应内容：{parsed}")
        self._log(f"任务已提交，taskId={task_id}")
        return {"taskId": task_id, "response": parsed, "payload": payload, "endpoint": endpoint}

    def query_task(self, task_id: str, query_url: str = "") -> dict[str, Any]:
        if not task_id:
            raise ValidationError("task_id 不能为空")
        endpoint = (query_url or self.query_url or RUNNINGHUB_QUERY_URL).strip()
        response = self.session.post(
            endpoint,
            headers=self._json_headers(),
            json={"taskId": task_id},
            timeout=60,
        )
        parsed = parse_json_response(response)
        if response.status_code != 200:
            raise RunningHubError(f"查询任务失败：HTTP {response.status_code} - {extract_error_message(response, parsed)}")
        if not parsed:
            raise RunningHubError("查询任务失败：接口未返回有效 JSON")
        return parsed

    def wait_for_task(
        self,
        task_id: str,
        query_url: str = "",
        *,
        interval: int = RUNNINGHUB_POLL_INTERVAL_SECONDS,
        timeout: int = RUNNINGHUB_POLL_INTERVAL_SECONDS * RUNNINGHUB_MAX_POLL_ROUNDS,
    ) -> dict[str, Any]:
        started_at = time.time()
        last_status = ""
        while time.time() - started_at <= timeout:
            result = self.query_task(task_id, query_url=query_url)
            status = str(result.get("status") or result.get("data", {}).get("status") or "").upper()
            if status and status != last_status:
                self._log(f"轮询状态：{status}")
            last_status = status
            if status == "SUCCESS":
                return result
            if status == "FAILED":
                raise TaskFailedError(
                    str(result.get("errorMessage") or result.get("message") or result.get("data", {}).get("message") or "RunningHub 任务失败")
                )
            if status not in {"QUEUED", "RUNNING"}:
                raise RunningHubError(f"未知任务状态：{status or result}")
            time.sleep(max(1, interval))
        raise TaskTimeoutError(f"RunningHub 任务轮询超时：taskId={task_id}")

    def prepare_image_urls(self, images: list[str], spec: ModelSpec | None = None) -> list[str]:
        prepared: list[str] = []
        for item in images:
            value = str(item or "").strip()
            if not value:
                continue
            if value.startswith(("http://", "https://", "data:image/")):
                prepared.append(value)
                continue
            path = Path(value)
            if not path.exists():
                raise UploadError(f"找不到本地图片：{value}")
            if spec and path.stat().st_size > spec.image_size_limit:
                raise UploadError(f"图片超过大小限制：{path.name}")
            prepared.append(self.upload_file(path))
        if not prepared:
            raise ValidationError("至少需要一张输入图片")
        return prepared

    def upload_file(self, file_path: str | Path) -> str:
        path = Path(file_path)
        if not path.exists():
            raise UploadError(f"找不到本地图片：{path}")
        self._log(f"上传图片：{path.name}")
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        with path.open("rb") as file_handle:
            response = self.session.post(
                self.upload_url,
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": (path.name, file_handle, mime_type)},
                timeout=120,
            )
        parsed = parse_json_response(response)
        if response.status_code != 200:
            raise UploadError(f"上传图片失败：HTTP {response.status_code} - {extract_error_message(response, parsed)}")
        if not parsed:
            raise UploadError("上传图片失败：接口未返回有效 JSON")
        data = parsed.get("data") or {}
        download_url = str(data.get("download_url") or data.get("downloadUrl") or "").strip()
        if not download_url:
            raise UploadError(f"上传图片成功但未返回 download_url：{parsed}")
        return download_url

    def validate_request(self, request: UnifiedImageRequest) -> None:
        spec = get_model_spec(resolve_model_name(request.model, request.endpoint_override), request.extra_params)
        ADAPTERS[spec.adapter_type].validate(request, spec)

    def _json_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _log(self, message: str) -> None:
        if self.log:
            self.log(message)
        else:
            print(message)


def build_unified_request_payload(request: UnifiedImageRequest) -> dict[str, Any]:
    return asdict(request)


def make_unified_request(data: dict[str, Any]) -> UnifiedImageRequest:
    return UnifiedImageRequest(
        model=str(data.get("model") or "").strip(),
        prompt=str(data.get("prompt") or "").strip(),
        images=[str(item).strip() for item in data.get("images") or [] if str(item).strip()],
        resolution=str(data.get("resolution") or "").strip(),
        aspect_ratio=str(data.get("aspect_ratio") or "").strip(),
        width=_parse_int(data.get("width")),
        height=_parse_int(data.get("height")),
        size=str(data.get("size") or "").strip(),
        quality=str(data.get("quality") or "").strip(),
        input_fidelity=str(data.get("input_fidelity") or "").strip(),
        sequential_image_generation=str(data.get("sequential_image_generation") or "").strip(),
        max_images=_parse_int(data.get("max_images")),
        webhook_url=str(data.get("webhook_url") or "").strip(),
        extra_params=data.get("extra_params") if isinstance(data.get("extra_params"), dict) else {},
        endpoint_override=str(data.get("image_api_url") or "").strip(),
        query_url=str(data.get("query_url") or "").strip(),
    )


def _parse_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"无法解析整数参数：{value}")


def encode_image_as_data_uri(path: Path) -> str:
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime_type};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def upload_data_uri_candidates(data_uri: str, filename: str, api_key: str) -> list[tuple[str, str]]:
    mime_type, payload = decode_data_uri(data_uri)
    client = RunningHubClient(api_key=api_key)
    suffix = mimetypes.guess_extension(mime_type) or Path(filename).suffix or ".png"
    temp_name = filename if Path(filename).suffix else f"{filename}{suffix}"
    return [("download_url", _upload_binary(client, payload, temp_name, mime_type)), ("data_uri", data_uri)]


def upload_image_candidates(path: Path, api_key: str) -> list[tuple[str, str]]:
    client = RunningHubClient(api_key=api_key)
    return [("download_url", client.upload_file(path)), ("data_uri", encode_image_as_data_uri(path))]


def _upload_binary(client: RunningHubClient, payload: bytes, filename: str, mime_type: str) -> str:
    with requests.Session() as session:
        response = session.post(
            client.upload_url,
            headers={"Authorization": f"Bearer {client.api_key}"},
            files={"file": (filename, payload, mime_type)},
            timeout=120,
        )
    parsed = parse_json_response(response)
    if response.status_code != 200:
        raise UploadError(f"上传图片失败：HTTP {response.status_code} - {extract_error_message(response, parsed)}")
    data = (parsed or {}).get("data") or {}
    download_url = str(data.get("download_url") or data.get("downloadUrl") or "").strip()
    if not download_url:
        raise UploadError("上传图片成功但未返回 download_url")
    return download_url
