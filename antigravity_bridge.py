"""
Antigravity IDE to LaTeX Editor Live Bridge
允许 Antigravity Agent、命令行脚本或自动化工具直接向运行中的 LaTeX Editor Web 界面分发代码写入与文件变更指令。
"""

import sys
import json
import argparse
import urllib.request
import urllib.error

ENDPOINT_EXECUTE = "http://127.0.0.1:3000/api/llm/execute"
ENDPOINT_STATUS = "http://127.0.0.1:3000/api/llm/status"
ENDPOINT_HEALTH = "http://127.0.0.1:3000/api/health"

def check_status():
    try:
        req = urllib.request.Request(ENDPOINT_STATUS)
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            print("[Antigravity Bridge] 状态正常:")
            print(f"- 当前配置引擎: {data.get('provider')} ({data.get('model')})")
            print(f"- 连通状态: {'已就绪' if data.get('configured') else '离线模式'}")
            return True
    except Exception as e:
        print(f"[Antigravity Bridge] 错误: 无法连接到 LaTeX Editor (http://127.0.0.1:3000): {e}")
        return False

def dispatch_action(action_type: str, content: str, target: str = "active", mode: str = "insert", description: str = ""):
    payload = {
        "source": "Antigravity Agent",
        "action": {
            "type": action_type,
            "target": target,
            "content": content,
            "mode": mode,
            "description": description or f"由 Antigravity 写入 {action_type}"
        }
    }
    try:
        req = urllib.request.Request(
            ENDPOINT_EXECUTE,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            res = json.loads(resp.read().decode())
            print(f"[Antigravity Bridge 成功] {res.get('message')}")
            return True
    except Exception as e:
        print(f"[Antigravity Bridge 失败] 动作发送失败: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Antigravity to LaTeX Editor Live Bridge CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Status
    subparsers.add_parser("status", help="检查 LaTeX 编辑器连通性")

    # Insert Code
    p_insert = subparsers.add_parser("insert", help="在当前光标位置插入代码")
    p_insert.add_argument("code", type=str, help="待插入的 LaTeX 代码")
    p_insert.add_argument("--desc", type=str, default="Antigravity 插入代码", help="操作说明")

    # Write Editor
    p_write = subparsers.add_parser("write", help="全量替换或追加当前编辑区代码")
    p_write.add_argument("code", type=str, help="LaTeX 代码")
    p_write.add_argument("--mode", choices=["replace", "append"], default="replace", help="写入模式")
    p_write.add_argument("--desc", type=str, default="Antigravity 写入代码", help="操作说明")

    # Create File
    p_create = subparsers.add_parser("create", help="在工作区创建新文件")
    p_create.add_argument("path", type=str, help="相对文件路径，例如 sections/exp.tex")
    p_create.add_argument("code", type=str, help="初始文件内容")
    p_create.add_argument("--desc", type=str, default="Antigravity 创建文件", help="操作说明")

    args = parser.parse_args()

    if args.command == "status" or not args.command:
        check_status()
    elif args.command == "insert":
        dispatch_action("insert_code", args.code, target="active", mode="insert", description=args.desc)
    elif args.command == "write":
        dispatch_action("write_editor", args.code, target="active", mode=args.mode, description=args.desc)
    elif args.command == "create":
        dispatch_action("create_file", args.code, target=args.path, mode="replace", description=args.desc)

if __name__ == "__main__":
    main()
