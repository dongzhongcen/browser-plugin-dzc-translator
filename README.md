# dzc's translator

<p align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/javascript-vanilla-yellow">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/chrome--extension-manifest%20v3-4285f4">
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blue">
  <img alt="MyMemory" src="https://img.shields.io/badge/translate-MyMemory-lightgrey">
  <img alt="OpenAI Compatible" src="https://img.shields.io/badge/llm-OpenAI--compatible-412991">
</p>

dzc's translator 是一个用于翻译网页选中文字或当前页面可见内容的 Chrome 扩展（Manifest V3）。项目目前实现了选中文字翻译、整页翻译（替换模式 / 双语对照模式）、默认的 MyMemory 免费翻译接口，以及可配置的 OpenAI-compatible 大模型翻译接口和译文缓存。

## 功能特性

- **选中文字翻译**：翻译网页上选中的文字（单次不超过 450 字符），以浮层显示原文和译文，并支持复制译文。
- **整页翻译**：收集当前页面可见的文本节点，支持「替换原文」和「双语对照」两种模式；批量翻译失败时自动回退为逐段翻译。
- **语言选择**：源语言和目标语言可选 English、中文、日本語、한국어、Français、Deutsch、Español。
- **MyMemory 免费接口**：默认翻译服务，无需配置。
- **OpenAI-compatible 大模型接口**：可在设置页配置 API Base URL、API Key、模型名称和 API 模式（Chat Completions 或 Responses API），并支持测试连接和恢复默认。
- **译文缓存**：按服务、模型、语言和原文缓存译文到 `chrome.storage.local`，重复翻译时直接返回。
- **扩展图标**：提供 16 / 32 / 48 / 128 多种尺寸图标，以及生成图标的 Python 脚本。

## 项目结构

```text
.
├── manifest.json             # Chrome 扩展清单（Manifest V3）
├── background.js             # Service Worker：翻译请求、批量翻译、缓存
├── content.js                # 内容脚本：收集页面文字、渲染译文和对照样式
├── popup.html / popup.js     # 扩展弹窗：语言选择、翻译操作、复制译文
├── options.html / options.js # 设置页：翻译服务与大模型参数
└── icons/                    # 扩展图标和 generate_icons.py 生成脚本
```

## 快速开始

### 环境要求

- Chrome 浏览器（或其他支持 Manifest V3 的 Chromium 浏览器）
- Python 3 与 Pillow（仅在重新生成图标时需要）

### 本地安装

1. 打开 Chrome，访问 `chrome://extensions`。
2. 开启「开发者模式」（Developer mode）。
3. 点击「加载已解压的扩展程序」（Load unpacked）。
4. 选择本项目目录。

修改文件后，在 `chrome://extensions` 中点击该扩展的「重新加载」（Reload）。

### 配置大模型翻译

打开扩展弹窗并点击「设置」，将翻译服务切换为 OpenAI-compatible 大模型接口后填写：

- `API Base URL`
- `API Key`
- `Model`
- `API Mode`：`Chat Completions` 或 `Responses API`

### 重新生成图标

```bash
python -m pip install Pillow
python icons/generate_icons.py
```

## 当前状态

项目已完成选中翻译、整页翻译、两种翻译服务和设置页等核心功能。后续可继续完善：

- 支持自动检测源语言
- 提供清理译文缓存的入口
- 支持一键还原整页翻译
- 增加更多目标语言
- 打包发布到 Chrome 应用商店

## 数据和敏感信息

不要把真实的 API Key 或私有代理地址提交到仓库。日志、临时文件、`*.zip` 打包产物、`.env` 系列文件和 `secrets.*` 已通过 `.gitignore` 排除。
