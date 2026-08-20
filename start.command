#!/usr/bin/env bash
# macOS 双击启动: 打开 Terminal 运行 start.sh 并保持窗口
cd "$(dirname "$0")"
exec ./start.sh "$@"
