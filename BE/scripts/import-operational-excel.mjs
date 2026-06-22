import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const reset = args.has('--reset');
const repairsOnly = args.has('--repairs-only');
const installationsOnly = args.has('--installations-only');
const resetCatalog = args.has('--reset-catalog');
const resetOnly = args.has('--reset-only');
const root = path.resolve('..');
const installationFile = path.join(root, 'DS lắp máy.xlsx');
const repairFile = path.join(root, 'DS sửa chữa.xlsx');

const installationRows = parseInstallationWorkbook(installationFile);
const repairRows = parseRepairWorkbook(repairFile);

console.log(`Parsed installations: ${installationRows.length}`);
console.log(`Parsed repairs: ${repairRows.length}`);
console.log('Installation sample:', installationRows.slice(0, 5));
console.log('Repair sample:', repairRows.slice(0, 5));

if (!apply) {
  console.log('\nDry-run only. Add --apply --reset to delete old operational data and import these rows.');
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  if (reset) await resetOperationalData(prisma, { resetCatalog });
  if (resetOnly) {
    console.log('\nReset completed. Import skipped because --reset-only was provided.');
  } else {
    const context = await loadContext(prisma);
    const result = await importRows(prisma, context, installationRows, repairRows);
    console.log('\nImport completed:');
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await prisma.$disconnect();
}

function parseInstallationWorkbook(file) {
  const workbook = readWorkbook(file);
  const rows = [];

  for (const sheet of workbook.sheets) {
    const rawRows = readSheet(file, sheet.path, workbook.sharedStrings);
    const headerIndex = rawRows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === 'stt') && row.some((cell) => normalizeHeader(cell).includes('model')));
    if (headerIndex < 0) continue;

    const headers = rawRows[headerIndex].map(normalizeHeader);
    for (const row of rawRows.slice(headerIndex + 1)) {
      const item = rowObject(headers, row);
      const serialNumber = cleanText(field(item, 'sn', 's n'));
      const modelName = cleanText(field(item, 'model', 'model2', 'model 2'));
      if (!serialNumber && !modelName) continue;

      rows.push({
        sourceSheet: sheet.name,
        stt: cleanText(field(item, 'stt')),
        modelName: modelName || 'Chưa rõ model',
        serialNumber: normalizeSerial(serialNumber) || `IMPORT-NO-SN-${slug(sheet.name)}-${rows.length + 1}`,
        installedAt: parseExcelDate(field(item, 'ngay ban giao')) || parseExcelDate(field(item, 'ngay lap dat')) || new Date('2026-05-01T00:00:00'),
        manufacturingDate: parseExcelDate(field(item, 'ngay san xuat')) || parseExcelDate(field(item, 'ngay sx')),
        dealerName: cleanText(field(item, 'ten dai ly')),
        dealerAddress: cleanText(field(item, 'dia chi thon xa huyen')),
        dealerProvince: cleanText(field(item, 'tinh tp')),
        dealerPhone: cleanPhone(field(item, 'so dt')),
        dealerContact: cleanText(field(item, 'nguoi lien he')),
        customerName: cleanText(field(item, 'don vi su dung cuoi cung')),
        address: cleanText(field(item, 'dia chi thon xa huyen 2', 'dia chi thon xa huyen2')),
        province: cleanText(field(item, 'tinh tp 2', 'tinhtp2')),
        phone: cleanPhone(field(item, 'so dt 2', 'so dt2')),
        contactPerson: cleanText(field(item, 'nguoi lien he 2', 'nguoi lien he2')),
        note: cleanText(field(item, 'ghi chu')),
        installerName: cleanText(field(item, 'nguoi lap dat lap dat', 'nguoi lap dat')),
        checkerName: cleanText(field(item, 'nguoi kiem tra kiem tra', 'nguoi kiem tra')),
      });
    }
  }

  return rows;
}

