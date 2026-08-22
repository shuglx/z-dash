// 诊断: 解析 PE .rsrc 内嵌图标规格 (RT_ICON / RT_GROUP_ICON)
const fs = require('fs');
const file = process.argv[2];
const buf = fs.readFileSync(file);

const peOff = buf.readUInt32LE(0x3c);
if (buf.readUInt32LE(peOff) !== 0x00004550) throw new Error('not PE');
const numSections = buf.readUInt16LE(peOff + 6);
const optSize = buf.readUInt16LE(peOff + 20);
const secStart = peOff + 24 + optSize;
let rsrc = null;
for (let i = 0; i < numSections; i++) {
  const s = secStart + i * 40;
  const name = buf.toString('ascii', s, s + 8).replace(/\0+$/, '');
  if (name === '.rsrc') rsrc = { va: buf.readUInt32LE(s + 12), raw: buf.readUInt32LE(s + 20) };
}
if (!rsrc) { console.log('no .rsrc'); process.exit(0); }

function handle(path, off, size) {
  const type = path[0];
  if (type === 3) { // RT_ICON
    let desc;
    const isPng = buf[off] === 0x89 && buf[off + 1] === 0x50 && buf[off + 2] === 0x4e && buf[off + 3] === 0x47;
    if (isPng) {
      desc = `PNG ${buf.readUInt32BE(off + 16)}x${buf.readUInt32BE(off + 20)}`;
    } else {
      const w = buf.readInt32LE(off + 4);
      const h = buf.readInt32LE(off + 8) / 2;   // biHeight = 2x 实际高
      const bpp = buf.readUInt16LE(off + 14);
      const expectBytes = 40 + w * h * 4 + Math.ceil(w / 32) * 4 * h; // BMP+mask
      desc = `BMP ${w}x${h} ${bpp}bpp data=${size}B expect=${expectBytes}B ${size < expectBytes ? '<<< 数据不足(裁剪根源)' : 'OK'}`;
    }
    console.log(`RT_ICON id=${path[1]} bytes=${size} ${desc}`);
  } else if (type === 14) { // RT_GROUP_ICON
    const count = buf.readUInt16LE(off + 4);
    console.log(`RT_GROUP_ICON id=${path[1]} entries=${count}`);
    for (let i = 0; i < count; i++) {
      const e = off + 6 + i * 14;   // GRPICONDIRENTRY: 14 字节, nID 在 e+12
      const w = buf.readUInt8(e), h = buf.readUInt8(e + 1);
      const bytes = buf.readUInt32LE(e + 8);
      const id = buf.readUInt16LE(e + 12);
      console.log(`  -> ${w || 256}x${h || 256} bytes=${bytes} iconId=${id}`);
    }
  }
}

function walkDir(rel, path) {
  const base = rsrc.raw + rel;
  const named = buf.readUInt16LE(base + 12);
  const ided = buf.readUInt16LE(base + 14);
  for (let i = 0; i < named + ided; i++) {
    const e = base + 16 + i * 8;
    const nameOrId = buf.readUInt32LE(e);
    const off = buf.readUInt32LE(e + 4);
    const id = nameOrId & 0xffff;
    if (off & 0x80000000) walkDir(off & 0x7fffffff, path.concat(id));
    else {
      const leaf = rsrc.raw + off;
      const dataRva = buf.readUInt32LE(leaf);
      const size = buf.readUInt32LE(leaf + 4);
      handle(path, dataRva - rsrc.va + rsrc.raw, size);
    }
  }
}
walkDir(0, []);
