import { Template } from '../types/latex';

export const TEMPLATES: Template[] = [
  {
    id: 'academic-paper',
    name: '学术研究论文 (Academic Paper)',
    description: '标准期刊/会议论文格式，含数学公式推导、表格、定理证明、多文件分章节与参考文献引用。',
    badge: '推荐',
    mainFile: 'main.tex',
    files: {
      'main.tex': {
        name: 'main.tex',
        type: 'tex',
        content: `\\documentclass[11pt, a4paper]{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}

\\title{量子计算与机器学习优化算法的研究与实践}
\\author{张明远 \\and 李华 \\and 王建国}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
本文针对高维非凸优化问题中的收敛效率瓶颈，提出了一种基于量子变分算法（VQE）的混合优化范式。我们给出了算法收敛性的严格理论证明，并在高维非线性测试函数集与经典手写数字识别基准上进行了系统性实验验证。实验结果表明，该方法在加速梯度下降收敛速率方面相较于传统SGD与Adam优化器提升了37.5\\%，并在复杂势能曲面中表现出卓越的鞍点逃逸能力。
\\end{abstract}

\\section{引言}
\\label{sec:intro}
随着量子计算硬件与变分量子线路的快速迭代，量子辅助机器学习在复杂优化、拓扑量子态表征等前沿领域展现出巨大潜力\\cite{nielsen2010quantum}。传统梯度下降法在遇到高维多峰复杂损失曲面时，极易陷入局部最优或缓慢的平台期\\footnote{在高维非凸空间中，鞍点的数量随维度呈指数级增长。}。

本文的核心贡献总结如下：
\\begin{itemize}
  \\item 形式化提出了基于参数化量子线路的混合自适应步长更新准则；
  \\item 在数学上证明了损失函数期望梯度估计的无偏性与方差上界；
  \\item 构建了完整的收敛性定理并在标准评测集上进行了全面对比评测。
\\end{itemize}

\\input{sections/methodology.tex}

\\section{理论证明与收敛性分析}
\\label{sec:theory}
为了严格保证算法在任意紧致流形上的稳定性，我们给出核心收敛定理。

\\begin{theorem}[量子变分梯度的收敛性]
\\label{thm:convergence}
设目标损失函数 $f: \\mathbb{R}^d \\to \\mathbb{R}$ 满足 $L$-Lipschitz 平滑条件，且量子测量噪声方差有界 $\\sigma^2 < \\infty$。对于任意初始点 $\\theta_0$，当学习率 $\\eta_t$ 满足 Robbins-Monro 条件时：
\\begin{equation}
\\lim_{T \\to \\infty} \\frac{1}{T} \\sum_{t=1}^{T} \\mathbb{E}\\left[ \\| \\nabla f(\\theta_t) \\|^2 \\right] = 0
\\label{eq:bound}
\\end{equation}
即优化路径以概率 1 收敛至临界点。
\\end{theorem}

\\begin{proof}
考虑单步李雅普诺夫势能函数的差分：
\\begin{align*}
\\mathbb{E}[f(\\theta_{t+1}) - f(\\theta_t) \\mid \\theta_t] &\\le \\langle \\nabla f(\\theta_t), \\mathbb{E}[\\Delta \\theta_t] \\rangle + \\frac{L}{2} \\mathbb{E}[\\| \\Delta \\theta_t \\|^2] \\\\
&\\le -\\eta_t \\| \\nabla f(\\theta_t) \\|^2 + \\frac{L \\eta_t^2}{2} (\\| \\nabla f(\\theta_t) \\|^2 + \\sigma^2)
\\end{align*}
当选取 $\\eta_t < \\frac{2}{L}$ 时，递推求和两端并取极限即得证式 (\\ref{eq:bound})。
\\end{proof}

\\section{实验评估与数值对比}
\\label{sec:experiments}
我们在不同量子比特深度（$N=4, 8, 16$）与经典基准网络上进行了多组对照实验。如表 \\ref{tbl:performance} 所示，本文提出的算法在收敛轮数与最终准确率上均具有显著优势。

\\begin{table}[htbp]
\\centering
\\caption{不同优化算法在 MNIST 与 CIFAR-10 数据集上的性能对比评测}
\\label{tbl:performance}
\\begin{tabular}{lcccc}
\\hline
优化算法 & 学习率 $\\eta$ & 收敛Epoch数 & 最终准确率 (\\%) & 运行时间 (s) \\\\
\\hline
SGD + Momentum & 0.01 & 85 & 94.2 & 142.5 \\\\
Adam & 0.001 & 62 & 97.1 & 186.2 \\\\
RMSProp & 0.002 & 70 & 96.5 & 174.0 \\\\
\\textbf{Ours (Hybrid VQE)} & 0.005 & \\textbf{38} & \\textbf{98.8} & 165.4 \\\\
\\hline
\\end{tabular}
\\end{table}

\\section{结论}
本文探讨了量子计算与深度学习优化的深度结合。理论证明与数值实验表明，该机制在非凸几何结构中具有优异的逃逸性能，为下一代大规模量子优化提供了可靠理论支撑。

\\begin{thebibliography}{99}
\\bibitem{nielsen2010quantum}
Nielsen, M. A., & Chuang, I. L. (2010). \\textit{Quantum Computation and Quantum Information}. Cambridge University Press.
\\bibitem{preskill2018quantum}
Preskill, J. (2018). Quantum Computing in the NISQ era and beyond. \\textit{Quantum}, 2, 79.
\\bibitem{kingma2014adam}
Kingma, D. P., & Ba, J. (2014). Adam: A method for stochastic optimization. \\textit{arXiv preprint arXiv:1412.6980}.
\\end{thebibliography}

\\end{document}
`,
      },
      'sections/methodology.tex': {
        name: 'methodology.tex',
        type: 'tex',
        content: `\\section{方法论与量子变分线路构建}
\\label{sec:methodology}
在本节中，我们介绍核心算法框架。优化器的目标是最小化参数化哈密顿量在量子态下的期望值：
\\begin{equation}
\\mathcal{L}(\\theta) = \\langle 0 | U^{\\dagger}(\\theta) H U(\\theta) | 0 \\rangle = \\mathrm{Tr}\\left( H \\rho(\\theta) \\right)
\\label{eq:hamiltonian}
\\end{equation}
其中 $U(\\theta) = \\prod_{l=1}^{L} \\exp(-i \\theta_l P_l)$ 代表由单比特旋转门与两比特 CNOT 纠缠门构成的多层酉变换。

参数梯度的解析形式可通过参数位移法则（Parameter-Shift Rule）精确计算，无需借助数值差分：
\\begin{equation}
\\frac{\\partial \\mathcal{L}}{\\partial \\theta_i} = \\frac{1}{2} \\left[ \\mathcal{L}\\left(\\theta + \\frac{\\pi}{2} e_i\\right) - \\mathcal{L}\\left(\\theta - \\frac{\\pi}{2} e_i\\right) \\right]
\\label{eq:param_shift}
\\end{equation}
通过这一无偏梯度估计器，反向传播误差得以精确映射至量子比特纠缠网络。
`,
      },
      'references.bib': {
        name: 'references.bib',
        type: 'bib',
        content: `@book{nielsen2010quantum,
  title={Quantum Computation and Quantum Information},
  author={Nielsen, Michael A and Chuang, Isaac L},
  year={2010},
  publisher={Cambridge University Press}
}

@article{preskill2018quantum,
  title={Quantum Computing in the NISQ era and beyond},
  author={Preskill, John},
  journal={Quantum},
  volume={2},
  pages={79},
  year={2018}
}
`,
      },
    },
  },
  {
    id: 'math-notes',
    name: '高等数学与公式速查 (Math Notes)',
    description: '涵盖微积分、线性代数、概率统计的经典公式汇总与美观的排版案例。',
    badge: '公式丰富',
    mainFile: 'main.tex',
    files: {
      'main.tex': {
        name: 'main.tex',
        type: 'tex',
        content: `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}

\\title{现代应用数学公式精选与速查手册}
\\author{数学与计算科学系}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{微积分与积分变换}
\\subsection{多元微积分基础}
梯度、散度与旋度在三维笛卡尔坐标系中的微分算子定义：
\\begin{align*}
\\nabla f &= \\left( \\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}, \\frac{\\partial f}{\\partial z} \\right) \\\\
\\nabla \\cdot \\mathbf{F} &= \\frac{\\partial F_x}{\\partial x} + \\frac{\\partial F_y}{\\partial y} + \\frac{\\partial F_z}{\\partial z} \\\\
\\nabla \\times \\mathbf{F} &= \\begin{vmatrix}
\\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\
\\frac{\\partial}{\\partial x} & \\frac{\\partial}{\\partial y} & \\frac{\\partial}{\\partial z} \\\\
F_x & F_y & F_z
\\end{vmatrix}
\\end{align*}

经典高斯散度定理与斯托克斯公式：
\\begin{equation}
\\iiint_{V} (\\nabla \\cdot \\mathbf{F}) \\, dV = \\iint_{\\partial V} (\\mathbf{F} \\cdot \\mathbf{n}) \\, dS
\\end{equation}

\\subsection{高斯积分与欧拉公式}
极其优美的高斯积分推导结果：
\\begin{equation}
\\int_{-\\infty}^{+\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}, \\quad e^{i\\pi} + 1 = 0
\\end{equation}

\\section{线性代数与矩阵分解}
\\subsection{奇异值分解 (SVD)}
设任意实矩阵 $A \\in \\mathbb{R}^{m \\times n}$，则存在正交矩阵 $U, V$ 使得：
\\begin{equation}
A = U \\Sigma V^T = \\sum_{i=1}^{r} \\sigma_i u_i v_i^T
\\end{equation}
其中奇异值满足 $\\sigma_1 \\ge \\sigma_2 \\ge \\dots \\ge \\sigma_r > 0$。

\\subsection{常用矩阵形式}
协方差矩阵与二次型表示：
\\begin{equation}
\\mathbf{X} = \\begin{pmatrix}
x_{11} & x_{12} & \\dots & x_{1n} \\\\
x_{21} & x_{22} & \\dots & x_{2n} \\\\
\\vdots & \\vdots & \\ddots & \\vdots \\\\
x_{m1} & x_{m2} & \\dots & x_{mn}
\\end{pmatrix}, \\quad f(\\mathbf{x}) = \\mathbf{x}^T \\mathbf{A} \\mathbf{x}
\\end{equation}

\\section{概率论与信息论}
\\subsection{连续型贝叶斯定理}
\\begin{equation}
p(\\theta \\mid x) = \\frac{p(x \\mid \\theta) p(\\theta)}{\\int p(x \\mid \\theta') p(\\theta') \\, d\\theta'}
\\end{equation}

\\subsection{相对熵 (KL 散度)}
两概率分布 $P$ 与 $Q$ 之间的 Kullback-Leibler 散度定义：
\\begin{equation}
D_{\\mathrm{KL}}(P \\parallel Q) = \\int_{-\\infty}^{+\\infty} p(x) \\ln \\left( \\frac{p(x)}{q(x)} \\right) dx \\ge 0
\\end{equation}

\\end{document}
`,
      },
    },
  },
  {
    id: 'lab-report',
    name: '物理与工程实验报告 (Lab Report)',
    description: '适用于高校理工科实验报告，包含实验目的、仪器设备、测量数据表、误差分析与结论。',
    badge: '实用工程',
    mainFile: 'main.tex',
    files: {
      'main.tex': {
        name: 'main.tex',
        type: 'tex',
        content: `\\documentclass[a4paper,11pt]{article}
\\usepackage{amsmath}
\\usepackage{booktabs}

\\title{大学物理实验报告：利用迈克尔逊干涉仪测定激光波长}
\\author{实验者：陈立新 \\and 班级：物理学 2201 \\and 学号：202203102}
\\date{实验日期：2026年3月18日}

\\begin{document}
\\maketitle

\\section{实验目的}
\\begin{enumerate}
  \\item 熟悉迈克尔逊干涉仪的光路结构与调节使用方法；
  \\item 观测氦氖（He-Ne）激光产生的等倾与等厚干涉条纹；
  \\item 测定 He-Ne 激光的波长 $\\lambda$，并完成测量不确定度评定。
\\end{enumerate}

\\section{实验原理}
根据两束相干光的光程差公式，当移动动反射镜 $M_1$ 距离 $\\Delta d$ 时，中心干涉条纹吞吐的数目为 $N$。则待测激光波长计算公式为：
\\begin{equation}
\\lambda = \\frac{2 \\Delta d}{N}
\\end{equation}

\\section{实验测量数据记录}
室温：$20.5^\\circ\\mathrm{C}$，相对湿度：$48\\%$。微调测微螺旋，记录条纹移动数 $N=100$ 时的动镜位移：

\\begin{table}[htbp]
\\centering
\\caption{微动台位移与干涉条纹计数测量数据}
\\begin{tabular}{ccccc}
\\hline
测量序号 & 起始读数 $d_0$ (mm) & 终止读数 $d_1$ (mm) & 位移量 $\\Delta d$ (mm) & 计算波长 $\\lambda$ (nm) \\\\
\\hline
1 & 10.2350 & 10.2665 & 0.0315 & 630.0 \\\\
2 & 10.2665 & 10.2982 & 0.0317 & 634.0 \\\\
3 & 10.2982 & 10.3298 & 0.0316 & 632.0 \\\\
4 & 10.3298 & 10.3615 & 0.0317 & 634.0 \\\\
5 & 10.3615 & 10.3931 & 0.0316 & 632.0 \\\\
\\hline
\\textbf{平均值} & - & - & \\textbf{0.03162} & \\textbf{632.4} \\\\
\\hline
\\end{tabular}
\\end{table}

\\section{不确定度分析与结果讨论}
氦氖激光器标称波长为 $\\lambda_0 = 632.8\\,\\mathrm{nm}$。
实验测量平均值 $\\bar{\\lambda} = 632.4\\,\\mathrm{nm}$，相对误差为：
\\begin{equation}
E_r = \\frac{|632.4 - 632.8|}{632.8} \\times 100\\% = 0.063\\%
\\end{equation}
误差主要来源为测微螺旋空回误差及条纹吞吐计数过程中的人眼视觉暂留误差。实验整体测量精度极高，符合预期。

\\end{document}
`,
      },
    },
  },
  {
    id: 'academic-cv',
    name: '学术简历与履历 (Academic CV)',
    description: '清晰大方的学术履历模板，罗列教育背景、发表成果、研究方向与科研项目。',
    badge: '求职申请',
    mainFile: 'main.tex',
    files: {
      'main.tex': {
        name: 'main.tex',
        type: 'tex',
        content: `\\documentclass{article}

\\title{个人简历 - 陆知远 (Curriculum Vitae)}
\\author{邮箱：zhiyuan.lu@university.edu \\quad 电话：(+86) 138-0000-8888 \\quad 个人主页：scholar.lu.org}
\\date{}

\\begin{document}
\\maketitle

\\section{个人简介与研究兴趣}
计算机科学与技术专业博士生，主要研究方向为自然语言处理（NLP）、大语言模型对齐（RLHF）以及高效推理加速。在国际顶级学术会议（ACL, NeurIPS, ICML）发表第一作者学术论文多篇。

\\section{教育背景}
\\begin{itemize}
  \\item \\textbf{清华大学} \\quad 计算机科学与技术系 \\quad 工学博士在读 (2023 - 至今)
  \\item \\textbf{浙江大学} \\quad 计算机科学与技术学院 \\quad 工学学士 (2019 - 2023, GPA: 3.92/4.00, 班级排名前 2\\%)
\\end{itemize}

\\section{代表性学术论文 (Selected Publications)}
\\begin{enumerate}
  \\item \\textbf{Zhiyuan Lu}, et al. \\textit{"Parameter-Efficient Fine-Tuning of 100B+ LLMs via Dynamic Low-Rank Kernels"}. In Proceedings of \\textbf{NeurIPS 2025} (Oral).
  \\item \\textbf{Zhiyuan Lu}, et al. \\textit{"Robust Alignment in the Presence of Adversarial Noise"}. In Proceedings of \\textbf{ACL 2024}.
  \\item Hongyu Chen, \\textbf{Zhiyuan Lu}, et al. \\textit{"Survey on Quantum Error Mitigation for Near-Term Devices"}. \\textbf{IEEE Transactions on Quantum Engineering}, 2024.
\\end{enumerate}

\\section{科研项目经历}
\\begin{itemize}
  \\item \\textbf{国家自然科学基金重点项目：基于稀疏注意力机制的高性能推理系统} (2024 - 2026) \\\\
  \\textit{核心研发人员}：重构了 FlashAttention 显存优化算子，在 8 卡 A100 集群上实现了 2.4 倍吞吐提升。
  \\item \\textbf{开源大模型生态工具集构建} (2023 - 2024) \\\\
  GitHub 累计斩获 12,000+ Stars，被国际多家科研机构广泛用于基准评测。
\\end{itemize}

\\section{技能特长与荣誉奖励}
\\begin{itemize}
  \\item \\textbf{编程语言与框架}：Python, C++, PyTorch, CUDA, Triton, LaTeX, Git
  \\item \\textbf{所获荣誉}：国家奖学金 (2024)、CCF 优秀大学生奖 (2023)、ACM-ICPC 区域赛金牌 (2022)
\\end{itemize}

\\end{document}
`,
      },
    },
  },
  {
    id: 'minimal',
    name: '空白极简模板 (Minimal)',
    description: '最简短的 LaTeX 入门框架，适合自由创作或快速演算。',
    badge: '空白草稿',
    mainFile: 'main.tex',
    files: {
      'main.tex': {
        name: 'main.tex',
        type: 'tex',
        content: `\\documentclass{article}
\\usepackage{amsmath}

\\title{我的 LaTeX 笔记本}
\\author{作者}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{第一章：起步}
欢迎使用本地实时预览 LaTeX 编辑器！

在此处自由输入文本和数学公式：
例如爱因斯坦质能方程 $E = mc^2$，或者展示型微分方程：
\\begin{equation}
i\\hbar \\frac{\\partial}{\\partial t} \\Psi(\\mathbf{r}, t) = \\left[ -\\frac{\\hbar^2}{2m} \\nabla^2 + V(\\mathbf{r}, t) \\right] \\Psi(\\mathbf{r}, t)
\\end{equation}

\\end{document}
`,
      },
    },
  },
];
