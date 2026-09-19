import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  Terminal,
  FileCode,
  Copy,
  Check,
  X,
  Sparkles,
  Zap,
  ExternalLink,
  Cpu
} from 'lucide-react';

interface LLMDocModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LLMDocModal: React.FC<LLMDocModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'protocol' | 'examples'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const curlExample = `curl -X POST http://localhost:3000/api/llm/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "在当前光标处插入一个比较 ResNet 与 ViT 准确率的标准学术三线表",
    "context": {
      "activeFileName": "main.tex",
      "cursorLine": 45
    }
  }'`;

  const pythonExample = `import requests

url = "http://localhost:3000/api/llm/chat"
payload = {
    "prompt": "新建一个 sections/methods.tex，编写关于自注意力机制的数学推导",
    "context": {
        "activeFileName": "main.tex",
        "cursorLine": 12
    }
}

response = requests.post(url, json=payload)
data = response.json()
print("自然语言回复:", data["reply"])
for action in data.get("actions", []):
    print(f"触发动作: {action['type']} -> 目标: {action.get('target')}")`;

  const schemaExample = `{
  "reply": "已为您生成学术三线表...",
  "actions": [
    {
      "type": "insert_code",
      "target": "active",
      "content": "\\\\begin{table}[htbp]...\\\\end{table}",
      "mode": "insert",
      "description": "在光标处插入模型指标对比三线表"
    },
    {
      "type": "create_file",
      "target": "sections/experiment.tex",
      "content": "\\\\section{实验分析}...",
      "description": "新建子章节文件"
    }
  ]
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                大语言模型 (LLM) 交互接口与说明文档
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                支持大语言模型直接写入编辑区、插入公式表格及文件系统自动化管理
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            架构与功能概述
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'api'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            REST API 接口规范
          </button>
          <button
            onClick={() => setActiveTab('protocol')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'protocol'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            动作协议 (Action Schema)
          </button>
          <button
            onClick={() => setActiveTab('examples')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'examples'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            cURL / Python 调用示例
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-600 leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4">
                <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  双通道协同设计 (Dual-Channel Architecture)
                </h4>
                <p className="text-slate-700">
                  本系统在服务端封装了完整的 Gemini 大语言模型网关。大模型生成的结果不仅包含针对用户的自然语言学术讲解（推导依据、使用建议），还同时输出强类型的结构化操作动作列表（Actions）。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-emerald-600" />
                    1. 直接写入编辑区
                  </h4>
                  <p className="text-slate-600">
                    支持将大模型生成的 LaTeX 代码一键写入当前代码编辑区。可以选择<strong>「完全替换当前文件」</strong>（如代码重构、全文档纠错）或<strong>「光标处精准插入」</strong>（如插入三线表、公式环境或算法伪代码）。
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-blue-600" />
                    2. 自动化工程文件操作
                  </h4>
                  <p className="text-slate-600">
                    大模型能够根据论文结构规划新建子文件（如 <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">sections/method.tex</code>、<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">references.bib</code>），并在工作区文件树中自动挂载与切换。
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-slate-900">上下文感知机制 (Context Injection)</h4>
                <p>
                  每次用户发送指令时，客户端会自动收集并上传如下上下文：
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>当前文件名</strong> (如 <code>main.tex</code>) 与代码全文。</li>
                  <li><strong>光标行号位置</strong> (行级插入感知)。</li>
                  <li><strong>当前选中文本</strong> (便于针对局部段落进行学术润色或公式替换)。</li>
                  <li><strong>现有文件目录树</strong> (便于模型在拆分章节或引入 <code>\input&#123;&#125;</code> 时精准引用路径)。</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 font-mono font-bold text-xs flex items-center justify-between text-slate-800 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold text-[10px]">POST</span>
                    <span>/api/llm/chat</span>
                  </div>
                  <span className="text-slate-500 font-sans font-normal text-[11px]">大语言模型核心交互接口</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h5 className="font-bold text-slate-800 mb-1">请求格式 (Content-Type: application/json)：</h5>
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
{`{
  "prompt": "string (必填) - 用户自然语言指令",
  "context": {
    "activeFileName": "string - 当前打开文件名，例如 main.tex",
    "activeFileContent": "string - 当前编辑区 LaTeX 代码全文",
    "cursorLine": "number - 当前光标所在行号",
    "selection": "string - 当前选中的代码文本",
    "filesList": "Array - 当前工作区文件列表"
  },
  "instruction": "string (可选) - 额外的系统指令"
}`}
                    </pre>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 mb-1">响应格式：</h5>
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
{`{
  "reply": "string - 大模型的自然语言回复与学术讲解",
  "actions": "Array<LLMAction> - 需要执行的编辑区写入及文件操作动作",
  "model": "gemini-3.8-flash",
  "status": "success"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 font-mono font-bold text-xs flex items-center justify-between text-slate-800 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-semibold text-[10px]">GET</span>
                    <span>/api/llm/status</span>
                  </div>
                  <span className="text-slate-500 font-sans font-normal text-[11px]">查询 LLM 连接与配置状态</span>
                </div>
                <div className="p-4 text-slate-600">
                  返回包含是否配置 <code>GEMINI_API_KEY</code>、当前模型名称以及所支持动作类型。
                </div>
              </div>
            </div>
          )}

          {activeTab === 'protocol' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                大语言模型在 <code>actions</code> 字段中返回以下 6 种标准原子动作，前端解释器会无缝映射为实际的编辑器写入与文件树更新：
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3 font-semibold">动作类型 (type)</th>
                      <th className="py-2.5 px-3 font-semibold">目标 (target)</th>
                      <th className="py-2.5 px-3 font-semibold">模式 (mode)</th>
                      <th className="py-2.5 px-3 font-semibold">具体作用说明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-indigo-600">write_editor</td>
                      <td className="py-2.5 px-3">active</td>
                      <td className="py-2.5 px-3">replace / append</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">全量重写或重构当前文件中的所有 LaTeX 源码。</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-emerald-600">insert_code</td>
                      <td className="py-2.5 px-3">active</td>
                      <td className="py-2.5 px-3">insert</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">在当前光标行精准插入生成的公式、表格或环境代码片段。</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-blue-600">create_file</td>
                      <td className="py-2.5 px-3">路径 (如 sections/exp.tex)</td>
                      <td className="py-2.5 px-3">replace</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">在工作区创建新文件，并自动填充大模型撰写的代码。</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-amber-600">update_file</td>
                      <td className="py-2.5 px-3">目标文件路径</td>
                      <td className="py-2.5 px-3">replace</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">修改指定已有文件（即使当前没有在主编辑区打开）。</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-red-600">delete_file</td>
                      <td className="py-2.5 px-3">目标文件路径</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">从工程文件树中删除指定冗余文件。</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-purple-600">switch_file</td>
                      <td className="py-2.5 px-3">文件名或路径</td>
                      <td className="py-2.5 px-3">-</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">将主编辑区当前激活文件切换至该目标。</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h5 className="font-bold text-slate-800 mb-1.5">JSON Action 范例：</h5>
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                    {schemaExample}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(schemaExample, 'schema')}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="复制 JSON"
                  >
                    {copiedKey === 'schema' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'examples' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-indigo-600" />
                    cURL 快速调用示例
                  </h4>
                  <button
                    onClick={() => copyToClipboard(curlExample, 'curl')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    复制代码
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {curlExample}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-600" />
                    Python 自动化脚本示例
                  </h4>
                  <button
                    onClick={() => copyToClipboard(pythonExample, 'python')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    复制代码
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {pythonExample}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <a
            href="/docs/LLM_API_GUIDE.md"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            在新标签页中打开完整 Markdown 文档
          </a>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            完成阅读
          </button>
        </div>
      </div>
    </div>
  );
};
