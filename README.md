# LoRA Training Toolkit

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey?style=flat-square)

`LoRA Training Toolkit` 是一个面向 AI 训练与图像流程管理的一站式工具箱，覆盖环境初始化、模型下载、素材管理、AI 批量生成、AI 图片清洗和控制台监控。

## 核心能力

| 模块 | 说明                                                      |
| --- |---------------------------------------------------------|
| 环境初始化 | 自动准备 Python、Node.js 与项目依赖，兼容 Windows、Linux 与 AutoDL 场景。 |
| 模型下载 | 支持从 ModelScope 和 HuggingFace 下载模型，并自动整理目录。              |
| 图像管理 | 支持上传、筛选、批量重命名、删除与导出素材图片。                                |
| AI 批量生成 | 基于 RunningHub 接口执行图生图批量生成。                              |
| AI 图片清洗 | 调用多平台大模型读取图片并产出结构化标签，便于筛选和后续训练。                         |
| 控制台监控 | 实时展示环境安装、模型下载、AI 生成和 AI 清洗的状态与日志。                       |

## 运行要求

- Python 3.9+
- Node.js 20+

## 启动方式

Windows、Linux 与 AutoDL 环境都可以直接运行：

```powershell
python app.py
```

服务启动后，默认访问地址为：

```text
http://localhost:6008
```