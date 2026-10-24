import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerSalesChannel,
  CustomerStatus,
  CustomerType,
  DataImportBatchStatus,
  InstallationStatus,
  InventoryMovementType,
  MachineInventoryStatus,
  MachineProductCategory,
  MachineStatus,
  OperationalCreatedSource,
  OperationalDataStatus,
  Prisma,
  WorkReviewStatus,
} from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { createHash } from 'crypto';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

type Party = {
  name: string;
  address: string;
  province: string;
  phone: string;
  contactName: string;
  contactPhone: string;
  contactPosition: string;
  contactEmail: string;
  contacts?: PartyContact[];
};

type PartyContact = { name: string; phone: string | null; email: string | null; position: string | null };

type ImportedAccessory = { code: string; serialNumber: string; sourceRow: number };

type ImportedMachine = {
  sheet: string;
  sourceRow: number;
  serialNumber: string;
  modelName: string;
  hasCatalogModel: boolean;
  category: MachineProductCategory;
  installDate: string | null;
  buyer: Party | null;
  endUser: Party | null;
  installerName: string;
  checkerName: string;
  accessories: ImportedAccessory[];
};

type ParsedWorkbook = { machines: ImportedMachine[]; skippedRows: number };

// Map legacy province names (including common spreadsheet variants) to the
// current province master list. Keep this explicit so ambiguous values stay unset.
const IMPORTED_PROVINCE_ALIASES: Record<string, string> = {
  'an giang': 'An Giang', 'kien giang': 'An Giang', 'phu quoc': 'An Giang',
  'bac can': 'Thái Nguyên', 'bac giang': 'Thành phố Bắc Ninh', 'bac ninh': 'Thành phố Bắc Ninh',
  'ba ria': 'Thành phố Hồ Chí Minh', 'brvt': 'Thành phố Hồ Chí Minh',
  'binh duong': 'Thành phố Hồ Chí Minh', 'binh phuoc': 'Thành phố Đồng Nai',
  'binh dinh': 'Gia Lai', 'ca mau': 'Cà Mau', 'can tho': 'Thành phố Cần Thơ',
  'cao bang': 'Cao Bằng', 'da nang': 'Thành phố Đà Nẵng',
  'dac lak': 'Đắk Lắk', 'dak lak': 'Đắk Lắk', 'dak nong': 'Lâm Đồng',
  'dien bien': 'Điện Biên', 'dong nai': 'Thành phố Đồng Nai', 'dong thap': 'Đồng Tháp', 'gia lai': 'Gia Lai',
  'ha giang': 'Tuyên Quang', 'haa giang': 'Tuyên Quang',
  'ha nam': 'Ninh Bình', 'haa nam': 'Ninh Bình', 'ha noi': 'Thành phố Hà Nội', 'thanh pho ha noi': 'Thành phố Hà Nội',
  'hfa noi': 'Thành phố Hà Nội', 'vietmed ha noi': 'Thành phố Hà Nội',
  'ha tinh': 'Hà Tĩnh', 'tp ha tinh': 'Hà Tĩnh', 'hai duong': 'Thành phố Hải Phòng',
  'hai phong': 'Thành phố Hải Phòng', 'hcm': 'Thành phố Hồ Chí Minh',
  'ho chi minh': 'Thành phố Hồ Chí Minh', 'thanh pho ho chi minh': 'Thành phố Hồ Chí Minh',
  'tp hcm': 'Thành phố Hồ Chí Minh', 'tphcm': 'Thành phố Hồ Chí Minh',
  'hoa binh': 'Phú Thọ', 'hue': 'Thành phố Huế', 'hung yen': 'Hưng Yên',
  'lai chau': 'Lai Châu', 'lam dong': 'Lâm Đồng', 'lang son': 'Lạng Sơn',
  'lao cai': 'Lào Cai', 'lao': 'Lào Cai', 'long an': 'Tây Ninh', 'moc chau': 'Sơn La',
  'nam dinh': 'Ninh Bình', 'nghe an': 'Nghệ An', 'nghe anh': 'Nghệ An',
  'ninh binh': 'Ninh Bình', 'ninh thuan': 'Khánh Hòa', 'phu tho': 'Phú Thọ',
  'quang binh': 'Quảng Trị', 'quang nam': 'Thành phố Đà Nẵng',
  'quang ninh': 'Thành phố Quảng Ninh', 'quang tri': 'Quảng Trị',
  'son la': 'Sơn La', 'tay ninh': 'Tây Ninh', 'thai binh': 'Hưng Yên',
  'thaai binh': 'Hưng Yên', 'tp thai binh': 'Hưng Yên',
  'thai nguyen': 'Thái Nguyên', 'thanh hoa': 'Thanh Hóa',
  'tuyen quang': 'Tuyên Quang', 'vinh long': 'Vĩnh Long',
  'vinh phuc': 'Phú Thọ', 'yen bai': 'Lào Cai',
};

