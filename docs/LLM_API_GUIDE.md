# LaTeX Editor 大语言模型 (LLM) 交互接口与工作区自动化说明文档

本文档详细介绍了本 LaTeX 编辑器提供的大语言模型（LLM）集成接口、动作通信协议（Action Protocol）、文件系统自动化操作机制以及外部 HTTP/cURL 调用示例。

> v0.1.0 release note: the gateway supports configurable provider integrations, including the bundled Gemini path, DeepSeek, SiliconFlow, and a custom OpenAI-compatible endpoint. Check the running service status for the actually configured provider. Model-specific examples in this document are illustrative, not a promise that a provider, a model, or an output is available or correct.
>
> Treat every proposed file action as a reviewable change. Do not send credentials, unpublished papers, or sensitive data to an external provider without assessing its data policy.

---

## 目录
1. [架构概述](#1-架构概述)
2. [核心功能特性](#2-核心功能特性)
3. [REST API 接口规范](#3-rest-api-接口规范)
   - [3.1 对话与代码动作分发 (POST /api/llm/chat)](#31-对话与代码动作分发-post-apillmchat)
   - [3.2 运行状态与能力查询 (GET /api/llm/status)](#32-运行状态与能力查询-get-apillmstatus)
   - [3.3 协议 Schema 规范 (GET /api/llm/schema)](#33-协议-schema-规范-get-apillmschema)
4. [大语言模型动作协议 (Actions Protocol)](#4-大语言模型动作协议-actions-protocol)
5. [外部调用示例 (cURL / Python / Node.js)](#5-外部调用示例-curl--python--nodejs)
6. [Web 界面 AI 助手交互指南](#6-web-界面-ai-助手交互指南)

---

## 1. 架构概述

本编辑器采用了 **全栈架构 (Full-Stack Express + Vite + Gemini 3.8 Flash)**：
- **服务端网关 (`server.ts`)**：安全封装 `@google/genai` 官方 SDK，严格将 `GEMINI_API_KEY` 保留在服务端容器内部，提供标准 RESTful JSON 端点。
- **结构化输出引擎**：大模型使用 `gemini-3.8-flash` 并开启 `responseMimeType: "application/json"`，输出符合预定 Schema 的双通道内容：
  1. **学术解析通道 (`reply`)**：自然语言讲解、公式推导、修改动机说明。
  2. **代码动作通道 (`actions`)**：强类型的结构化操作指令，用于直接操控前端编辑区与工程文件树。
- **前端实时执行引擎 (`LLMAssistantPanel.tsx`)**：接收动作指令后，支持实时语法着色、代码预览、单步执行、一键应用或自动合并。

---

## 2. 核心功能特性

1. **直接写入编辑区 (`write_editor` / `insert_code`)**：
   - 支持全量替换当前打开文件内容（用于模板重构或整体纠错）。
   - 支持在当前光标位置或选区精准插入公式、表格、算法环境。
2. **便捷的文件系统操作 (`create_file` / `update_file` / `delete_file`)**：
   - 大模型可自主决定创建多文件论文结构（如 `sections/methodology.tex`、`references.bib`、`macros.sty`）。
   - 自动在工作区中挂载新文件并刷新文件树导航。
3. **主动感知编辑区上下文**：
   - 接口每次请求自动携带当前文件名、完整代码、光标行号、选中文本以及文件树清单，使大模型具备精确的工程级全局视野。
4. **离线与无 Key 智能降级保障**：
   - 当尚未配置外部 `GEMINI_API_KEY` 时，服务端内置规则引擎，仍能智能匹配三线表、公式生成与文件创建演示。

---

## 3. REST API 接口规范

### 3.1 对话与代码动作分发 (POST /api/llm/chat)

向大语言模型发送自然语言需求，附带当前工作区上下文，返回自然语言回复及前端可执行的指令。

- **URL**: `/api/llm/chat`
- **Method**: `POST`
- **Content-Type**: `application/json`

#### 请求参数 (Request Body)

```json
{
  "prompt": "在当前光标处插入一个比较 Transformer 与 CNN 准确率的三线表",
  "context": {
    "activeFileName": "main.tex",
    "activeFileContent": "\\documentclass{article}\n\\begin{document}\n...",
    "cursorLine": 45,
    "selection": "",
    "filesList": [
      { "name": "main.tex", "path": "main.tex", "type": "tex" },
      { "name": "refs.bib", "path": "refs.bib", "type": "bib" }
    ]
  },
  "instruction": "请严格使用 booktabs 风格宏包，列宽居中"
}
```

#### 响应结果 (Response Body)

```json
{
  "reply": "已为您生成学术标准三线表，包含方法名称、参数量、Top-1 准确率与推断延迟对比，已配置好 \\caption 与 \\label 交叉引用标签。",
  "actions": [
    {
      "type": "insert_code",
      "target": "active",
      "content": "\\begin{table}[htbp]\n  \\centering\n  \\caption{模型性能综合指标对比}\n  \\label{tbl:performance}\n  \\begin{tabular}{lccc}\n    \\toprule\n    架构类型 & 参数量 (M) & Top-1 Acc (\\%) & 延迟 (ms) \\\\\n    \\midrule\n    ResNet-50 & 25.6 & 76.15 & 12.4 \\\\\n    ViT-B/16 & 86.4 & 81.80 & 28.6 \\\\\n    \\textbf{Ours} & \\textbf{42.1} & \\textbf{83.52} & \\textbf{16.8} \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}",
      "mode": "insert",
      "description": "在光标处插入模型指标对比三线表"
    }
  ],
  "model": "gemini-3.8-flash",
  "status": "success"
}
```

---

### 3.2 运行状态与能力查询 (GET /api/llm/status)

- **URL**: `/api/llm/status`
- **Method**: `GET`

#### 响应示例:
```json
{
  "configured": true,
  "model": "gemini-3.8-flash",
  "supportedActions": [
    "write_editor",
    "insert_code",
    "create_file",
    "update_file",
    "delete_file",
    "switch_file"
  ],
  "documentationUrl": "/docs/LLM_API_GUIDE.md"
}
```

---

### 3.3 协议 Schema 规范 (GET /api/llm/schema)

返回大语言模型通信规范定义元数据，供智能体或自动化集成工具直接读取校验。

- **URL**: `/api/llm/schema`
- **Method**: `GET`

---

## 4. 大语言模型动作协议 (Actions Protocol)

每个动作对象 (`LLMAction`) 包含如下字段：

| 动作类型 (`type`) | 作用目标 (`target`) | 模式 (`mode`) | 说明 |
| :--- | :--- | :--- | :--- |
| `write_editor` | `"active"` 或文件名 | `"replace"` \| `"append"` | 将代码全量写入当前或指定编辑文件 |
| `insert_code` | `"active"` | `"insert"` | 在当前光标所在行或选区处精准插入代码 |
| `create_file` | 相对文件路径 (如 `sections/exp.tex`) | `"replace"` | 在工作区新建指定文件并写入初始代码 |
| `update_file` | 相对文件路径 (如 `references.bib`) | `"replace"` \| `"append"` | 覆盖或追加内容至指定工程文件 |
| `delete_file` | 相对文件路径 | - | 从工程文件树中删除指定文件 |
| `switch_file` | 文件名或路径 | - | 切换当前主编辑区打开的文件 |

---

## 5. 外部调用示例 (cURL / Python / Node.js)

### cURL 示例

```bash
# 1. 检查 LLM 服务接口连通性
curl -X GET http://localhost:3000/api/llm/status

# 2. 引导大语言模型编写学术内容并生成写入动作
curl -X POST http://localhost:3000/api/llm/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "写一个基于 PyTorch 的多头自注意力计算公式，并附带文字说明",
    "context": {
      "activeFileName": "main.tex",
      "cursorLine": 20
    }
  }'
```

### Python 自动化脚本示例

```python
import requests

ENDPOINT = "http://localhost:3000/api/llm/chat"

payload = {
    "prompt": "新建一个 sections/related_work.tex，并总结 3 篇经典深度学习文献",
    "context": {
        "activeFileName": "main.tex",
        "filesList": [{"name": "main.tex", "path": "main.tex"}]
    }
}

response = requests.post(ENDPOINT, json=payload)
data = response.json()

print("LLM 说明:", data["reply"])
for action in data.get("actions", []):
    print(f"触发动作: {action['type']} -> 目标: {action.get('target')}")
```

---

## 6. Web 界面 AI 助手交互指南

在编辑器顶部或侧边栏点击 **「AI 助手」** 按钮即可唤出交互面板：
1. **输入自然语言指令**：例如：
   - *“把这段中文学术翻译成地道英文，使用主动语态”*
   - *“在当前位置插入一个求解梯度下降的算法伪代码”*
   - *“为我新建 references.bib 并添加 Attention Is All You Need 的 BibTeX 条目”*
   - *“检查当前文件并修复花括号或环境不闭合的错误”*
2. **预览动作卡片**：
   - 助手返回的每个动作均会以醒目的卡片呈现，展示要修改的文件、操作类型及代码语法高亮。
3. **一键执行与应用**：
   - 点击 **「应用到编辑区」** 或 **「创建文件」**，系统将在毫秒内修改代码或同步文件系统。
   - 勾选 **「生成后自动应用」** 可让大模型完成回答后立即实施改动，体验丝滑无感。
4. **历史回滚保障**：
   - 所有的 AI 代码写入均受编辑器的历史记录（`Ctrl/Cmd + Z`）以及「版本快照」功能保护，随时可一键撤回。
