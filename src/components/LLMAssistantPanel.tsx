import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  FileCode,
  FilePlus,
  ArrowRight,
  Check,
  Copy,
  BookOpen,
  Cpu,
  Trash2,
  RotateCcw,
  Zap,
  Info,
  Settings
} from 'lucide-react';
import { LLMAction, LLMMessage, LLMStatus } from '../types/llm';
import { FileItem, WorkspaceState } from '../types/latex';

interface LLMAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeFile?: FileItem;
  activeFileContent: string;
  workspace: WorkspaceState;
  cursorLine?: number;
  selection?: string;
  onApplyCode: (code: string, mode: 'replace' | 'insert') => void;
  onCreateFile: (path: string, content: string) => void;
  onUpdateFile: (path: string, content: string) => void;
  onDeleteFile: (path: string) => void;
  onSwitchFile: (path: string) => void;
  onOpenDocModal: () => void;
}

export const LLMAssistantPanel: React.FC<LLMAssistantPanelProps> = ({
  isOpen,
  onClose,
  activeFile,
  activeFileContent,
  workspace,
  cursorLine = 1,
  selection = '',
  onApplyCode,
  onCreateFile,
  onUpdateFile,
  onDeleteFile,
  onSwitchFile,
  onOpenDocModal,
}) => {
  const [messages, setMessages] = useState<LLMMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '您好！我是内置的大语言模型 LaTeX 助手。我具备**直接修改编辑区代码**与**操作工作区文件系统**的能力。\n\n您可以点击下方快捷指令或直接输入自然语言，例如：\n- *“在当前光标处插入一个对比三线表”*\n- *“新建 sections/experiments.tex 并引入实验论述”*\n- *“修复当前文件的语法与环境错误”*',
      timestamp: Date.now(),
      status: 'success',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const [copiedActionIndex, setCopiedActionIndex] = useState<string | null>(null);

  // Model settings states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('deepseek');
  const [selectedModel, setSelectedModel] = useState<string>('deepseek-chat');
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [customBaseUrlInput, setCustomBaseUrlInput] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Check LLM endpoint status on mount
  useEffect(() => {
    fetch('/api/llm/status')
      .then((res) => res.json())
      .then((data: LLMStatus) => {
        setLlmStatus(data);
        if (data.provider) setSelectedProvider(data.provider);
        if (data.model) setSelectedModel(data.model);
      })
      .catch((err) => console.error('Failed to get LLM status:', err));
  }, []);

  // Poll for external Antigravity Agent dispatched actions
  useEffect(() => {
    const timer = setInterval(() => {
      fetch('/api/llm/pending-actions')
        .then((res) => res.json())
        .then((data: { actions: any[] }) => {
          if (data && data.actions && data.actions.length > 0) {
            data.actions.forEach((act) => {
              if (act.type === 'write_editor') {
                onApplyCode(act.content || '', act.mode === 'append' ? 'insert' : 'replace');
              } else if (act.type === 'insert_code') {
                onApplyCode(act.content || '', 'insert');
              } else if (act.type === 'create_file') {
                if (act.target) onCreateFile(act.target, act.content || '');
              } else if (act.type === 'update_file') {
                if (act.target) onUpdateFile(act.target, act.content || '');
              } else if (act.type === 'delete_file') {
                if (act.target) onDeleteFile(act.target);
              } else if (act.type === 'switch_file') {
                if (act.target) onSwitchFile(act.target);
              }

              setMessages((prev) => [
                ...prev,
                {
                  id: `ext-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  role: 'assistant',
                  content: `🤖 **[Antigravity 协同同步]**\n已执行来自 Antigravity IDE 的动作：\`${act.description || act.type}\``,
                  timestamp: Date.now(),
                  status: 'success',
                  model: 'Antigravity Live Bridge',
                },
              ]);
            });
          }
        })
        .catch(() => {});
    }, 1500);

    return () => clearInterval(timer);
  }, [onApplyCode, onCreateFile, onUpdateFile, onDeleteFile, onSwitchFile]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const res = await fetch('/api/llm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          apiKey: customKeyInput || undefined,
          baseUrl: customBaseUrlInput || undefined,
        }),
      });
      if (res.ok) {
        const statusRes = await fetch('/api/llm/status');
        const updatedStatus = await statusRes.json();
        setLlmStatus(updatedStatus);
        setIsSettingsOpen(false);
      }
    } catch (e) {
      console.error('Failed to update config:', e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedActionIndex(id);
    setTimeout(() => setCopiedActionIndex(null), 2000);
  };

  const executeAction = (action: LLMAction, msgId: string, actionIndex: number) => {
    if (action.type === 'write_editor') {
      onApplyCode(action.content || '', action.mode === 'append' ? 'insert' : 'replace');
    } else if (action.type === 'insert_code') {
      onApplyCode(action.content || '', 'insert');
    } else if (action.type === 'create_file') {
      if (action.target) {
        onCreateFile(action.target, action.content || '');
      }
    } else if (action.type === 'update_file') {
      if (action.target) {
        onUpdateFile(action.target, action.content || '');
      }
    } else if (action.type === 'delete_file') {
      if (action.target) {
        onDeleteFile(action.target);
      }
    } else if (action.type === 'switch_file') {
      if (action.target) {
        onSwitchFile(action.target);
      }
    }

    // Mark as applied in state
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.actions) {
          const updated = [...msg.actions];
          updated[actionIndex] = { ...updated[actionIndex], applied: true };
          return { ...msg, actions: updated };
        }
        return msg;
      })
    );
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || inputPrompt).trim();
    if (!promptToSend || isLoading) return;

    setInputPrompt('');

    const userMsg: LLMMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Build context files list
    const filesList = Object.values(workspace.files).map((f) => ({
      name: f.name,
      path: f.path,
      type: f.type,
    }));

    try {
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          provider: selectedProvider,
          model: selectedModel,
          context: {
            activeFileName: activeFile?.name || 'main.tex',
            activeFileContent: activeFileContent,
            cursorLine,
            selection,
            filesList,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败: HTTP ${response.status}`);
      }

      const data = await response.json();
      const assistantMsgId = `assistant-${Date.now()}`;
      const actions: LLMAction[] = Array.isArray(data.actions)
        ? data.actions.map((a: any) => ({ ...a, applied: false }))
        : [];

      const assistantMsg: LLMMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: data.reply || '已处理完毕。',
        actions,
        model: data.model || 'gemini-3.8-flash',
        status: data.status || 'success',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If auto-apply is enabled, execute the actions automatically
      if (autoApply && actions.length > 0) {
        actions.forEach((act, idx) => {
          executeAction(act, assistantMsgId, idx);
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `调用出现错误: ${err.message || '网络连接或服务异常'}`,
          timestamp: Date.now(),
          status: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Built-in Writing Skills mapped to Agent Skills
  const [activeSkillCategory, setActiveSkillCategory] = useState<string>('all');

  const skillCategories = [
    { id: 'all', label: '全部技能' },
    { id: 'tac', label: '🎯 TAC专栏' },
    { id: 'structure', label: '🏛️ 架构' },
    { id: 'math', label: '📐 公式' },
    { id: 'figures', label: '📊 图表' },
    { id: 'polishing', label: '✍️ 润色' },
    { id: 'bib', label: '📚 文献' },
  ];

  const writingSkills = [
    // 🎯 IEEE TAC 权威控制论写作规范
    {
      category: 'tac',
      label: '🎯 提炼主论题 (P0/C1-C4)',
      prompt: '/tac-thesis 提炼论文唯一的控制主论题 P0 (针对何种系统、通过何种关键结构、克服何种瓶颈并在何种明确范围内达到何种最强结论)，并构建 C1-C4 论证依赖图',
    },
    {
      category: 'tac',
      label: '📖 TAC 引言漏斗与因果链',
      prompt: '/tac-intro-distill 按照 IEEE TAC 控制论文规范重构引言：遵循“控制问题 -> 精确瓶颈 -> 核心控制对象 -> 理论性质 -> 闭环保证”因果链',
    },
    {
      category: 'tac',
      label: '📐 定理任务与李雅普诺夫证明',
      prompt: '/tac-theorem-story 梳理主定理论证链条：明确定理所需前置假设、消耗的数学引理、李雅普诺夫分析证明与下游闭环保证',
    },
    {
      category: 'tac',
      label: '🔍 符号首见性与方程审计',
      prompt: '/tac-notation-audit 严审全篇公式与符号首见性：确保每个符号首次出现时定义类型、值域、维度、单位与时标',
    },
    {
      category: 'tac',
      label: '🛡️ 消除过度防御弱语气',
      prompt: '/tac-assertive 消除论文中“we do not claim”、“this does not imply”等反复自我防御式弱语气，改写为精准、客观断言',
    },
    {
      category: 'tac',
      label: '📋 IEEE TAC 深度审稿',
      prompt: '/tac-review 依据 IEEE TAC 严格标准对当前稿件进行全方位审稿，输出主论题闭环、定理完整性、实验证据分级与修改建议',
    },
    // 🏛️ 论文架构
    {
      category: 'structure',
      label: '🏛️ 规划分章节工程',
      prompt: '根据顶刊标准规范，为当前论文规划并创建 sections/ 模块化子章节文件树（引言、相关工作、方法论、实验与结论）',
    },
    {
      category: 'structure',
      label: '🎯 提炼贡献三段式',
      prompt: '在引言章节结尾根据当前研究总结三条具有学术说服力与不可替代性的核心贡献点条目（Contributions）',
    },
    // 📐 公式定理
    {
      category: 'math',
      label: '📐 插入定理与证明',
      prompt: '在当前光标处插入一个严密的收敛性定理（Theorem）与李雅普诺夫分析证明（Proof）标准数学环境',
    },
    {
      category: 'math',
      label: '⚡ 状态方程推导',
      prompt: '推导并插入带有微分算子、时变缩放增益与向量范数界的多行对齐公式环境',
    },
    // 📊 图表设计
    {
      category: 'figures',
      label: '📊 顶刊三线表 (Booktabs)',
      prompt: '在当前光标处插入符合顶刊标准的三线表（包含性能对比、均值方差指标、跨列对齐与加粗最优值）',
    },
    {
      category: 'figures',
      label: '🎨 TikZ 架构图代码',
      prompt: '在当前位置生成一个基于 TikZ 的矢量闭环控制系统拓扑架构图代码',
    },
    {
      category: 'figures',
      label: '📝 算法伪代码 (Algorithm)',
      prompt: '在当前位置生成一个包含输入、输出、循环迭代与条件分支的 algorithm 算法伪代码环境',
    },
    // ✍️ 学术润色
    {
      category: 'polishing',
      label: '✍️ 润色去 AI 痕迹',
      prompt: '深度润色当前选中的学术段落，消除 AI 机械特征词与否定对仗八股句式，强化因果论证逻辑链条',
    },
    {
      category: 'polishing',
      label: '🔍 排查微排版暗坑',
      prompt: '审查当前代码中的不可断行空格 ~、数学公式末尾标点符号、英文反引号 `` 和公式溢出问题',
    },
    // 📚 文献管理
    {
      category: 'bib',
      label: '📚 补充前沿 BibTeX',
      prompt: '新建或补充 references.bib，添加 3 条相关研究领域的权威顶刊/顶会论文条目，并用花括号保护专有名词大小写',
    },
    {
      category: 'bib',
      label: '🔗 优化文内引用句式',
      prompt: '在当前段落中插入规范的直接名词性引用与作者主语式引用（使用 ~\\cite{}）',
    },
  ];

  const filteredSkills = useMemo(() => {
    if (activeSkillCategory === 'all') return writingSkills;
    return writingSkills.filter(s => s.category === activeSkillCategory);
  }, [activeSkillCategory]);

  if (!isOpen) return null;

  return (
    <div className="w-80 md:w-96 bg-white border-l border-slate-200 flex flex-col h-full z-10 shrink-0 select-none shadow-lg">
      {/* Top Header */}
      <div className="h-11 px-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline gap-1.5 truncate max-w-[150px]">
            <span className="font-bold text-xs tracking-tight text-white shrink-0">AI 助手</span>
            <span
              className="text-[10px] text-emerald-400 font-mono truncate"
              title={llmStatus?.configured ? `${llmStatus.provider}: ${llmStatus.model}` : 'Antigravity 协同'}
            >
              {llmStatus?.configured
                ? `${llmStatus.provider === 'antigravity' ? 'Antigravity' : llmStatus.provider === 'deepseek' ? 'DeepSeek' : llmStatus.provider === 'siliconflow' ? '硅基流动' : 'Gemini'}`
                : 'Antigravity'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="配置大语言模型服务商与参数"
            className={`p-1 rounded transition-colors text-xs flex items-center gap-1 ${
              isSettingsOpen ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">模型</span>
          </button>
          <button
            type="button"
            onClick={onOpenDocModal}
            title="查看大语言模型交互接口与说明文档"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors text-xs flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] hidden sm:inline">文档</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Settings Drawer */}
      {isSettingsOpen && (
        <div className="bg-slate-900 border-b border-slate-700 p-3 text-white space-y-2.5 shadow-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              模型与服务商配置
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                (selectedProvider === 'antigravity' || llmStatus?.providers?.find((p) => p.id === selectedProvider)?.configured)
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {(selectedProvider === 'antigravity' || llmStatus?.providers?.find((p) => p.id === selectedProvider)?.configured)
                ? '● 已就绪'
                : '○ 需配置Key'}
            </span>
          </div>

          {selectedProvider === 'antigravity' && (
            <div className="text-[11px] leading-relaxed text-indigo-200 bg-indigo-950/80 border border-indigo-700/80 p-2 rounded">
              <span className="font-semibold text-emerald-400">✓ Antigravity 智能协同已就绪</span>
              <p className="mt-0.5 text-[10px] text-slate-300">
                已自动桥接至当前 IDE 工作区，开箱即用。若输入自定义 Google Gemini API Key 则直连官方 SDK。
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 block">服务提供商</label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                const prov = e.target.value;
                setSelectedProvider(prov);
                const provInfo = llmStatus?.providers?.find((p) => p.id === prov);
                if (provInfo && provInfo.models.length > 0) {
                  setSelectedModel(provInfo.models[0]);
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {llmStatus?.providers?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.configured ? '✓' : '(需配置Key)'}
                </option>
              )) || (
                <>
                  <option value="antigravity">Google Antigravity ✓</option>
                  <option value="deepseek">DeepSeek 官方 API ✓</option>
                  <option value="siliconflow">硅基流动 (SiliconFlow) ✓</option>
                  <option value="custom">自定义 OpenAI 兼容</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 block">模型名称</label>
            {selectedProvider === 'custom' ? (
              <input
                type="text"
                placeholder="例如: llama3, qwen2.5"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {llmStatus?.providers
                  ?.find((p) => p.id === selectedProvider)
                  ?.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  )) || <option value={selectedModel}>{selectedModel}</option>}
              </select>
            )}
          </div>

          {selectedProvider === 'custom' && (
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 block">Base URL</label>
              <input
                type="text"
                placeholder="http://localhost:11434/v1"
                value={customBaseUrlInput}
                onChange={(e) => setCustomBaseUrlInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 block">
              自定义 API Key <span className="text-slate-400 font-normal">(覆盖系统默认)</span>
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={customKeyInput}
              onChange={(e) => setCustomKeyInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="px-2.5 py-1 text-[11px] text-slate-300 hover:text-white rounded transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              disabled={isSavingConfig}
              onClick={handleSaveConfig}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1 shadow-xs"
            >
              {isSavingConfig && <Loader2 className="w-3 h-3 animate-spin" />}
              应用并切换
            </button>
          </div>
        </div>
      )}

      {/* Connection & Context Status Pill */}
      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              llmStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="font-mono text-slate-600 truncate max-w-[130px]">
            {activeFile?.name || 'main.tex'} : L{cursorLine}
          </span>
        </div>

        <label className="flex items-center gap-1 text-[11px] cursor-pointer hover:text-slate-800">
          <input
            type="checkbox"
            checked={autoApply}
            onChange={(e) => setAutoApply(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-0 w-3 h-3"
          />
          <span>自动应用改动</span>
        </label>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Sender bubble */}
            <div
              className={`max-w-[92%] rounded-xl px-3 py-2 leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : msg.status === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-slate-100/90 text-slate-800 border border-slate-200/70'
              }`}
            >
              <div className="whitespace-pre-wrap select-text">{msg.content}</div>

              {/* Model Tag */}
              {msg.model && msg.role === 'assistant' && (
                <div className="mt-1 text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" />
                  {msg.model}
                </div>
              )}
            </div>

            {/* Action Cards (Direct code writes, file operations) */}
            {msg.actions && msg.actions.length > 0 && (
              <div className="w-full mt-2 space-y-2">
                {msg.actions.map((action, actionIdx) => {
                  const cardKey = `${msg.id}-${actionIdx}`;
                  return (
                    <div
                      key={cardKey}
                      className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-2.5 space-y-2 text-xs transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          {action.type === 'create_file' ? (
                            <FilePlus className="w-3.5 h-3.5 text-blue-600" />
                          ) : action.type === 'insert_code' ? (
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                          <span className="text-[11px]">
                            {action.description ||
                              (action.type === 'create_file'
                                ? `创建文件: ${action.target}`
                                : action.type === 'insert_code'
                                ? '光标处插入代码'
                                : '全量替换编辑区代码')}
                          </span>
                        </div>

                        {action.applied ? (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> 已应用
                          </span>
                        ) : null}
                      </div>

                      {/* Code preview block */}
                      {action.content && (
                        <div className="relative group">
                          <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[10px] font-mono max-h-36 overflow-y-auto whitespace-pre select-text">
                            {action.content}
                          </pre>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(action.content || '', cardKey)}
                            title="复制代码"
                            className="absolute top-1.5 right-1.5 p-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[10px] opacity-80 group-hover:opacity-100 transition-opacity"
                          >
                            {copiedActionIndex === cardKey ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Execution button */}
                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        <button
                          type="button"
                          disabled={action.applied}
                          onClick={() => executeAction(action, msg.id, actionIdx)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded flex items-center gap-1 transition-colors ${
                            action.applied
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                          }`}
                        >
                          {action.applied ? (
                            <>已执行写入</>
                          ) : action.type === 'create_file' ? (
                            <>
                              创建并挂载文件 <ArrowRight className="w-3 h-3" />
                            </>
                          ) : action.type === 'insert_code' ? (
                            <>
                              插入到光标处 <ArrowRight className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              应用到编辑区 <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-500 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Gemini 3.8 正在思考并生成 LaTeX 代码与操作动作...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Writing Skills & Categories Toolbar */}
      <div className="border-t border-slate-200 bg-slate-50/90 shrink-0 flex flex-col gap-1.5 p-2">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {skillCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveSkillCategory(cat.id)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                activeSkillCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-200/80 hover:bg-slate-300 text-slate-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Skill Action Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {filteredSkills.map((sk: { category: string; label: string; prompt: string }, idx: number) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(sk.prompt)}
              title={sk.prompt}
              className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-700 rounded text-[11px] whitespace-nowrap transition-all shadow-2xs hover:border-indigo-300"
            >
              {sk.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-2.5 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="输入指令 (如：在光标处插入三线表，或新建章节)..."
            rows={2}
            className="w-full text-xs p-2 pr-9 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-sans"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="absolute right-2 bottom-2 p-1.5 rounded-md bg-indigo-600 text-white disabled:bg-slate-300 disabled:text-slate-100 hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>Enter 发送，Shift + Enter 换行</span>
          <button
            type="button"
            onClick={onOpenDocModal}
            className="text-indigo-600 hover:underline flex items-center gap-0.5"
          >
            <Info className="w-2.5 h-2.5" /> 说明文档
          </button>
        </div>
      </div>
    </div>
  );
};