type ImportSummary = {
  sourceFileName: string;
  machineRows: number;
  probeRows: number;
  distinctCustomerNames: number;
  duplicateMachineSerialGroups: number;
  existingMachineSerials: number;
  duplicateProbeSerialGroups: number;
  existingProbeSerials: number;
  rowsMissingCustomer: number;
  rowsMissingModel: number;
  unresolvedInstallerNames: string[];
  unresolvedCheckerNames: string[];
  rowsMissingInstallDate: number;
  warnings: string[];
};

@Injectable()
export class DataImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(file: Express.Multer.File, actor: RequestUser) {
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as never);
    } catch {
      throw new BadRequestException('Không đọc được tệp Excel. Hãy tải lên tệp .xlsx hợp lệ.');
    }

    const parsed = parseWorkbook(workbook);
    if (!parsed.machines.length) {
      throw new BadRequestException('Không tìm thấy dòng máy có model và serial trong các sheet hỗ trợ.');
    }

    const machineSerials = [...new Set(parsed.machines.map((row) => normalizeSerial(row.serialNumber)))];
    const probeSerials = [...new Set(parsed.machines.flatMap((row) => row.accessories.map((item) => normalizeSerial(item.serialNumber))))];
    const [existingMachines, existingAccessories, users] = await Promise.all([
      this.prisma.machine.findMany({ where: { serialNumber: { in: machineSerials } }, select: { serialNumber: true } }),
      this.prisma.machineAccessory.findMany({ where: { serialNumber: { in: probeSerials } }, select: { serialNumber: true } }),
      this.prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { fullName: true, role: { select: { name: true } } } }),
    ]);

    const duplicateMachineSerials = duplicateKeys(parsed.machines.map((row) => normalizeSerial(row.serialNumber)));
    const duplicateProbeSerials = duplicateKeys(parsed.machines.flatMap((row) => row.accessories.map((item) => normalizeSerial(item.serialNumber))));
    const existingMachineSet = new Set(existingMachines.map((item) => normalizeSerial(item.serialNumber)));
    const existingAccessorySet = new Set(existingAccessories.map((item) => normalizeSerial(item.serialNumber ?? '')));
    const engineerNameCounts = countKeys(users
      .filter((user) => user.role.name === 'engineer' || user.role.name === 'admin')
      .map((user) => normalizeName(user.fullName)));
    const installerNames = new Set(parsed.machines.map((row) => row.installerName).filter(Boolean));
    const checkerNames = new Set(parsed.machines.map((row) => row.checkerName).filter(Boolean));
    const parties = new Set<string>();
    for (const row of parsed.machines) {
      if (row.buyer?.name) parties.add(normalizeName(row.buyer.name));
      if (row.endUser?.name) parties.add(normalizeName(row.endUser.name));
    }

    const summary: ImportSummary = {
      sourceFileName: safeFilename(file.originalname),
      machineRows: parsed.machines.length,
      probeRows: parsed.machines.reduce((count, row) => count + row.accessories.length, 0),
      distinctCustomerNames: parties.size,
      duplicateMachineSerialGroups: duplicateMachineSerials.size,
      existingMachineSerials: [...new Set(machineSerials)].filter((serial) => existingMachineSet.has(serial)).length,
      duplicateProbeSerialGroups: duplicateProbeSerials.size,
      existingProbeSerials: [...new Set(probeSerials)].filter((serial) => existingAccessorySet.has(serial)).length,
      rowsMissingCustomer: parsed.machines.filter((row) => !row.buyer?.name && !row.endUser?.name).length,
      rowsMissingModel: parsed.machines.filter((row) => !row.modelName).length,
      unresolvedInstallerNames: [...installerNames].filter((name) => engineerNameCounts.get(normalizeName(name)) !== 1).slice(0, 50),
      unresolvedCheckerNames: [...checkerNames].filter((name) => engineerNameCounts.get(normalizeName(name)) !== 1).slice(0, 50),
      rowsMissingInstallDate: parsed.machines.filter((row) => !row.installDate).length,
      warnings: [],
    };
    summary.warnings = buildWarnings(summary, parsed.skippedRows);

    const batch = await this.prisma.dataImportBatch.create({
      data: {
        sourceFileName: summary.sourceFileName,
        fileHash: hash,
        status: DataImportBatchStatus.PREVIEW,
        previewData: JSON.stringify(parsed),
        summary: summary as unknown as Prisma.InputJsonObject,
        createdById: actor.id,
      },
      select: { id: true, status: true, createdAt: true },
    });

    return { batchId: batch.id, status: batch.status, createdAt: batch.createdAt, summary };
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.dataImportBatch.findUnique({
      where: { id: batchId },
      select: { id: true, sourceFileName: true, status: true, summary: true, result: true, error: true, createdAt: true, updatedAt: true },
    });
    if (!batch) throw new NotFoundException('Không tìm thấy phiên nhập dữ liệu');
    return batch;
  }

  async commit(batchId: string, actor: RequestUser) {
    const batch = await this.prisma.dataImportBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Không tìm thấy phiên nhập dữ liệu');
    if (batch.status === DataImportBatchStatus.IMPORTED) return { ...batch.result as object, alreadyImported: true };
    if (batch.status === DataImportBatchStatus.IMPORTING) throw new ConflictException('Phiên nhập này đang được xử lý.');
    if (batch.status !== DataImportBatchStatus.PREVIEW && batch.status !== DataImportBatchStatus.FAILED) {
      throw new ConflictException('Phiên nhập không ở trạng thái có thể xác nhận.');
    }

    const claimed = await this.prisma.dataImportBatch.updateMany({
      where: { id: batchId, status: batch.status },
      data: { status: DataImportBatchStatus.IMPORTING, error: null },
    });
    if (!claimed.count) throw new ConflictException('Phiên nhập đã được một người khác xác nhận.');

    try {
      const parsed = JSON.parse(batch.previewData) as ParsedWorkbook;
      const result = await this.prisma.$transaction(
        (tx) => this.writeImportedData(tx, parsed, actor),
        { maxWait: 15000, timeout: 120000 },
      );
      await this.prisma.dataImportBatch.update({
        where: { id: batchId },
        data: { status: DataImportBatchStatus.IMPORTED, previewData: '[]', result: result as unknown as Prisma.InputJsonObject },
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hoàn tất nhập dữ liệu.';
      await this.prisma.dataImportBatch.update({
        where: { id: batchId },
        data: { status: DataImportBatchStatus.FAILED, error: message.slice(0, 2000) },
      });
      throw new BadRequestException(`Nhập dữ liệu chưa hoàn tất: ${message}`);
    }
  }

  private async writeImportedData(tx: Prisma.TransactionClient, parsed: ParsedWorkbook, actor: RequestUser) {
    const machineSerials = parsed.machines.map((row) => normalizeSerial(row.serialNumber));
    const machineSerialCounts = countKeys(machineSerials);
    const existingMachineRows = await tx.machine.findMany({
      where: { serialNumber: { in: [...new Set(machineSerials)] } },
      select: { serialNumber: true },
    });
    const existingMachineSerials = new Set(existingMachineRows.map((row) => normalizeSerial(row.serialNumber)));

    const usableMachines = parsed.machines.filter((row) =>
      machineSerialCounts.get(normalizeSerial(row.serialNumber)) === 1 &&
      !existingMachineSerials.has(normalizeSerial(row.serialNumber)) &&
      row.modelName.trim() && (row.buyer?.name.trim() || row.endUser?.name.trim()),
    );

    const userRows = await tx.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true, role: { select: { name: true } } },
    });
    const engineers = new Map<string, string>();
    const ambiguousEngineerNames = new Set<string>();
    for (const user of userRows) {
      if (user.role.name === 'engineer' || user.role.name === 'admin') {
        const key = normalizeName(user.fullName);
        if (engineers.has(key)) {
          engineers.delete(key);
          ambiguousEngineerNames.add(key);
        } else if (!ambiguousEngineerNames.has(key)) {
          engineers.set(key, user.id);
        }
      }
    }

    const provinces = await tx.province.findMany({ select: { id: true, name: true } });
    const provinceIdByName = new Map(provinces.map((province) => [normalizeName(province.name), province.id]));
    const machineModels = await tx.machineModel.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true, businessLineId: true, productCategory: true },
    });
    const machineModelIndex = buildImportedMachineModelIndex(machineModels);
    const existingCustomers = await tx.customer.findMany({
      select: { id: true, name: true, phone: true, customerType: true, dealerId: true, provinceId: true },
    });
    const customerIndex = buildCustomerIndex(existingCustomers);
    const partyInputs = new Map<string, { party: Party; role: 'dealer' | 'customer'; dealerKey?: string }>();
    for (const row of usableMachines) {
      const buyer = row.buyer;
      const endUser = row.endUser;
      if (buyer?.name && endUser?.name && normalizeName(buyer.name) !== normalizeName(endUser.name)) {
        const dealerKey = partyIdentity(buyer);
        mergePartyInput(partyInputs, dealerKey, { party: buyer, role: 'dealer' });
        mergePartyInput(partyInputs, partyIdentity(endUser), { party: endUser, role: 'customer', dealerKey });
      } else {
        const customer = endUser?.name ? endUser : buyer;
        if (customer?.name) mergePartyInput(partyInputs, partyIdentity(customer), { party: customer, role: 'customer' });
      }
    }

    const partyIds = new Map<string, string>();
    const reusedPartyKeys = new Set<string>();
    const orderedParties = [...partyInputs.entries()].sort((a, b) => Number(b[1].role === 'dealer') - Number(a[1].role === 'dealer'));
    let createdCustomers = 0;
    let reusedCustomers = 0;
    for (const [key, input] of orderedParties) {
      const existing = findCustomerMatch(customerIndex, input.party, input.role);
      if (existing) {
        partyIds.set(key, existing.id);
        reusedPartyKeys.add(key);
        reusedCustomers += 1;
        const provinceId = resolveImportedProvinceId(input.party.province, provinceIdByName);
        if (!existing.provinceId && provinceId) {
          await tx.customer.update({ where: { id: existing.id }, data: { provinceId } });
          existing.provinceId = provinceId;
        }
        continue;
      }
      const dealerId = input.dealerKey ? partyIds.get(input.dealerKey) : undefined;
      if (input.role === 'customer' && input.dealerKey && !dealerId) continue;
      const contacts = partyContact(input.party);
      const contact = contacts[0];
      const created = await tx.customer.create({
        data: {
          name: input.party.name.trim(),
          customerType: input.role === 'dealer' ? CustomerType.DISTRIBUTOR : inferCustomerType(input.party.name),
          status: CustomerStatus.ACTIVE,
          salesChannel: input.role === 'dealer' ? null : dealerId ? CustomerSalesChannel.DEALER : CustomerSalesChannel.DIRECT,
          dealerId: dealerId ?? null,
          importReviewRegionId: actor.regionId,
          phone: input.party.phone || null,
          contactPerson: contact?.name || null,
          contactPosition: contact?.position || null,
          contactPhone: contact?.phone || null,
          contactEmail: contact?.email || null,
          province: input.party.province || null,
          provinceId: resolveImportedProvinceId(input.party.province, provinceIdByName),
          address: input.party.address || null,
          fullAddress: [input.party.address, input.party.province].filter(Boolean).join(', ') || null,
          regionId: null,
          contacts: contacts.length ? { create: contacts.map((item, index) => ({ ...item, isPrimary: index === 0 })) } : undefined,
        },
        select: { id: true, name: true, phone: true, customerType: true, dealerId: true, provinceId: true },
      });
      partyIds.set(key, created.id);
      addCustomerToIndex(customerIndex, created);
      createdCustomers += 1;
    }

    const reusedCustomerIds = [...new Set([...reusedPartyKeys].map((key) => partyIds.get(key)).filter(Boolean) as string[])];
    const existingContacts = reusedCustomerIds.length
      ? await tx.customerContact.findMany({ where: { customerId: { in: reusedCustomerIds } }, select: { customerId: true, name: true, phone: true, email: true, position: true } })
      : [];
    const contactKeys = new Set(existingContacts.map((contact) => contactIdentity(contact.customerId, contact)));
    const contactsToCreate: Prisma.CustomerContactCreateManyInput[] = [];
    for (const key of reusedPartyKeys) {
      const customerId = partyIds.get(key);
      const input = partyInputs.get(key);
      if (!customerId || !input) continue;
      for (const contact of partyContact(input.party)) {
        const keyForContact = contactIdentity(customerId, contact);
        if (contactKeys.has(keyForContact)) continue;
        contactKeys.add(keyForContact);
        contactsToCreate.push({ customerId, ...contact, isPrimary: false });
      }
    }
    if (contactsToCreate.length) await tx.customerContact.createMany({ data: contactsToCreate });

    const machineCustomerIds = new Map<ImportedMachine, string>();
    const machineRowsToCreate: Prisma.MachineCreateManyInput[] = [];
    let skippedMissingParty = 0;
    for (const row of usableMachines) {
      const customerParty = row.endUser?.name ? row.endUser : row.buyer;
      const customerKey = customerParty ? partyIdentity(customerParty) : '';
      const customerId = customerKey ? partyIds.get(customerKey) : undefined;
      if (!customerId) {
        skippedMissingParty += 1;
        continue;
      }
      machineCustomerIds.set(row, customerId);
      const installerId = row.installerName ? engineers.get(normalizeName(row.installerName)) : undefined;
      const machineModel = row.hasCatalogModel !== false
        ? resolveImportedMachineModel(row.modelName, machineModelIndex)
        : null;
      machineRowsToCreate.push({
        serialNumber: normalizeSerial(row.serialNumber),
        name: row.modelName.trim(),
        modelName: row.modelName.trim(),
        manufacturer: '',
        // The source sheet is authoritative for imports: an ultrasound model
        // stays ultrasound even if the catalogue has a conflicting category,
        // and machines from "Máy khác" remain in the OTHER bucket.
        productCategory: row.category,
        status: MachineStatus.ACTIVE,
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        dataStatus: OperationalDataStatus.PENDING_REVIEW,
        createdSource: OperationalCreatedSource.IMPORT,
        installDate: row.installDate ? new Date(`${row.installDate}T00:00:00.000Z`) : null,
        machineModelId: machineModel?.id ?? null,
        businessLineId: machineModel?.businessLineId ?? null,
        customerId,
        importReviewRegionId: actor.regionId,
        installedById: installerId ?? null,
        installedByNameSnapshot: row.installerName || null,
        checkedByNameSnapshot: row.checkerName || null,
        primaryEngineerId: null,
      });
    }

    if (machineRowsToCreate.length) await tx.machine.createMany({ data: machineRowsToCreate });
    const createdSerials = machineRowsToCreate.map((row) => String(row.serialNumber));
    const createdMachines = createdSerials.length
      ? await tx.machine.findMany({ where: { serialNumber: { in: createdSerials } }, select: { id: true, serialNumber: true, customerId: true, installedById: true } })
      : [];
    const machineBySerial = new Map(createdMachines.map((machine) => [normalizeSerial(machine.serialNumber), machine]));
    const probeInputs: Prisma.MachineAccessoryCreateManyInput[] = [];
    const accessorySerialCounts = countKeys(parsed.machines.flatMap((row) => row.accessories.map((item) => normalizeSerial(item.serialNumber))));
    const candidateProbeSerials = parsed.machines.flatMap((row) => row.accessories.map((item) => normalizeSerial(item.serialNumber)));
    const existingProbeRows = candidateProbeSerials.length
      ? await tx.machineAccessory.findMany({ where: { serialNumber: { in: [...new Set(candidateProbeSerials)] } }, select: { serialNumber: true } })
      : [];
    const existingProbeSet = new Set(existingProbeRows.map((item) => normalizeSerial(item.serialNumber ?? '')));
    let skippedProbeSerials = 0;
    for (const row of usableMachines) {
      const machine = machineBySerial.get(normalizeSerial(row.serialNumber));
      if (!machine) continue;
      for (const accessory of row.accessories) {
        const serialNumber = normalizeSerial(accessory.serialNumber);
        if (accessorySerialCounts.get(serialNumber) !== 1 || existingProbeSet.has(serialNumber)) {
          skippedProbeSerials += 1;
          continue;
        }
        probeInputs.push({ machineId: machine.id, code: accessory.code, name: accessory.code, serialNumber, quantity: 1 });
      }
    }
    if (probeInputs.length) await tx.machineAccessory.createMany({ data: probeInputs });

    const installations: Prisma.MachineInstallationCreateManyInput[] = [];
    const movements: Prisma.MachineInventoryMovementCreateManyInput[] = [];
    for (const row of usableMachines) {
      if (!row.installDate) continue;
      const machine = machineBySerial.get(normalizeSerial(row.serialNumber));
      const customerId = machineCustomerIds.get(row);
      if (!machine || !customerId) continue;
      const occurredAt = new Date(`${row.installDate}T00:00:00.000Z`);
      const stableRef = createHash('sha256').update(`${row.sheet}|${row.sourceRow}|${row.serialNumber}`).digest('hex').slice(0, 12).toUpperCase();
      installations.push({
        code: `LEGACY-${stableRef}`,
        status: InstallationStatus.INSTALLED,
        machineId: machine.id,
        customerId,
        installedById: row.installerName ? engineers.get(normalizeName(row.installerName)) ?? null : null,
        installedAt: occurredAt,
        accessories: row.accessories.map((item) => ({ code: item.code, serialNumber: item.serialNumber })),
        note: `Nhập từ tệp lịch sử ${row.sheet}, dòng ${row.sourceRow}.`,
        handoverInstallerName: row.installerName || null,
        checkedByNameSnapshot: row.checkerName || null,
        legacySourceSheet: row.sheet,
        legacySourceRow: row.sourceRow,
        reviewStatus: WorkReviewStatus.NOT_REQUIRED,
      });
      movements.push({
        code: `LEGACY-INSTALL-${stableRef}`,
        type: InventoryMovementType.INSTALL,
        machineId: machine.id,
        fromStatus: null,
        toStatus: MachineInventoryStatus.INSTALLED,
        occurredAt,
        note: `Nhập lịch sử lắp đặt từ ${row.sheet}, dòng ${row.sourceRow}.`,
        customerId,
        createdById: actor.id,
      });
    }
    if (installations.length) await tx.machineInstallation.createMany({ data: installations });
    if (movements.length) await tx.machineInventoryMovement.createMany({ data: movements });

    const skippedDuplicateMachines = parsed.machines.filter((row) =>
      machineSerialCounts.get(normalizeSerial(row.serialNumber)) !== 1 || existingMachineSerials.has(normalizeSerial(row.serialNumber)),
    ).length;
    return {
      createdCustomers,
      reusedCustomers,
      createdMachines: machineRowsToCreate.length,
      createdProbes: probeInputs.length,
      createdInstallationHistory: installations.length,
      createdInventoryMovements: movements.length,
      skippedDuplicateMachines,
      skippedProbeSerials,
      skippedMissingParty,
      missingInstallDate: usableMachines.filter((row) => !row.installDate).length,
    };
  }
}