function parseRepairWorkbook(file) {
  const workbook = readWorkbook(file);
  const rows = [];

  for (const sheet of workbook.sheets) {
    const rawRows = readSheet(file, sheet.path, workbook.sharedStrings);
    const headerIndex = rawRows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === 'stt') && row.some((cell) => normalizeHeader(cell).includes('model')));
    if (headerIndex < 0) continue;

    const headers = rawRows[headerIndex].map(normalizeHeader);
    for (const row of rawRows.slice(headerIndex + 1)) {
      const item = rowObject(headers, row);
      const modelName = cleanText(field(item, 'model'));
      const serialNumber = cleanText(field(item, 'sn', 's n'));
      const issue = cleanText(field(item, 'tinh trang thiet bi'));
      const fix = cleanText(field(item, 'bien phap khac phuc'));
      if (!modelName && !serialNumber && !issue && !fix) continue;

      rows.push({
        sourceSheet: sheet.name,
        stt: cleanText(field(item, 'stt')),
        receivedAt: parseExcelDate(field(item, 'ngay nhan')) || new Date('2026-05-01T00:00:00'),
        returnedAt: parseExcelDate(field(item, 'ngay tra')),
        returnText: cleanText(field(item, 'ngay tra')),
        modelName: modelName || 'Chưa rõ model',
        serialNumber: normalizeSerial(serialNumber) || `REPAIR-NO-SN-${rows.length + 1}`,
        province: cleanText(field(item, 'thanh pho')),
        contactPerson: cleanText(field(item, 'nguoi lien he')),
        phone: cleanPhone(field(item, 'so dien thoai')),
        issue,
        ownerName: cleanText(field(item, 'phu trach')),
        replacementPart: cleanText(field(item, 'linh kien thay the')),
        repairMethod: fix,
        engineerName: cleanText(field(item, 'nguoi thuc hien') || field(item, 'phu trach')),
        amount: cleanText(field(item, 'so tien')),
        note: cleanText(field(item, 'ghi chu')),
      });
    }
  }

  return rows;
}

async function resetOperationalData(prisma, options = {}) {
  console.log('\nDeleting operational data. Keeping users, roles, regions, engineer profiles, and fixed product catalog.');
  await prisma.$transaction([
    prisma.weeklyReportRow.deleteMany(),
    prisma.weeklyReport.deleteMany(),
    prisma.dailyWorkNote.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.warrantyCard.deleteMany(),
    prisma.machineInventoryMovement.deleteMany(),
    prisma.repair.deleteMany(),
    prisma.maintenance.deleteMany(),
    prisma.machineInstallation.deleteMany(),
    prisma.machineAccessory.deleteMany(),
    prisma.machine.deleteMany(),
    prisma.customer.deleteMany(),
  ]);

  if (options.resetCatalog) {
    console.log('Deleting fixed product catalog as requested.');
    await prisma.$transaction([
      prisma.componentAccessory.deleteMany(),
      prisma.machineComponent.deleteMany(),
      prisma.machineModel.deleteMany(),
      prisma.businessLine.deleteMany(),
      prisma.productIndustry.deleteMany(),
    ]);
  }
}

async function loadContext(prisma) {
  const [regions, users, machineModels, businessLines] = await Promise.all([
    prisma.region.findMany(),
    prisma.user.findMany({ include: { role: true, engineerProfile: true } }),
    prisma.machineModel.findMany({ include: { businessLine: true } }),
    prisma.businessLine.findMany(),
  ]);
  if (!regions.length) throw new Error('No regions found. Cannot import customers because regionId is required.');
  if (!machineModels.length) throw new Error('No fixed machine models found. Run FE/scripts/import-vietmed-products.mjs first.');

  return {
    regions,
    users,
    machineModels,
    businessLines,
    customerCache: new Map(),
    businessLineCache: new Map(),
    machineModelCache: new Map(),
    machineCache: new Map(),
    counters: {
      customer: 1,
      installation: 1,
      repair: 1,
      movement: 1,
    },
  };
}

