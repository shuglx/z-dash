#!/usr/bin/env bash
# macOS double-click entry: open Terminal, run start.sh, keep window open
cd "$(dirname "$0")"
exec ./start.sh "$@"
