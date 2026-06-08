import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultExcelPath = '/Users/tuanvietmedhn/Documents/VietMed_KyThuat/TỔNG HỢP DSKH-5-2026.xlsx';
const defaultBackendPath = path.resolve(__dirname, '../../BE');
const args = new Set(process.argv.slice(2));
const commit = args.has('--commit');
const excelPath = valueAfter('--file') || defaultExcelPath;
const backendPath = valueAfter('--be') || defaultBackendPath;
const limit = Number(valueAfter('--limit') || '0');
const offset = Number(valueAfter('--offset') || '0');

if (!existsSync(excelPath)) {
  fail(`Không tìm thấy file Excel: ${excelPath}`);
}

if (!existsSync(path.join(backendPath, 'node_modules/@prisma/client'))) {
  fail(`Không tìm thấy Prisma client trong BE: ${backendPath}`);
}

loadBackendEnv(backendPath);

const rows = parseWorkbook(excelPath)
  .map(normalizeRow)
  .filter((row) => row.customerName || row.serialNumber || row.modelName)
  .slice(Math.max(0, offset))
  .slice(0, limit > 0 ? limit : undefined);

const customerMap = new Map();
rows.forEach((row) => {
  if (!row.customerName) return;
  const key = customerKey(row);
  if (!customerMap.has(key)) {
    customerMap.set(key, buildCustomer(row, key));
    return;
  }

  const existing = customerMap.get(key);
  existing.note = mergeText(existing.note, buildCustomerNote(row));
  existing.phone ||= row.customerPhone;
  existing.contactPerson ||= row.contactPerson;
  existing.contactPosition ||= row.contactPosition;
  existing.contactEmail ||= row.email;
});

const machines = rows
  .filter((row) => row.serialNumber)
  .map((row) => buildMachine(row, customerKey(row)))
  .filter((machine, index, list) => list.findIndex((item) => item.serialNumber === machine.serialNumber) === index);

console.log(
  JSON.stringify(
    {
      mode: commit ? 'commit' : 'dry-run',
      excelRows: rows.length,
      customersToUpsert: customerMap.size,
      machinesToUpsert: machines.length,
      skippedMachineRowsWithoutSerial: rows.filter((row) => !row.serialNumber).length,
      limit: limit || 'all',
      offset,
      backendPath,
      excelPath,
    },
    null,
    2,
  ),
);

if (!commit) {
  console.log('Dry-run xong. Chạy lại với --commit khi PostgreSQL/BE database đã bật để ghi dữ liệu.');
  process.exit(0);
}

const { PrismaClient } = await import(pathToFileURL(path.join(backendPath, 'node_modules/@prisma/client/index.js')));
const prisma = new PrismaClient();

try {
  await prisma.$connect();

  const importRegion = await prisma.region.upsert({
    where: { code: 'UNASSIGNED' },
    update: {},
    create: { code: 'UNASSIGNED', name: 'Chưa phân vùng' },
  });

  const engineers = await prisma.user.findMany({
    include: { role: true },
    where: { role: { name: { in: ['engineer', 'Kỹ sư', 'ky su'] } } },
  });
  const engineerByShortName = new Map(
    engineers.flatMap((engineer) => {
      const parts = normalizeName(engineer.fullName).split(' ').filter(Boolean);
      const last = parts.at(-1);
      return last ? [[last, engineer.id]] : [];
    }),
  );

  const customerIdsByKey = new Map();
  for (const [key, customer] of customerMap) {
    const saved = await prisma.customer.upsert({
      where: { customerCode: customer.customerCode },
      update: { ...customer, regionId: importRegion.id },
      create: { ...customer, regionId: importRegion.id },
      select: { id: true },
    });
    customerIdsByKey.set(key, saved.id);
  }

  let machinesWritten = 0;
  let installationsWritten = 0;
  for (const machine of machines) {
    const installedById = findEngineerId(machine.installerName, engineerByShortName);
    const customerId = customerIdsByKey.get(machine.customerKey);
    const machineUpdate = compactObject({
      machineCode: machine.machineCode,
      name: machine.name,
      modelName: machine.modelName,
      manufacturer: machine.manufacturer,
      productCategory: machine.productCategory,
      productLine: machine.productLine,
      installDate: machine.installDate,
      inventoryStatus: machine.inventoryStatus,
      customer: customerId ? { connect: { id: customerId } } : undefined,
      installedBy: installedById ? { connect: { id: installedById } } : undefined,
    });
    const machineCreate = compactObject({
      machineCode: machine.machineCode,
      serialNumber: machine.serialNumber,
      name: machine.name,
      modelName: machine.modelName,
      manufacturer: machine.manufacturer,
      productCategory: machine.productCategory,
      productLine: machine.productLine,
      installDate: machine.installDate,
      inventoryStatus: machine.inventoryStatus,
      customer: customerId ? { connect: { id: customerId } } : undefined,
      installedBy: installedById ? { connect: { id: installedById } } : undefined,
    });
    const savedMachine = await prisma.machine.upsert({
      where: { serialNumber: machine.serialNumber },
      update: machineUpdate,
      create: machineCreate,
      select: { id: true },
    });
    machinesWritten += 1;

    if (installedById && machine.installDate && customerId) {
      await prisma.machineInstallation.upsert({
        where: { code: machine.installationCode },
        update: {
          machine: { connect: { id: savedMachine.id } },
          customer: { connect: { id: customerId } },
          installedBy: { connect: { id: installedById } },
          installedAt: machine.installDate,
          accessories: machine.accessories,
          note: machine.note,
        },
        create: {
          code: machine.installationCode,
          machine: { connect: { id: savedMachine.id } },
          customer: { connect: { id: customerId } },
          installedBy: { connect: { id: installedById } },
          installedAt: machine.installDate,
          accessories: machine.accessories,
          note: machine.note,
        },
      });
      installationsWritten += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        importedCustomers: customerMap.size,
        importedMachines: machinesWritten,
        importedInstallations: installationsWritten,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadBackendEnv(basePath) {
  const envPath = path.join(basePath, '.env');
  if (!existsSync(envPath)) return;

  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) return;
      process.env[match[1]] = match[2].replace(/^"|"$/g, '');
    });
}