async function importRows(prisma, context, installationRows, repairRows) {
  const result = {
    customers: 0,
    businessLines: 0,
    machineModels: 0,
    machines: 0,
    installations: 0,
    repairs: 0,
    movements: 0,
  };

  if (!repairsOnly) for (const row of installationRows) {
    const machineModel = findMachineModel(context.machineModels, row.modelName);
    const businessLine = machineModel?.businessLine || findBusinessLine(context.businessLines, row.sourceSheet, row.modelName);
    const customer = await getCustomer(prisma, context, customerFromInstallation(row), result);
    const engineer = findUser(context.users, row.installerName || row.checkerName);
    const serialNumber = uniqueSerial(row.serialNumber, row.sourceSheet, row.stt);
    const machine = await getMachine(prisma, context, {
      serialNumber,
      modelName: row.modelName,
      manufacturer: machineModel?.manufacturer || businessLine?.manufacturer || manufacturerForSheet(row.sourceSheet),
      productCategory: machineModel?.productCategory || businessLine?.productCategory || categoryForSheet(row.sourceSheet),
      businessLineId: businessLine?.id,
      machineModelId: machineModel?.id,
      customerId: customer.id,
      installedById: engineer?.id,
      primaryEngineerId: engineer?.id,
      installDate: row.installedAt,
      manufacturingDate: row.manufacturingDate,
      inventoryStatus: 'INSTALLED',
      status: 'ACTIVE',
      note: row.note,
    }, result);

    const installation = await prisma.machineInstallation.create({
      data: {
        code: nextCode('INSTALL-IMPORT', context.counters.installation++),
        status: 'INSTALLED',
        machineId: machine.id,
        plannedMachineModelId: machineModel?.id,
        plannedModelName: row.modelName,
        customerId: customer.id,
        businessLineId: businessLine?.id,
        installedById: engineer?.id,
        installedAt: row.installedAt,
        receiverInstallAddress: row.address || customer.fullAddress || customer.address,
        receiverRepresentative: row.contactPerson || customer.contactPerson,
        receiverPhone: row.phone || customer.phone,
        note: [row.note, row.checkerName ? `Người kiểm tra: ${row.checkerName}` : ''].filter(Boolean).join('\n') || null,
      },
    });
    result.installations += 1;
    if (result.installations % 10 === 0) console.log(`Imported installations: ${result.installations}/${installationRows.length}`);

    await createMovement(prisma, context, {
      type: 'IMPORT',
      machineId: machine.id,
      toStatus: 'IN_STOCK',
      occurredAt: row.installedAt,
      note: 'Import từ file DS lắp máy',
    }, result);
    await createMovement(prisma, context, {
      type: 'INSTALL',
      machineId: machine.id,
      fromStatus: 'IN_STOCK',
      toStatus: 'INSTALLED',
      occurredAt: row.installedAt,
      customerId: customer.id,
      createdById: engineer?.id,
      note: `Lắp đặt từ file DS lắp máy: ${installation.code}`,
    }, result);
  }

  if (!installationsOnly) for (const row of repairRows) {
    const machineModel = findMachineModel(context.machineModels, row.modelName);
    const businessLine = machineModel?.businessLine || findBusinessLine(context.businessLines, 'Sửa chữa', row.modelName);
    const customer = await getCustomer(prisma, context, customerFromRepair(row), result);
    const engineer = findUser(context.users, row.engineerName);
    const machine = await getMachine(prisma, context, {
      serialNumber: uniqueSerial(row.serialNumber, 'repair', row.stt),
      modelName: row.modelName,
      manufacturer: machineModel?.manufacturer || businessLine?.manufacturer || 'Chưa rõ',
      productCategory: machineModel?.productCategory || businessLine?.productCategory || 'OTHER',
      businessLineId: businessLine?.id,
      machineModelId: machineModel?.id,
      customerId: customer.id,
      primaryEngineerId: engineer?.id,
      inventoryStatus: 'INSTALLED',
      status: 'REPAIRING',
      note: row.note,
    }, result);

    await prisma.repair.create({
      data: {
        code: nextCode('REPAIR-IMPORT', context.counters.repair++),
        title: row.issue || `Sửa chữa ${row.modelName}`,
        description: [row.issue, row.replacementPart ? `Linh kiện: ${row.replacementPart}` : '', row.amount ? `Số tiền: ${row.amount}` : '', row.note].filter(Boolean).join('\n') || null,
        status: 'COMPLETED',
        priority: 'NORMAL',
        machineId: machine.id,
        engineerId: engineer?.id,
        reportedAt: row.receivedAt,
        assignedAt: row.receivedAt,
        startedAt: row.receivedAt,
        completedAt: row.returnedAt || row.receivedAt,
        resultNote: row.repairMethod || row.replacementPart || row.returnText || null,
        usingDepartment: customer.name,
        representative: row.contactPerson || null,
        address: customer.fullAddress || customer.address,
        contactPhone: row.phone || null,
        deviceName: row.modelName,
        modelName: row.modelName,
        serialNumber: machine.serialNumber,
        conditionAssessment: row.issue || null,
        repairMethod: row.repairMethod || null,
      },
    });
    result.repairs += 1;
    if (result.repairs % 10 === 0) console.log(`Imported repairs: ${result.repairs}/${repairRows.length}`);
  }

  return result;
}

