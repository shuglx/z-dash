#!/usr/bin/env node
/* ============================================================
   组装打包目录 build/stage/:
     桌面壳   build/main.js + build/package.json + build/icon.png
     站点本体 server.js + index.html + assets/ (从仓库根目录复制)
   之后在 build/stage 里 npm install && npx electron-builder 即可打包。
   data/ 等个人数据不会进入安装包。
   ============================================================ */
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(buildDir, '..');
const stage = path.join(buildDir, 'stage');

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

for (const f of ['main.js', 'package.json', 'icon.png', 'icon.ico']) {
  cpSync(path.join(buildDir, f), path.join(stage, f));
}
for (const f of ['server.js', 'index.html']) {
  cpSync(path.join(root, f), path.join(stage, f));
}
cpSync(path.join(root, 'assets'), path.join(stage, 'assets'), { recursive: true });

console.log('[prepare] 组装完成 ->', stage);
