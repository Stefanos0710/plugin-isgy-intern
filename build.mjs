// Builds installable packages: node build.mjs  (Node >= 18, no dependencies)
// dist/chromium/ + .zip → Chrome, Edge, Brave, Opera, Vivaldi, Arc …
// dist/firefox/  + .zip → Firefox
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const FILES = ['manifest.json', 'options.html', 'options.js', 'src', 'lib', 'icons'];
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

const targets = {
  chromium: (m) => m,
  firefox: (m) => {
    // Firefox MV3: no service worker (event page instead), needs an add-on id, uses options_ui.
    const { background, options_page, ...rest } = m;
    return {
      ...rest,
      background: { scripts: [background.service_worker] },
      options_ui: { page: options_page, open_in_tab: true },
      browser_specific_settings: { gecko: { id: 'isgy-intern-plus@stefanos0710.github.io', strict_min_version: '121.0', data_collection_permissions: { required: ['none'] } } },
    };
  },
};

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(dir) {
  const entries = [];
  (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : entries.push(p); } })(dir);
  const parts = [], central = [];
  let offset = 0;
  for (const p of entries) {
    const name = Buffer.from(relative(dir, p).replaceAll('\\', '/'));
    const raw = readFileSync(p), data = deflateRawSync(raw), crc = crc32(raw);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(raw.length, 22); head.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    parts.push(head, name, data);
    offset += 30 + name.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, end]);
}

// Only clear build output, never dist/signed (signed .xpi files can't be recreated without a new Mozilla signing).
for (const f of ['chromium', 'firefox']) rmSync(join('dist', f), { recursive: true, force: true });
for (const f of existsSync('dist') ? readdirSync('dist') : []) if (f.endsWith('.zip')) rmSync(join('dist', f));
for (const [name, tweak] of Object.entries(targets)) {
  const out = join('dist', name);
  mkdirSync(out, { recursive: true });
  for (const f of FILES) cpSync(f, join(out, f), { recursive: true });
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(tweak(manifest), null, 2));
  const zipPath = join('dist', `isgy-intern-plus-${manifest.version}-${name}.zip`);
  writeFileSync(zipPath, zip(out));
  console.log(`✓ ${out}/  and  ${zipPath}`);
}
