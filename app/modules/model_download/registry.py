MODEL_REGISTRY = [
    {
        "name": "FLUX.2-klein-base-9B",
        "desc": {"zh": "9B轻量极速全能模型", "en": "9B fast all-round model"},
        "featured": True,
        "sources": {
            "modelscope": 'modelscope download --model black-forest-labs/FLUX.2-klein-base-9B --local_dir "{target}"',
            "huggingface": 'huggingface-cli download black-forest-labs/FLUX.2-klein-base-9B --local-dir "{target}"',
        },
    },
    {
        "name": "FLUX.2-klein-base-4B",
        "desc": {"zh": "4B超轻量低显存模型", "en": "4B ultra-lightweight model"},
        "featured": False,
        "sources": {
            "modelscope": 'modelscope download --model black-forest-labs/FLUX.2-klein-base-4B --local_dir "{target}"',
            "huggingface": 'huggingface-cli download black-forest-labs/FLUX.2-klein-base-4B --local-dir "{target}"',
        },
    },
    {
        "name": "Qwen-Image-2512",
        "desc": {"zh": "高质量真实感生图", "en": "High-quality realistic generation"},
        "featured": False,
        "sources": {
            "modelscope": 'modelscope download --model Qwen/Qwen-Image-2512 --local_dir "{target}"',
            "huggingface": 'huggingface-cli download Qwen/Qwen-Image-2512 --local-dir "{target}"',
        },
    },
    {
        "name": "Z-Image",
        "desc": {"zh": "6B超写实双语生图", "en": "6B realistic bilingual gen"},
        "featured": True,
        "sources": {
            "modelscope": 'modelscope download --model Tongyi-MAI/Z-Image --local_dir "{target}"',
            "huggingface": 'huggingface-cli download Tongyi-MAI/Z-Image --local-dir "{target}"',
        },
    },
    {
        "name": "Qwen-Image-Edit-2511",
        "desc": {"zh": "精细化图像编辑模型", "en": "Precise image editing model"},
        "featured": True,
        "sources": {
            "modelscope": 'modelscope download --model Qwen/Qwen-Image-Edit-2511 --local_dir "{target}"',
            "huggingface": 'huggingface-cli download Qwen/Qwen-Image-Edit-2511 --local-dir "{target}"',
        },
    },
    {
        "name": "FLUX.2-dev",
        "desc": {"zh": "顶尖生图与编辑模型", "en": "Top-tier generation and editing"},
        "featured": True,
        "sources": {
            "modelscope": 'modelscope download --model black-forest-labs/FLUX.2-dev --local_dir "{target}"',
            "huggingface": 'huggingface-cli download black-forest-labs/FLUX.2-dev --local-dir "{target}"',
        },
    },
    {
        "name": "Qwen-Image-Edit-2509",
        "desc": {"zh": "稳定版图像编辑模型", "en": "Stable image editing model"},
        "featured": False,
        "sources": {
            "modelscope": 'modelscope download --model Qwen/Qwen-Image-Edit-2509 --local_dir "{target}"',
            "huggingface": 'huggingface-cli download Qwen/Qwen-Image-Edit-2509 --local-dir "{target}"',
        },
    },
    {
        "name": "FLUX.1-Kontext-dev",
        "desc": {"zh": "上下文理解与编辑", "en": "Contextual editing model"},
        "featured": False,
        "sources": {
            "modelscope": 'modelscope download --model black-forest-labs/FLUX.1-Kontext-dev --local_dir "{target}"',
            "huggingface": 'huggingface-cli download black-forest-labs/FLUX.1-Kontext-dev --local-dir "{target}"',
        },
    },
    {
        "name": "Qwen-Image-Edit",
        "desc": {"zh": "初代基础图像编辑", "en": "Basic image editing model"},
        "featured": False,
        "sources": {
            "modelscope": 'modelscope download --model Qwen/Qwen-Image-Edit --local_dir "{target}"',
            "huggingface": 'huggingface-cli download Qwen/Qwen-Image-Edit --local-dir "{target}"',
        },
    },
    {
        "name": "Qwen-Image",
        "desc": {"zh": "初代基础文本生图", "en": "Basic text-to-image model"},
        "featured": False,
        "sources": {
            "modelscope": 'modelscope download --model Qwen/Qwen-Image --local_dir "{target}"',
            "huggingface": 'huggingface-cli download Qwen/Qwen-Image --local-dir "{target}"',
        },
    },
]

DOWNLOAD_COMMANDS = {}
for model in MODEL_REGISTRY:
    for source, command in model["sources"].items():
        DOWNLOAD_COMMANDS.setdefault(source, {})[model["name"]] = command
