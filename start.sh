#!/usr/bin/env bash
# ============================================================
# Z-DASH 启动脚本 (macOS / Linux)
#   启动极简后端并自动打开浏览器
# 用法:  ./start.sh [端口]    # 默认 8000
# 若端口被占用, 用 ./start.sh 8001 换一个
# ============================================================
set -e

cd "$(dirname "$0")"

PORT="${1:-8000}"

# 校验 Node 可用
if ! command -v node >/dev/null 2>&1; then
  echo "错误: 未找到 node, 请先安装 Node.js 18+ (https://nodejs.org)"
  exit 1
fi

echo "==> 启动 Z-DASH 工作台后端 (node server.js $PORT)"
node server.js "$PORT" &
SERVER_PID=$!

# 等端口就绪后打开浏览器
sleep 1
if command -v open >/dev/null 2>&1; then
  open "http://localhost:${PORT}/"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:${PORT}/"
fi

echo "==> 工作台已运行: http://localhost:${PORT}/"
echo "==> 按 Ctrl+C 停止"
wait "$SERVER_PID"
