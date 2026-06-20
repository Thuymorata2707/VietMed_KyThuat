import { execFileSync } from 'node:child_process';
import path from 'node:path';

const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: node scripts/inspect-xlsx.mjs <file.xlsx> [...]');
  process.exit(1);
}

for (const file of files) {
  const workbook = readWorkbook(file);
  console.log(`\n=== ${file} ===`);
  for (const sheet of workbook.sheets) {
    const rows = readSheet(file, sheet.path, workbook.sharedStrings);
    const nonEmpty = rows.filter((row) => row.some((cell) => String(cell ?? '').trim()));
    console.log(`- ${sheet.name}: ${nonEmpty.length} non-empty rows (${sheet.path})`);
    for (const row of nonEmpty.slice(0, 8)) {
      console.log(`  ${JSON.stringify(row)}`);
    }
  }
}

function readWorkbook(file) {
  const workbookXml = unzipText(file, 'xl/workbook.xml');
  const relsXml = unzipText(file, 'xl/_rels/workbook.xml.rels');
  const sharedStrings = readSharedStrings(file);
  const rels = new Map();

  for (const rel of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = attrsOf(rel[1]);
    if (attrs.Id && attrs.Target) rels.set(attrs.Id, normalizeTarget(attrs.Target));
  }

  const sheets = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = attrsOf(match[1]);
    const relId = attrs['r:id'];
    const target = relId ? rels.get(relId) : '';
    if (attrs.name && target) sheets.push({ name: decodeXml(attrs.name), path: target });
  }

  return { sheets, sharedStrings };
}

function readSharedStrings(file) {
  try {
    const xml = unzipText(file, 'xl/sharedStrings.xml');
    return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => extractText(match[1]));
  } catch {
    return [];
  }
}

function readSheet(file, sheetPath, sharedStrings) {
  const xml = unzipText(file, sheetPath);
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = attrsOf(cellMatch[1]);
      const col = columnIndex(attrs.r || '');
      cells[col] = readCell(cellMatch[2], attrs, sharedStrings);
    }
    rows.push(trimTrailingEmpty(cells));
  }
  return rows;
}

function readCell(xml, attrs, sharedStrings) {
  if (attrs.t === 's') {
    const index = Number(firstTagValue(xml, 'v'));
    return sharedStrings[index] ?? '';
  }
  if (attrs.t === 'inlineStr') return extractText(xml);
  return decodeXml(firstTagValue(xml, 'v') || extractText(xml));
}

function unzipText(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
}

function attrsOf(input) {
  const attrs = {};
  for (const match of input.matchAll(/([:\w]+)="([^"]*)"/g)) attrs[match[1]] = decodeXml(match[2]);
  return attrs;
}

function extractText(xml) {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('');
}

function firstTagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1]) : '';
}

function columnIndex(ref) {
  const letters = (ref.match(/[A-Z]+/) || [''])[0];
  let value = 0;
  for (const char of letters) value = value * 26 + char.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function trimTrailingEmpty(cells) {
  let end = cells.length;
  while (end > 0 && !String(cells[end - 1] ?? '').trim()) end -= 1;
  return cells.slice(0, end).map((cell) => cell ?? '');
}

function normalizeTarget(target) {
  const normalized = target.startsWith('/') ? target.slice(1) : path.posix.join('xl', target);
  return path.posix.normalize(normalized);
}

function decodeXml(value) {
  return String(value ?? '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}