function parseWorkbook(workbook: ExcelJS.Workbook): ParsedWorkbook {
  const machines: ImportedMachine[] = [];
  let skippedRows = 0;
  for (const worksheet of workbook.worksheets) {
    const name = worksheet.name.trim();
    if (!['Siêu âm', 'Xét nghiệm', 'Máy khác'].includes(name)) continue;
    const isUltrasound = name === 'Siêu âm';
    let year: number | null = null;
    let activeMachine: ImportedMachine | null = null;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const yearFromRow = extractYear(cellText(row, 1), cellText(row, 3));
      if (yearFromRow) year = yearFromRow;
      const serial = cellText(row, 5);
      const catalogModel = cellText(row, isUltrasound ? 3 : 4);
      const machineName = name === 'Máy khác' ? catalogModel || cellText(row, 3) : catalogModel;
      const category = isUltrasound ? '' : cellText(row, 3);
      const probeCode = isUltrasound ? cellText(row, 4) : '';
      if (!serial || /^(s\/?n|serial|serial number)$/i.test(serial)) return;

      if (isUltrasound && !catalogModel && probeCode) {
        if (activeMachine) activeMachine.accessories.push({ code: probeCode, serialNumber: serial, sourceRow: rowNumber });
        else skippedRows += 1;
        return;
      }
      if (!machineName) {
        skippedRows += 1;
        return;
      }

      const buyer = readParty(row, { name: 9, address: 10, province: 11, phone: 12, contactName: 13, contactPosition: 14, contactEmail: 15 });
      const endUser = readParty(row, { name: 16, address: 17, province: 18, phone: 19, contactName: 20, contactPosition: 21, contactEmail: 22 });
      const installedAt = parseDate(row.getCell(6).value, cellText(row, 6), year);
      activeMachine = {
        sheet: name,
        sourceRow: rowNumber,
        serialNumber: serial,
        modelName: machineName,
        hasCatalogModel: Boolean(catalogModel),
        category: inferCategory(name, category),
        installDate: installedAt,
        buyer: buyer.name ? buyer : null,
        endUser: endUser.name ? endUser : null,
        installerName: cellText(row, 24),
        checkerName: cellText(row, 25),
        accessories: [],
      };
      machines.push(activeMachine);
    });
  }
  return { machines, skippedRows };
}