async function getCustomer(prisma, context, data, result) {
  const key = normalizeKey([data.name, data.province, data.phone, data.address].filter(Boolean).join('|'));
  const cached = context.customerCache.get(key);
  if (cached) return cached;

  const existing = await prisma.customer.findFirst({
    where: {
      name: data.name,
      province: data.province || null,
      phone: data.phone || null,
    },
  });
  if (existing) {
    context.customerCache.set(key, existing);
    return existing;
  }

  const region = pickRegion(context.regions, data.province);
  const customer = await prisma.customer.create({
    data: {
      customerCode: nextCode('KH-IMPORT', context.counters.customer++),
      name: data.name,
      shortName: data.name.slice(0, 80),
      customerType: 'HOSPITAL',
      status: 'ACTIVE',
      phone: data.phone || null,
      contactPerson: data.contactPerson || null,
      contactPhone: data.phone || null,
      province: data.province || null,
      address: data.address || null,
      fullAddress: [data.address, data.province].filter(Boolean).join(', ') || null,
      note: data.note || null,
      regionId: region.id,
    },
  });
  context.customerCache.set(key, customer);
  result.customers += 1;
  return customer;
}

async function getMachine(prisma, context, data, result) {
  const key = normalizeKey(data.serialNumber);
  const cached = context.machineCache.get(key);
  if (cached) {
    const updated = await prisma.machine.update({
      where: { id: cached.id },
      data: {
        customerId: data.customerId ?? cached.customerId,
        primaryEngineerId: data.primaryEngineerId ?? cached.primaryEngineerId,
        installedById: data.installedById ?? cached.installedById,
        installDate: data.installDate ?? cached.installDate,
        inventoryStatus: data.inventoryStatus ?? cached.inventoryStatus,
      },
    });
    context.machineCache.set(key, updated);
    return updated;
  }

  const existing = await prisma.machine.findUnique({ where: { serialNumber: data.serialNumber } });
  if (existing) {
    context.machineCache.set(key, existing);
    return existing;
  }

  const machine = await prisma.machine.create({
    data: {
      machineCode: `MAY-IMP-${String(result.machines + 1).padStart(5, '0')}`,
      serialNumber: data.serialNumber,
      name: data.modelName,
      modelName: data.modelName,
      manufacturer: data.manufacturer,
      productCategory: data.productCategory,
      status: data.status,
      inventoryStatus: data.inventoryStatus,
      dataStatus: 'PENDING_REVIEW',
      createdSource: 'IMPORT',
      manufacturingDate: data.manufacturingDate,
      warehouseImportDate: data.installDate || new Date('2026-05-01T00:00:00'),
      installDate: data.installDate,
      businessLineId: data.businessLineId,
      machineModelId: data.machineModelId,
      customerId: data.customerId,
      installedById: data.installedById,
      primaryEngineerId: data.primaryEngineerId,
      accessoriesSnapshot: [],
    },
  });
  context.machineCache.set(key, machine);
  result.machines += 1;
  return machine;
}

