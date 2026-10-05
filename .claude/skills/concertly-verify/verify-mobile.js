// Concertly mobil doğrulaması: değişen JS dosyalarını babel ile derler + TR/EN çeviri paritesi.
// Kullanım (mobile/ içinden): node ../.claude/skills/concertly-verify/verify-mobile.js [dosya...]
// Dosya verilmezse git'te değişen/yeni mobile/src/**/*.js dosyaları alınır.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mobileDir = process.cwd();
const babel = require(path.join(mobileDir, 'node_modules/@babel/core'));

let files = process.argv.slice(2);
if (files.length === 0) {
  const out = execSync('git status --porcelain -- src', { encoding: 'utf8' });
  files = out.split('\n')
    .map(l => l.slice(3).trim())
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace(/^mobile\//, ''));
}

let failed = 0;
for (const f of files) {
  if (!fs.existsSync(f)) continue; // silinmiş dosya
  try {
    babel.transformSync(fs.readFileSync(f, 'utf8'), { filename: f, presets: ['babel-preset-expo'] });
    console.log('OK  ', f);
  } catch (e) {
    failed++;
    console.log('FAIL', f, '\n    ', e.message.split('\n')[0]);
  }
}
if (files.length === 0) console.log('(değişen JS dosyası yok)');

const T = require(path.join(mobileDir, 'src/i18n/translations.js')).translations;
const tr = Object.keys(T.tr), en = Object.keys(T.en);
const missingEn = tr.filter(k => !(k in T.en));
const missingTr = en.filter(k => !(k in T.tr));
console.log(`Parite TR ${tr.length} / EN ${en.length}`);
if (missingEn.length) { failed++; console.log('  EN eksik:', missingEn.join(', ')); }
if (missingTr.length) { failed++; console.log('  TR eksik:', missingTr.join(', ')); }

console.log(failed ? `\nSONUÇ: ${failed} SORUN` : '\nSONUÇ: TEMİZ');
process.exit(failed ? 1 : 0);