function cellText(row: ExcelJS.Row, column: number): string {
  const cell = row.getCell(column);
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && !(value instanceof Date)) {
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((item) => item.text).join('').trim();
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('result' in value) return String(value.result ?? '').trim();
  }
  return cell.text.trim();
}

function readParty(row: ExcelJS.Row, columns: { name: number; address: number; province: number; phone: number; contactName: number; contactPosition: number; contactEmail: number }): Party {
  return {
    name: cellText(row, columns.name),
    address: cellText(row, columns.address),
    province: cellText(row, columns.province),
    phone: cellText(row, columns.phone),
    contactName: cellText(row, columns.contactName),
    contactPhone: cellText(row, columns.phone),
    contactPosition: cellText(row, columns.contactPosition),
    contactEmail: normalizeEmail(cellText(row, columns.contactEmail)),
  };
}

function parseDate(value: ExcelJS.CellValue, text: string, year: number | null): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const dateText = text.trim();
  if (!dateText) return null;
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const match = dateText.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (match) {
    let resolvedYear = match[3] ? Number(match[3]) : year;
    if (resolvedYear !== null && resolvedYear < 100) resolvedYear += 2000;
    if (!resolvedYear) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const date = new Date(Date.UTC(resolvedYear, month - 1, day));
    if (date.getUTCFullYear() !== resolvedYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(dateText);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function extractYear(...values: string[]): number | null {
  for (const value of values) {
    const match = value.match(/(?:năm\s*)?(20\d{2})/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function inferCategory(sheet: string, rawCategory: string): MachineProductCategory {
  if (sheet === 'Siêu âm') return MachineProductCategory.ULTRASOUND;
  if (sheet === 'Máy khác') return MachineProductCategory.OTHER;
  const value = normalizeName(rawCategory);
  if (sheet === 'Xét nghiệm') {
    if (value.includes('sinh hoa')) return MachineProductCategory.BIOCHEMISTRY;
    if (value.includes('mien dich')) return MachineProductCategory.IMMUNOLOGY;
    if (value.includes('huyet hoc')) return MachineProductCategory.HEMATOLOGY;
    return MachineProductCategory.LAB_TESTING;
  }
  if (value.includes('x quang') || value.includes('x-ray') || value.includes('xray')) return MachineProductCategory.X_RAY;
  if (value.includes('noi soi')) return MachineProductCategory.ENDOSCOPY;
  if (value.includes('sieu am')) return MachineProductCategory.ULTRASOUND;
  if (value.includes('huyet hoc')) return MachineProductCategory.HEMATOLOGY;
  if (value.includes('sinh hoa')) return MachineProductCategory.BIOCHEMISTRY;
  if (value.includes('mien dich')) return MachineProductCategory.IMMUNOLOGY;
  return MachineProductCategory.OTHER;
}

function inferCustomerType(name: string): CustomerType {
  const value = normalizeName(name);
  if (value.includes('benh vien')) return CustomerType.HOSPITAL;
  if (value.includes('phong kham')) return CustomerType.CLINIC;
  if (value.includes('xet nghiem') || value.includes('laboratory')) return CustomerType.LAB;
  if (value.includes('truong') || value.includes('dai hoc')) return CustomerType.UNIVERSITY;
  return CustomerType.COMPANY;
}

function partyContact(party: Party): PartyContact[] {
  if (party.contacts) return party.contacts;
  if (![party.contactName, party.contactPhone, party.contactEmail, party.contactPosition].some(Boolean)) return [];
  return [{ name: party.contactName || 'Liên hệ nhập từ Excel', phone: party.contactPhone || null, email: party.contactEmail || null, position: party.contactPosition || null }];
}

function mergePartyInput(
  inputs: Map<string, { party: Party; role: 'dealer' | 'customer'; dealerKey?: string }>,
  key: string,
  incoming: { party: Party; role: 'dealer' | 'customer'; dealerKey?: string },
) {
  const existing = inputs.get(key);
  if (!existing) {
    inputs.set(key, { ...incoming, party: { ...incoming.party, contacts: partyContact(incoming.party) } });
    return;
  }
  const contacts = new Map<string, PartyContact>();
  for (const contact of [...partyContact(existing.party), ...partyContact(incoming.party)]) {
    contacts.set(contactIdentity('', contact), contact);
  }
  existing.party = {
    ...existing.party,
    address: existing.party.address || incoming.party.address,
    province: existing.party.province || incoming.party.province,
    phone: existing.party.phone || incoming.party.phone,
    contacts: [...contacts.values()],
  };
}

function contactIdentity(customerId: string, contact: PartyContact) {
  return `${customerId}|${normalizeName(contact.name)}|${normalizePhone(contact.phone ?? '')}|${normalizeEmail(contact.email ?? '')}`;
}

function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function resolveImportedProvinceId(province: string, provinceIdByName: Map<string, string>) {
  const sourceName = normalizeName(province);
  if (!sourceName) return null;
  const targetName = IMPORTED_PROVINCE_ALIASES[sourceName];
  return targetName ? provinceIdByName.get(normalizeName(targetName)) ?? null : null;
}

type ImportedMachineModelOption = {
  id: string;
  name: string;
  code: string;
  businessLineId: string;
  productCategory: MachineProductCategory;
};

function buildImportedMachineModelIndex(models: ImportedMachineModelOption[]) {
  const byName = new Map<string, ImportedMachineModelOption | null>();
  const byCode = new Map<string, ImportedMachineModelOption | null>();
  const add = (index: Map<string, ImportedMachineModelOption | null>, rawKey: string, model: ImportedMachineModelOption) => {
    const key = normalizeModelKey(rawKey);
    if (!key) return;
    if (index.has(key)) index.set(key, null);
    else index.set(key, model);
  };
  for (const model of models) {
    add(byName, model.name, model);
    add(byCode, model.code, model);
  }
  return { byName, byCode };
}

function resolveImportedMachineModel(
  rawName: string,
  index: ReturnType<typeof buildImportedMachineModelIndex>,
) {
  const key = normalizeModelKey(rawName);
  if (index.byName.has(key)) return index.byName.get(key) ?? null;
  return index.byCode.get(key) ?? null;
}

function normalizeModelKey(value: string) {
  return normalizeName(value).replace(/\s/g, '');
}

function normalizeSerial(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function partyIdentity(party: Party) {
  return `${normalizeName(party.name)}|${normalizePhone(party.phone)}`;
}

function duplicateKeys(values: string[]) {
  const counts = countKeys(values);
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

function countKeys(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function buildWarnings(summary: ImportSummary, skippedRows: number) {
  const warnings: string[] = [];
  if (summary.duplicateMachineSerialGroups) warnings.push(`${summary.duplicateMachineSerialGroups} nhóm serial máy bị lặp; các dòng đó sẽ được bỏ qua.`);
  if (summary.existingMachineSerials) warnings.push(`${summary.existingMachineSerials} serial máy đã có trong hệ thống; không ghi đè dữ liệu hiện tại.`);
  if (summary.duplicateProbeSerialGroups) warnings.push(`${summary.duplicateProbeSerialGroups} nhóm serial đầu dò bị lặp; đầu dò đó sẽ được bỏ qua.`);
  if (summary.existingProbeSerials) warnings.push(`${summary.existingProbeSerials} serial đầu dò đã có trong hệ thống.`);
  if (summary.rowsMissingCustomer) warnings.push(`${summary.rowsMissingCustomer} dòng máy chưa có khách hàng sử dụng, sẽ được bỏ qua.`);
  if (summary.rowsMissingInstallDate) warnings.push(`${summary.rowsMissingInstallDate} máy thiếu ngày lắp đặt; máy và tên kỹ thuật viên vẫn được lưu nhưng không tạo mốc lịch sử lắp đặt.`);
  if (summary.unresolvedInstallerNames.length || summary.unresolvedCheckerNames.length) warnings.push('Một số tên kỹ sư không khớp duy nhất với tài khoản đang hoạt động; sẽ giữ tên lịch sử và không tự gán tài khoản.');
  if (skippedRows) warnings.push(`${skippedRows} dòng phụ/thiếu dữ liệu nhận diện máy sẽ không được nhập thành máy.`);
  return warnings;
}

function safeFilename(value: string) {
  return value.replace(/[\\/\0]/g, '_').slice(0, 190) || 'import.xlsx';
}

type ExistingCustomer = { id: string; name: string; phone: string | null; customerType: CustomerType; dealerId: string | null; provinceId: string | null };

function buildCustomerIndex(customers: ExistingCustomer[]) {
  const map = new Map<string, ExistingCustomer[]>();
  for (const customer of customers) {
    const key = normalizeName(customer.name);
    map.set(key, [...(map.get(key) ?? []), customer]);
  }
  return map;
}

function findCustomerMatch(index: Map<string, ExistingCustomer[]>, party: Party, role: 'dealer' | 'customer') {
  const matches = (index.get(normalizeName(party.name)) ?? []).filter((customer) =>
    role === 'dealer' ? customer.customerType === CustomerType.DISTRIBUTOR : customer.customerType !== CustomerType.DISTRIBUTOR,
  );
  const phone = normalizePhone(party.phone);
  if (phone) return matches.find((customer) => normalizePhone(customer.phone ?? '') === phone) ?? null;
  return matches.length === 1 ? matches[0] : null;
}

function addCustomerToIndex(index: Map<string, ExistingCustomer[]>, customer: ExistingCustomer) {
  const key = normalizeName(customer.name);
  index.set(key, [...(index.get(key) ?? []), customer]);
}
