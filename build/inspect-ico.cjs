// 自检: 解析 .ico 验证结构规范 (目录字段 / BMP 头 / 数据长度 / PNG magic)
const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);
const count = buf.readUInt16LE(4);
console.log(`entries=${count}`);
let ok = true;
let off = 6 + 16 * count;
for (let i = 0; i < count; i++) {
  const o = 6 + i * 16;
  const w = buf.readUInt8(o), h = buf.readUInt8(o + 1);
  const planes = buf.readUInt16LE(o + 4), bpp = buf.readUInt16LE(o + 6);
  const len = buf.readUInt32LE(o + 8), start = buf.readUInt32LE(o + 12);
  const isPng = buf[start] === 0x89 && buf[start + 1] === 0x50 && buf[start + 2] === 0x4e && buf[start + 3] === 0x47;
  let desc = '';
  if (isPng) {
    desc = `PNG ${buf.readUInt32LE(start + 16)}x${buf.readUInt32LE(start + 20)}`;
  } else {
    const biW = buf.readInt32LE(start + 4), biH = buf.readInt32LE(start + 8);
    const mask = Math.ceil(biW / 32) * 4 * (biH / 2);
    const expect = 40 + biW * (biH / 2) * 4 + mask;
    desc = `BMP ${biW}x${biH / 2} biHeight=${biH}(应为${biW * 2}) len=${len} expect=${expect} ${len === expect && biH === biW * 2 ? 'OK' : 'BAD'}`;
    if (len !== expect || biH !== biW * 2) ok = false;
  }
  console.log(`  #${i} ${w || 256}x${h || 256} planes=${planes} bpp=${bpp} @${start} ${desc}`);
  if (start !== off) { console.log(`  !!! offset 错位: 目录声明 ${start}, 实际 ${off}`); ok = false; }
  off += len;
}
console.log(ok && off === buf.length ? 'PASS: 结构规范' : `FAIL: 总长 ${buf.length}, 计算得 ${off}`);
process.exit(ok ? 0 : 1);