async function createMovement(prisma, context, data, result) {
  await prisma.machineInventoryMovement.create({
    data: {
      code: nextCode('INV-IMPORT', context.counters.movement++),
      type: data.type,
      machineId: data.machineId,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      occurredAt: data.occurredAt,
      customerId: data.customerId,
      createdById: data.createdById,
      note: data.note,
    },
  });
  result.movements += 1;
}

function customerFromInstallation(row) {
  const name = row.customerName || row.dealerName || row.contactPerson || row.dealerContact || `Khách hàng ${row.province || row.dealerProvince || row.serialNumber}`;
  return {
    name,
    province: row.province || row.dealerProvince,
    address: row.address || row.dealerAddress,
    phone: row.phone || row.dealerPhone,
    contactPerson: row.contactPerson || row.dealerContact,
    note: row.note,
  };
}

function customerFromRepair(row) {
  return {
    name: row.contactPerson ? `${row.contactPerson}${row.province ? ` - ${row.province}` : ''}` : `Khách sửa chữa ${row.province || row.serialNumber}`,
    province: row.province,
    address: row.province,
    phone: row.phone,
    contactPerson: row.contactPerson,
    note: row.note,
  };
}

function categoryForSheet(sheetName) {
  const key = normalizeKey(sheetName);
  if (key.includes('sieu am')) return 'ULTRASOUND';
  if (key.includes('xet nghiem')) return 'LAB_TESTING';
  return 'OTHER';
}

function findMachineModel(machineModels, modelName) {
  const wanted = normalizeModel(modelName);
  if (!wanted) return undefined;
  const exact = machineModels.find((model) => modelAliases(model).some((alias) => alias === wanted));
  if (exact) return exact;
  return machineModels.find((model) => modelAliases(model).some((alias) => alias.includes(wanted) || wanted.includes(alias)));
}

function findBusinessLine(businessLines, sourceSheet, modelName) {
  const modelKey = normalizeModel(modelName);
  const sourceKey = normalizeKey(sourceSheet);
  if (sourceKey.includes('sieu am') || modelKey.includes('XCUBE') || modelKey.includes('MINISONO')) {
    return businessLines.find((line) => line.productCategory === 'ULTRASOUND') || undefined;
  }
  if (sourceKey.includes('xet nghiem') || ['BC', 'BS', 'CL', 'BA', 'UA', 'EU'].some((prefix) => modelKey.startsWith(prefix))) {
    return businessLines.find((line) => ['BIOCHEMISTRY', 'HEMATOLOGY', 'IMMUNOLOGY', 'LAB_TESTING'].includes(line.productCategory)) || undefined;
  }
  if (sourceKey.includes('minato') || ['KT', 'WTS', 'QZ', 'ST', 'TC', 'MHR', 'ALB', 'HC', 'MT'].some((prefix) => modelKey.startsWith(prefix))) {
    return businessLines.find((line) => normalizeKey(line.manufacturer).includes('minato')) || undefined;
  }
  if (['HD', 'X2200', 'X2600'].some((prefix) => modelKey.startsWith(prefix))) {
    return businessLines.find((line) => line.productCategory === 'ENDOSCOPY') || undefined;
  }
  return undefined;
}

function modelAliases(model) {
  return [model.code, model.name, model.displayName]
    .filter(Boolean)
    .flatMap((value) => {
      const normalized = normalizeModel(value);
      const compactName = normalized
        .replace(/^MAYXETNGHIEM/, '')
        .replace(/^MAYSIEUAMXACHTAY/, '')
        .replace(/^MAYSIEUAM/, '')
        .replace(/^MAYNOISOI/, '')
        .replace(/^MAY/, '');
      return [normalized, compactName].filter(Boolean);
    });
}

