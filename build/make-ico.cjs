#!/usr/bin/env node
/* ============================================================
   生成标准多尺寸 icon.ico (16/24/32/48/64 为 32bpp BMP 条目, 256 为 PNG 条目)
   - BMP 条目: BITMAPINFOHEADER 的 biHeight = 2*h (XOR+AND), 行序自底向上, 尾带 AND 掩码
   - 用途: 替代 electron-builder(app-builder) 在 CI 上 PNG->ICO 的损坏转换,
     rcedit 对 .ico 直接嵌入不再转换, 规格可控
   用法: node build/make-ico.cjs <源图.jpg|png> <输出.ico>
   依赖: 仅 Node 内置 + PowerShell 无关 (像素渲染由调用方预先完成? )
   ------------------------------------------------------------
   实际实现: 本脚本只做字节拼装; 各尺寸的 32bpp BGRA 像素与 256 PNG 由
   gen-ico-sizes.ps1 渲染成 .bin/.png 后传入。
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const srcDir = process.argv[2];
const outFile = process.argv[3];
const SIZES = [16, 24, 32, 48, 64];

const entries = [];
// BMP 条目
for (const s of SIZES) {
  const pix = fs.readFileSync(path.join(srcDir, `s${s}.bin`)); // BGRA, 行序自顶向下
  const rowBytes = s * 4;
  const maskRow = Math.ceil(s / 32) * 4;
  const dataLen = 40 + s * rowBytes + maskRow * s;
  const data = Buffer.alloc(dataLen);
  data.writeUInt32LE(40, 0);            // biSize
  data.writeInt32LE(s, 4);              // biWidth
  data.writeInt32LE(s * 2, 8);          // biHeight = 2x (XOR+AND)
  data.writeUInt16LE(1, 12);            // biPlanes
  data.writeUInt16LE(32, 14);           // biBitCount
  data.writeUInt32LE(0, 16);            // BI_RGB
  data.writeUInt32LE(dataLen, 20);      // biSizeImage
  for (let y = 0; y < s; y++) {
    // BMP 行序自底向上: 从最后一行往前拷
    pix.copy(data, 40 + y * rowBytes, (s - 1 - y) * rowBytes, s * rowBytes);
  }
  // AND 掩码保持全 0 (alpha 通道生效), Buffer.alloc 已置零
  entries.push({ w: s, h: s, png: false, data });
}
// 256 PNG 条目
entries.push({ w: 256, h: 256, png: true, data: fs.readFileSync(path.join(srcDir, 's256.png')) });

// ICO 拼装
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);   // reserved
header.writeUInt16LE(1, 2);   // type: icon
header.writeUInt16LE(entries.length, 4);
const dir = Buffer.alloc(16 * entries.length);
let offset = 6 + dir.length;
entries.forEach((e, i) => {
  const o = i * 16;
  dir.writeUInt8(e.w === 256 ? 0 : e.w, o);        // 宽 (0 = 256)
  dir.writeUInt8(e.h === 256 ? 0 : e.h, o + 1);    // 高
  dir.writeUInt8(0, o + 2);                        // colorCount
  dir.writeUInt8(0, o + 3);                        // reserved
  dir.writeUInt16LE(1, o + 4);                     // planes
  dir.writeUInt16LE(32, o + 6);                    // bitCount
  dir.writeUInt32LE(e.data.length, o + 8);         // bytesInRes
  dir.writeUInt32LE(offset, o + 12);               // imageOffset
  offset += e.data.length;
});
fs.writeFileSync(outFile, Buffer.concat([header, dir, ...entries.map(e => e.data)]));
console.log(`[make-ico] ${outFile} <- ${entries.length} entries (${SIZES.join(',')} BMP + 256 PNG), ${offset} bytes`);