function parseWorkbook(filePath) {
  const parser = String.raw`
import datetime, json, re, sys, zipfile, xml.etree.ElementTree as ET
p=sys.argv[1]
z=zipfile.ZipFile(p)
ns={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
shared=[]
if 'xl/sharedStrings.xml' in z.namelist():
  root=ET.fromstring(z.read('xl/sharedStrings.xml'))
  for si in root.findall('a:si',ns):
    shared.append(''.join([t.text or '' for t in si.findall('.//a:t',ns)]))
styles=[]
if 'xl/styles.xml' in z.namelist():
  st=ET.fromstring(z.read('xl/styles.xml'))
  styles=[int(x.attrib.get('numFmtId','0')) for x in st.findall('a:cellXfs/a:xf',ns)]
def is_date_style(s):
  return s is not None and 0 <= s < len(styles) and styles[s] in {14,15,16,17,22,27,30,36,50,57}
def excel_date(v):
  try:
    return (datetime.datetime(1899,12,30)+datetime.timedelta(days=float(v))).date().isoformat()
  except Exception:
    return v
def colnum(ref):
  m=re.match(r'([A-Z]+)', ref or '')
  n=0
  for ch in m.group(1):
    n=n*26+ord(ch)-64
  return n
def value(c):
  t=c.attrib.get('t')
  v=c.find('a:v',ns)
  isv=c.find('a:is',ns)
  raw=v.text if v is not None else None
  if t=='s' and raw is not None:
    return shared[int(raw)]
  if t=='inlineStr' and isv is not None:
    return ''.join([x.text or '' for x in isv.findall('.//a:t',ns)])
  if raw and is_date_style(int(c.attrib.get('s','-1'))):
    return excel_date(raw)
  return raw
wb=ET.fromstring(z.read('xl/workbook.xml'))
rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
relmap={rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
sheet=wb.find('a:sheets/a:sheet',ns)
target=relmap[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
ws=ET.fromstring(z.read('xl/'+target.lstrip('/')))
out=[]
for row in ws.findall('a:sheetData/a:row',ns):
  rn=int(row.attrib.get('r','0'))
  if rn < 13:
    continue
  data=[]
  for c in row.findall('a:c',ns):
    idx=colnum(c.attrib.get('r'))
    while len(data) < idx-1:
      data.append(None)
    data.append(value(c))
  if any(x not in (None,'') for x in data):
    out.append(data[:21])
print(json.dumps(out, ensure_ascii=False))
`;
  const result = spawnSync('python3', ['-c', parser, filePath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    fail(result.stderr || 'Không đọc được workbook.');
  }

  return JSON.parse(result.stdout);
}

function normalizeRow(row) {
  const pick = (index) => clean(row[index]);
  const finalName = pick(11) || pick(6);
  const dealerName = pick(6);
  const province = pick(13) || pick(8);
  const address = pick(12) || pick(7);
  const phone = pick(14) || pick(9);
  const contact = pick(15) || pick(10);

  return {
    rowNo: pick(0),
    modelName: pick(1),
    probe: pick(2),
    serialNumber: normalizeSerial(pick(3)),
    handoverDate: parseDate(pick(4)),
    manufacturingDate: parseDate(pick(5)),
    dealerName,
    dealerAddress: pick(7),
    dealerProvince: pick(8),
    dealerPhone: pick(9),
    dealerContact: pick(10),
    customerName: finalName,
    customerAddress: address,
    province,
    customerPhone: phone,
    contactPerson: contact,
    contactPosition: pick(16),
    email: pick(17),
    note: pick(18),
    installerName: pick(19),
    checkerName: pick(20),
  };
}

function buildCustomer(row, key) {
  return {
    customerCode: `DSKH-${hash(key).slice(0, 10).toUpperCase()}`,
    name: row.customerName,
    shortName: row.customerName,
    hospitalName: row.customerName,
    customerType: inferCustomerType(row),
    status: 'ACTIVE',
    email: validEmail(row.email) ? row.email : undefined,
    phone: row.customerPhone,
    contactPerson: row.contactPerson,
    contactPosition: row.contactPosition,
    contactPhone: row.customerPhone,
    contactEmail: validEmail(row.email) ? row.email : undefined,
    province: row.province,
    address: row.customerAddress,
    fullAddress: [row.customerAddress, row.province].filter(Boolean).join(', ') || undefined,
    note: buildCustomerNote(row),
  };
}

function buildCustomerNote(row) {
  return [
    'Import từ TỔNG HỢP DSKH-5-2026.xlsx',
    row.rowNo && `STT Excel: ${row.rowNo}`,
    row.dealerName && `Người mua/đại lý: ${row.dealerName}`,
    row.dealerAddress && `Địa chỉ đại lý: ${row.dealerAddress}`,
    row.dealerProvince && `Tỉnh đại lý: ${row.dealerProvince}`,
    row.dealerPhone && `SĐT đại lý: ${row.dealerPhone}`,
    row.note && `Ghi chú Excel: ${row.note}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildMachine(row, customerKeyValue) {
  const serialHash = hash(row.serialNumber).slice(0, 10).toUpperCase();
  return {
    machineCode: `DSKH-M-${serialHash}`,
    serialNumber: row.serialNumber,
    name: row.modelName || 'Máy siêu âm',
    modelName: row.modelName || 'UNKNOWN',
    manufacturer: 'UNKNOWN',
    productCategory: 'ULTRASOUND',
    productLine: row.probe,
    inventoryStatus: 'INSTALLED',
    installDate: row.handoverDate,
    customerKey: customerKeyValue,
    installerName: row.installerName,
    accessories: row.probe ? [row.probe] : [],
    installationCode: `DSKH-LD-${serialHash}`,
    note: [
      'Import từ TỔNG HỢP DSKH-5-2026.xlsx',
      row.rowNo && `STT Excel: ${row.rowNo}`,
      row.probe && `Đầu dò: ${row.probe}`,
      row.manufacturingDate && `Ngày SX: ${row.manufacturingDate.toISOString().slice(0, 10)}`,
      row.installerName && `Người lắp đặt Excel: ${row.installerName}`,
      row.checkerName && `Người kiểm tra Excel: ${row.checkerName}`,
      row.note && `Ghi chú Excel: ${row.note}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function customerKey(row) {
  return normalizeName([row.customerName, row.province, row.customerPhone].filter(Boolean).join('|'));
}

function inferCustomerType(row) {
  const value = normalizeName([row.customerName, row.customerAddress, row.dealerName, row.dealerAddress].join(' '));
  if (/xet nghiem|lab|laboratory/.test(value)) return 'LAB';
  if (/phong kham|pk |pkdk|clinic/.test(value)) return 'CLINIC';
  if (/benh vien|bv |ttyt|trung tam y te|tram y te/.test(value)) return 'HOSPITAL';
  if (/cong ty|cty|jsc|ltd|tnhh|co\\./.test(value)) return 'COMPANY';
  return 'OTHER';
}

function clean(value) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || undefined;
}

function normalizeSerial(value) {
  return clean(value)?.replace(/\s+/g, '').toUpperCase();
}

function parseDate(value) {
  const text = clean(value);
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00.000Z`);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T00:00:00.000Z`);
  return undefined;
}

function validEmail(value) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function hash(value) {
  return createHash('sha1').update(value || 'empty').digest('hex');
}

function mergeText(current, next) {
  const parts = new Set(
    [current, next]
      .filter(Boolean)
      .join('\n')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return Array.from(parts).join('\n');
}

function findEngineerId(value, engineerByShortName) {
  const normalized = normalizeName(value);
  if (!normalized) return undefined;
  const firstName = normalized.split(/[+,&/ ]+/).filter(Boolean).at(0);
  return firstName ? engineerByShortName.get(firstName) : undefined;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