function manufacturerForSheet(sheetName) {
  const key = normalizeKey(sheetName);
  if (key.includes('minato')) return 'Minato';
  if (key.includes('sieu am') || key.includes('xet nghiem')) return 'Mindray';
  return 'Chưa rõ';
}

function findUser(users, name) {
  const key = normalizeKey(name);
  if (!key) return undefined;
  return users.find((user) => normalizeKey(user.fullName).includes(key) || key.includes(normalizeKey(user.fullName)));
}

function pickRegion(regions, province) {
  const key = normalizeKey(province);
  const exact = regions.find((region) => normalizeKey(region.name).includes(key) || normalizeKey(region.code).includes(key));
  if (exact) return exact;
  const northProvinces = ['ha noi', 'bac giang', 'phu tho', 'hung yen', 'ninh binh', 'thanh hoa'];
  const centralProvinces = ['quang tri', 'ha tinh', 'nghe an'];
  const southProvinces = ['ho chi minh', 'dong nai', 'binh duong', 'can tho'];
  const regionKey = northProvinces.includes(key)
    ? 'bac'
    : centralProvinces.includes(key)
      ? 'trung'
      : southProvinces.includes(key)
        ? 'nam'
        : '';
  if (regionKey) {
    const matched = regions.find((region) => normalizeKey(`${region.name} ${region.code}`).includes(regionKey));
    if (matched) return matched;
  }
  return regions[0];
}

function uniqueSerial(serialNumber, source, stt) {
  const value = normalizeSerial(serialNumber);
  if (value) return value.slice(0, 180);
  return `NO-SERIAL-${slug(source)}-${stt || Date.now()}`;
}

function nextCode(prefix, value) {
  return `${prefix}-${String(value).padStart(5, '0')}`;
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
    const target = attrs['r:id'] ? rels.get(attrs['r:id']) : '';
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

function rowObject(headers, row) {
  const item = {};
  headers.forEach((header, index) => {
    if (!header) return;
    const key = duplicateAwareKey(item, header);
    item[key] = row[index] ?? '';
  });
  return item;
}

function field(item, ...names) {
  const entries = Object.entries(item);
  for (const name of names) {
    const target = compactKey(name);
    const found = entries.find(([key]) => compactKey(key) === target);
    if (found) return found[1];
  }
  return '';
}

function duplicateAwareKey(item, key) {
  if (!(key in item)) return key;
  let index = 2;
  while (`${key}${index}` in item) index += 1;
  return `${key}${index}`;
}

function unzipText(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
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

function normalizeHeader(value) {
  return normalizeKey(value)
    .replace(/\bs n\b/g, 'sn')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactKey(value) {
  return normalizeKey(value).replace(/\s+/g, '');
}

function normalizeKey(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeModel(value) {
  return normalizeKey(value)
    .replace(/\benpuuls\b/g, 'enpuls')
    .replace(/\bplus\b/g, 'PLUS')
    .replace(/\bpro\b/g, 'PRO')
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .toUpperCase();
}

function slug(value) {
  return normalizeKey(value).replace(/\s+/g, '-').toUpperCase();
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanPhone(value) {
  const text = cleanText(value);
  const digits = text.replace(/\D/g, '');
  return digits.length >= 8 ? text : '';
}

function normalizeSerial(value) {
  const text = cleanText(value);
  if (/^\d+$/.test(text) && text.length < 5) return '';
  return text;
}

function parseExcelDate(value) {
  const text = cleanText(value);
  if (!text) return undefined;
  const vnDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vnDate) return new Date(`${vnDate[3]}-${vnDate[2].padStart(2, '0')}-${vnDate[1].padStart(2, '0')}T00:00:00`);
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) return new Date(`${isoDate[1]}-${isoDate[2].padStart(2, '0')}-${isoDate[3].padStart(2, '0')}T00:00:00`);
  const number = Number(text);
  if (Number.isFinite(number) && number > 30000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + number * 86400000);
  }
  return undefined;
}

function decodeXml(value) {
  return String(value ?? '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}
