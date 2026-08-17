type XlsxCell = string | number | boolean | null | undefined;

type XlsxExportOptions = {
  columns: string[];
  filename: string;
  rows: XlsxCell[][];
  sheetName?: string;
  subtitle?: string;
  title: string;
};

const encoder = new TextEncoder();
const crcTable = buildCrcTable();

export function exportReportXlsx({ columns, filename, rows, sheetName = 'Bao cao', subtitle, title }: XlsxExportOptions) {
  const safeColumns = columns.length ? columns : ['Nội dung'];
  const sheetXml = buildSheetXml({ columns: safeColumns, rows, subtitle, title });
  const workbook = createZip([
    ['[Content_Types].xml', contentTypesXml()],
    ['_rels/.rels', rootRelsXml()],
    ['docProps/app.xml', appXml()],
    ['docProps/core.xml', coreXml()],
    ['xl/workbook.xml', workbookXml(sheetName)],
    ['xl/_rels/workbook.xml.rels', workbookRelsXml()],
    ['xl/styles.xml', stylesXml()],
    ['xl/worksheets/sheet1.xml', sheetXml],
  ]);
  const blob = new Blob([workbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildSheetXml({ columns, rows, subtitle, title }: Omit<XlsxExportOptions, 'filename' | 'sheetName'>) {
  const lastColumn = columnName(columns.length);
  const sheetRows: string[] = [
    `<row r="1" ht="28" customHeight="1">${inlineCell('A1', title, 1)}</row>`,
    `<row r="2" ht="22" customHeight="1">${inlineCell('A2', subtitle || '', 2)}</row>`,
    `<row r="4" ht="24" customHeight="1">${columns.map((column, index) => inlineCell(`${columnName(index + 1)}4`, column, 3)).join('')}</row>`,
    ...rows.map((row, rowIndex) => {
      const excelRow = rowIndex + 5;
      const cells = columns.map((_, columnIndex) => dataCell(`${columnName(columnIndex + 1)}${excelRow}`, row[columnIndex]));
      return `<row r="${excelRow}">${cells.join('')}</row>`;
    }),
  ];

  return xml(`worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`, `
    <sheetViews><sheetView workbookViewId="0"/></sheetViews>
    <sheetFormatPr defaultRowHeight="18"/>
    <cols>${columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${columnWidth(column)}" customWidth="1"/>`).join('')}</cols>
    <sheetData>${sheetRows.join('')}</sheetData>
    <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
    <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
  `);
}

function dataCell(ref: string, value: XlsxCell) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="4"><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') {
    return inlineCell(ref, value ? 'Có' : 'Không', 4);
  }
  return inlineCell(ref, value == null ? '' : String(value), 4);
}

function inlineCell(ref: string, value: string, style: number) {
  const preserve = /^\s|\s$|\n/.test(value) ? ' xml:space="preserve"' : '';
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t${preserve}>${escapeXml(value)}</t></is></c>`;
}

function columnName(index: number) {
  let name = '';
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function columnWidth(label: string) {
  const length = Math.max(label.length, 8);
  return Math.min(Math.max(length + 4, 12), 34);
}

function xml(root: string, body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${root}>${body}</${root.split(' ')[0]}>`;
}

function contentTypesXml() {
  return xml('Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"', `
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  `);
}

function rootRelsXml() {
  return xml('Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"', `
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
  `);
}

function workbookRelsXml() {
  return xml('Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"', `
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  `);
}

function workbookXml(sheetName: string) {
  return xml('workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"', `
    <sheets><sheet name="${escapeXml(sheetName.slice(0, 31) || 'Bao cao')}" sheetId="1" r:id="rId1"/></sheets>
  `);
}

function stylesXml() {
  return xml('styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', `
    <fonts count="4">
      <font><sz val="11"/><name val="Calibri"/></font>
      <font><b/><sz val="16"/><color rgb="FF111827"/><name val="Calibri"/></font>
      <font><i/><sz val="11"/><color rgb="FF475569"/><name val="Calibri"/></font>
      <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    </fonts>
    <fills count="3">
      <fill><patternFill patternType="none"/></fill>
      <fill><patternFill patternType="gray125"/></fill>
      <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
    </fills>
    <borders count="2">
      <border><left/><right/><top/><bottom/><diagonal/></border>
      <border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom><diagonal/></border>
    </borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="5">
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center"/></xf>
      <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
    </cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  `);
}

function appXml() {
  return xml('Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"', '<Application>VietMed Ky Thuat</Application>');
}

function coreXml() {
  const now = new Date().toISOString();
  return xml('cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"', `
    <dc:creator>VietMed Ky Thuat</dc:creator>
    <cp:lastModifiedBy>VietMed Ky Thuat</cp:lastModifiedBy>
    <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
    <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
  `);
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function createZip(files: Array<[string, string]>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content.replace(/>\s+</g, '><').trim());
    const crc = crc32(data);
    const localHeader = zipHeader(0x04034b50, nameBytes, data, crc, offset);
    localParts.push(localHeader, data);
    centralParts.push(zipHeader(0x02014b50, nameBytes, data, crc, offset));
    offset += localHeader.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = endOfCentralDirectory(files.length, centralSize, centralOffset);
  return concatBytes([...localParts, ...centralParts, end]);
}

function zipHeader(signature: number, name: Uint8Array, data: Uint8Array, crc: number, offset: number) {
  const isCentral = signature === 0x02014b50;
  const size = isCentral ? 46 + name.length : 30 + name.length;
  const header = new Uint8Array(size);
  const view = new DataView(header.buffer);
  let position = 0;
  view.setUint32(position, signature, true); position += 4;
  if (isCentral) {
    view.setUint16(position, 20, true); position += 2;
  }
  view.setUint16(position, 20, true); position += 2;
  view.setUint16(position, 0, true); position += 2;
  view.setUint16(position, 0, true); position += 2;
  view.setUint16(position, 0, true); position += 2;
  view.setUint16(position, 0, true); position += 2;
  view.setUint32(position, crc, true); position += 4;
  view.setUint32(position, data.length, true); position += 4;
  view.setUint32(position, data.length, true); position += 4;
  view.setUint16(position, name.length, true); position += 2;
  view.setUint16(position, 0, true); position += 2;
  if (isCentral) {
    view.setUint16(position, 0, true); position += 2;
    view.setUint16(position, 0, true); position += 2;
    view.setUint16(position, 0, true); position += 2;
    view.setUint32(position, 0, true); position += 4;
    view.setUint32(position, offset, true); position += 4;
  }
  header.set(name, position);
  return header;
}

function endOfCentralDirectory(fileCount: number, centralSize: number, centralOffset: number) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((size, part) => size + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function buildCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  data.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}
