import { sequenceCode } from '../common/sequence-code';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DemoMachineCategory,
  DemoLoanStatus,
  InstallationStatus,
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
  Prisma,
  WarrantyStatus,
  WorkReviewStatus,
} from '@prisma/client';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import {
  installationAccessWhere,
  isAdmin,
  isEngineer,
  isManager,
} from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { ReviewWorkTaskDto } from '../common/dto/review-work-task.dto';
import { normalizeCodeSegment, shortDateCode } from '../common/code-format';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { validateInventoryMovement } from '../machines/machine-state.rules';
import { MachinesService } from '../machines/machines.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { ListInstallationsQueryDto } from './dto/list-installations-query.dto';
import { UpdateInstallationDto } from './dto/update-installation.dto';
import { UpdateInstallationStatusDto } from './dto/update-installation-status.dto';
import { ensureInstallationStatusTransitionIsAllowed } from './installation-status.rules';

@Injectable()
export class InstallationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly machinesService: MachinesService,
  ) {}

  async create(dto: CreateInstallationDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.INSTALLATION_CREATE);
    const selfSubmission = isEngineer(actor);
    if (!isAdmin(actor) && !selfSubmission)
      throw new ForbiddenException(
        'Only administrators or engineers can create installation tickets',
      );
    this.validateCreate(selfSubmission
      ? { ...dto, installedById: actor.id, engineerIds: [actor.id] }
      : dto);

    const engineerIds = selfSubmission ? [actor.id] : [
      ...new Set(
        dto.engineerIds?.length
          ? dto.engineerIds
          : dto.installedById
            ? [dto.installedById]
            : [],
      ),
    ];
    const installedById = engineerIds[0];

    await Promise.all(
      engineerIds.map((engineerId) => this.findEngineer(engineerId)),
    );
    const [selectedMachine, customer, engineer, businessLine, machineModel] =
      await Promise.all([
        dto.machineId ? this.findMachine(dto.machineId) : Promise.resolve(null),
        this.findCustomer(dto.customerId),
        this.findEngineer(installedById),
        this.findBusinessLine(dto.businessLineId),
        dto.machineModelId
          ? this.findMachineModel(dto.machineModelId)
          : Promise.resolve(null),
      ]);

    if (selectedMachine?.demoCategory === DemoMachineCategory.DEMO_UNIT) {
      throw new BadRequestException(
        'Dedicated demo machines must be returned through a demo loan, not installed as customer equipment',
      );
    }

    if (selectedMachine?.inventoryStatus === MachineInventoryStatus.INSTALLED) {
      throw new BadRequestException('Machine is already installed');
    }
    if (
      selectedMachine &&
      selectedMachine.inventoryStatus !== MachineInventoryStatus.IN_STOCK
    ) {
      throw new BadRequestException(
        'Only machines currently in stock can be selected for installation',
      );
    }

    if (selectedMachine) {
      await this.assertEngineerCanUseMachine(actor, selectedMachine);
    }

    const installedAt =
      this.parseOptionalDate(dto.installedAt, 'installedAt') ?? new Date();
    if (
      selfSubmission &&
      !selectedMachine &&
      !dto.machineModelId &&
      !dto.plannedModelName?.trim()
    ) {
      throw new BadRequestException(
        'An engineer installation report must include a machine or device model',
      );
    }
    const warrantyStartDate =
      this.parseOptionalDate(dto.warrantyStartDate, 'warrantyStartDate') ??
      installedAt;
    const warrantyEndDate = this.parseOptionalDate(
      dto.warrantyEndDate,
      'warrantyEndDate',
    );

    if (warrantyEndDate && warrantyEndDate < warrantyStartDate) {
      throw new BadRequestException(
        'warrantyEndDate must be after warrantyStartDate',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const machine = selectedMachine;
        const installationCode = await this.generateInstallationCode(
          tx,
          installedAt,
        );
      const installation = await tx.machineInstallation.create({
        data: {
            code: installationCode,
            status: InstallationStatus.PENDING,
            machineId: machine?.id ?? null,
            plannedMachineModelId: machineModel?.id ?? null,
            plannedModelName:
              machineModel?.name ?? dto.plannedModelName?.trim() ?? null,
            customerId: customer.id,
            businessLineId:
              businessLine?.id ??
              machine?.businessLineId ??
              machineModel?.businessLineId ??
              null,
            installedById: engineer.id,
            installedAt,
            accessories: this.normalizeAccessories(dto.accessories),
            note: dto.note?.trim() || null,
            warrantyStartDate,
            warrantyEndDate,
            warrantyNote: dto.warrantyNote?.trim() || null,
            handoverInstallerName: this.cleanOptionalString(
              dto.handoverInstallerName,
            ),
            handoverInstallerPosition: this.cleanOptionalString(
              dto.handoverInstallerPosition,
            ),
            handoverVehicle: this.cleanOptionalString(dto.handoverVehicle),
            handoverDepartureDate: this.parseOptionalDate(
              dto.handoverDepartureDate,
              'handoverDepartureDate',
            ),
            receiverInstallAddress: this.cleanOptionalString(
              dto.receiverInstallAddress,
            ),
            receiverRepresentative: this.cleanOptionalString(
              dto.receiverRepresentative,
            ),
            receiverPosition: this.cleanOptionalString(dto.receiverPosition),
            receiverPhone: this.cleanOptionalString(dto.receiverPhone),
            installedDeviceItems: this.normalizeDeviceItems(
              this.withPrimaryMachineDraft(dto, machineModel),
            ),
            deviceCondition: dto.deviceCondition || 'NEW_100',
            deviceConditionNote: this.cleanOptionalString(
              dto.deviceConditionNote,
            ),
            reviewStatus: selfSubmission
              ? WorkReviewStatus.PENDING
              : WorkReviewStatus.NOT_REQUIRED,
          },
        });

        await tx.installationAssignment.createMany({
          data: engineerIds.map((engineerId, index) => ({
            installationId: installation.id,
            engineerId,
            isLead: index === 0,
          })),
        });

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.CREATE_INSTALLATION,
            entityType: 'MachineInstallation',
            entityId: installation.id,
            actor,
            metadata: {
              code: installationCode,
              machineId: machine?.id ?? null,
              serialNumber: machine?.serialNumber ?? null,
              plannedMachineModelId: machineModel?.id ?? null,
              plannedModelName:
                machineModel?.name ?? dto.plannedModelName?.trim() ?? null,
              customerId: customer.id,
              installedById: engineer.id,
              status: InstallationStatus.PENDING,
            },
          },
          tx,
        );

        if (selfSubmission) {
          await this.notificationsService.createForAdmins({
            title: 'Phiếu lắp đặt chờ phê duyệt',
            message: `Phiếu lắp đặt ${installationCode} đã được trình phê duyệt.`,
            href: '/installations',
            entityType: 'MachineInstallation',
            entityId: installation.id,
            createdById: actor.id,
          }, tx);
        } else await Promise.all(
          engineerIds.map((engineerId) =>
            this.notificationsService.create(
              {
                userId: engineerId,
                title: 'Phiếu lắp đặt mới được phân công',
                message: `Phiếu lắp đặt ${installationCode} đã được phân công.`,
                href: '/my-tasks',
                entityType: 'MachineInstallation',
                entityId: installation.id,
                createdById: actor.id,
              },
              tx,
            ),
          ),
        );

        return tx.machineInstallation.findUnique({
          where: { id: installation.id },
          include: this.defaultInclude(),
        });
      },
      { timeout: 20_000 },
    );
  }

  async findAll(
    query: ListInstallationsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machineInstallation.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [
          { createdAt: 'desc' },
          { updatedAt: 'desc' },
          { installedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.machineInstallation.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string, user?: RequestUser) {
    const installation = await this.prisma.machineInstallation.findFirst({
      where: this.withAccessScope({ id }, user),
      include: this.defaultInclude(),
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    return installation;
  }

  async generateHandoverDocx(id: string, user?: RequestUser) {
    const installation = (await this.findOne(id, user)) as any;
    const deviceRows = this.buildHandoverDeviceRows(installation);
    const titleRun = (text: string) =>
      new TextRun({ text, bold: true, size: 24, font: 'Times New Roman' });
    const normalRun = (text: string, options: { bold?: boolean } = {}) =>
      new TextRun({
        text,
        bold: options.bold,
        size: 24,
        font: 'Times New Roman',
      });

    const document = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: borderlessTableBorders(),
              rows: [
                new TableRow({
                  children: [
                    docCell([
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'VIETMED',
                            bold: true,
                            size: 28,
                            font: 'Arial',
                          }),
                        ],
                      }),
                      docParagraph('Đối tác chuyên nghiệp', { size: 18 }),
                    ]),
                    docCell([
                      docParagraph(
                        'CÔNG TY TNHH THIẾT BỊ VÀ CÔNG NGHỆ Y TẾ VIỆT NAM',
                        { bold: true, align: AlignmentType.CENTER },
                      ),
                      docParagraph(
                        'Lô D24-NV14, Ô 6, Khu D, KĐT Lê Trọng Tấn - Geleximco, P. Dương Nội, Tp. Hà Nội',
                        { size: 20, align: AlignmentType.CENTER },
                      ),
                      docParagraph(
                        'Hotline: 1800 6844    vietmed@vnn.vn    www.vietmed.vn',
                        { size: 20, align: AlignmentType.CENTER },
                      ),
                    ]),
                    docCell([
                      docParagraph('BM-KTH-01-01', {
                        bold: true,
                        align: AlignmentType.CENTER,
                      }),
                      docParagraph('Ngày BH: 25/12/2020', {
                        size: 20,
                        align: AlignmentType.CENTER,
                      }),
                      docParagraph('Lần ban hành: 03', {
                        size: 20,
                        align: AlignmentType.CENTER,
                      }),
                    ]),
                  ],
                }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({
                  text: 'PHIẾU BÀN GIAO VÀ BẢO HÀNH THIẾT BỊ',
                  bold: true,
                  size: 32,
                  font: 'Times New Roman',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                normalRun(
                  `${installation.customer?.province || installation.customer?.region?.name || '........'}, ${formatVietnameseFullDate(
                    installation.installedAt,
                  )}`,
                ),
              ],
            }),
            docParagraph('BÊN BÀN GIAO:', { bold: true, underline: true }),
            docFieldLine(
              'Công ty TNHH Thiết bị và Công nghệ Y tế Việt Nam (Vietmed)',
            ),
            docTwoColumns(
              `Người lắp đặt: ${docValue(
                installation.handoverInstallerName ||
                  installation.installedBy?.fullName ||
                  installation.installedBy?.email,
              )}`,
              `Chức vụ: ${docValue(
                installation.handoverInstallerPosition ||
                  installation.installedBy?.engineerProfile?.position,
              )}`,
            ),
            docTwoColumns(
              `Phương tiện đi: ${docValue(installation.handoverVehicle)}`,
              `Ngày đi: ${formatShortDate(installation.handoverDepartureDate)}`,
            ),
            docParagraph('BÊN NHẬN BÀN GIAO:', { bold: true, underline: true }),
            docFieldLine(docValue(installation.customer?.name)),
            docFieldLine(
              `Địa chỉ lắp đặt: ${docValue(
                installation.receiverInstallAddress ||
                  installation.customer?.address,
              )}`,
            ),
            docTwoColumns(
              `Người đại diện: ${docValue(installation.receiverRepresentative)}`,
              `Chức vụ: ${docValue(installation.receiverPosition)}`,
            ),
            docFieldLine(`ĐT: ${docValue(installation.receiverPhone)}`),
            docParagraph('DANH MỤC THIẾT BỊ LẮP ĐẶT', {
              bold: true,
              size: 28,
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    docHeaderCell('TT'),
                    docHeaderCell('Tên hàng'),
                    docHeaderCell('Model'),
                    docHeaderCell('S/N'),
                    docHeaderCell('Ngày/tháng/năm SX'),
                    docHeaderCell('SL'),
                    docHeaderCell('Thời gian BH'),
                  ],
                }),
                ...deviceRows.map(
                  (item, index) =>
                    new TableRow({
                      children: [
                        docBodyCell(String(index + 1), {
                          align: AlignmentType.CENTER,
                        }),
                        docBodyCell(item.itemName),
                        docBodyCell(item.model),
                        docBodyCell(item.serialNumber),
                        docBodyCell(formatShortDate(item.manufactureDate)),
                        docBodyCell(String(item.quantity || 1), {
                          align: AlignmentType.CENTER,
                        }),
                        docBodyCell(
                          item.warrantyPeriod ||
                            formatWarrantyPeriod(
                              installation.warrantyStartDate ||
                                installation.warrantyCard?.startDate,
                              installation.warrantyEndDate ||
                                installation.warrantyCard?.endDate,
                            ),
                        ),
                      ],
                    }),
                ),
                ...Array.from({
                  length: Math.max(0, 6 - deviceRows.length),
                }).map(
                  () =>
                    new TableRow({
                      children: [
                        docBodyCell(''),
                        docBodyCell(''),
                        docBodyCell(''),
                        docBodyCell(''),
                        docBodyCell(''),
                        docBodyCell(''),
                        docBodyCell(''),
                      ],
                    }),
                ),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                titleRun('Tình trạng thiết bị: '),
                normalRun(
                  installation.deviceCondition === 'OTHER'
                    ? `☐ mới 100%.    ☑ Khác: ${docValue(
                        installation.deviceConditionNote,
                      )}`
                    : '☑ mới 100%.    ☐ Khác',
                ),
              ],
            }),
            docParagraph('Bên bàn giao:', { bold: true }),
            docParagraph('- Đã lắp đặt và vận hành máy hoạt động bình thường'),
            docParagraph(
              '- Đã hướng dẫn cho khách hàng quy trình hoạt động, cách sử dụng thiết bị, các lưu ý trong khi sử dụng. Khách hàng đã thực hành các quy trình được hướng dẫn đạt kết quả tốt.',
            ),
            ...(installation.note
              ? [docParagraph(`Ghi chú lắp đặt: ${installation.note}`)]
              : []),
            ...(installation.warrantyNote
              ? [docParagraph(`Ghi chú bảo hành: ${installation.warrantyNote}`)]
              : []),
            docFieldLine('Bên nhận bàn giao'),
            docParagraph(
              '* Biên bản có hiệu lực từ ngày ký, mỗi bên giữ 01 (một) bản./',
              { italics: true },
            ),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: borderlessTableBorders(),
              rows: [
                new TableRow({
                  children: [
                    signatureCell('BÊN BÀN GIAO'),
                    signatureCell('BÊN NHẬN BÀN GIAO'),
                  ],
                }),
                new TableRow({
                  children: [
                    signatureNameCell(
                      installation.handoverInstallerName ||
                        installation.installedBy?.fullName,
                    ),
                    signatureNameCell(installation.receiverRepresentative),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(document);
    return {
      buffer,
      filename: `phieu-ban-giao-${safeFilename(installation.code || id)}.docx`,
    };
  }

  async update(id: string, dto: UpdateInstallationDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.INSTALLATION_UPDATE);
    const installation = await this.findOne(id, actor);
    if (dto.status) {
      ensureInstallationStatusTransitionIsAllowed(
        installation.status,
        dto.status,
      );
    }
    const installedBy = dto.installedById
      ? await this.findEngineer(dto.installedById)
      : null;
    const businessLine =
      dto.businessLineId === undefined
        ? undefined
        : await this.findBusinessLine(dto.businessLineId);
    const installedAt = this.parseOptionalDate(dto.installedAt, 'installedAt');
    const warrantyStartDate = this.parseOptionalDate(
      dto.warrantyStartDate,
      'warrantyStartDate',
    );
    const warrantyEndDate = this.parseOptionalDate(
      dto.warrantyEndDate,
      'warrantyEndDate',
    );
    const handoverDepartureDate = this.parseOptionalDate(
      dto.handoverDepartureDate,
      'handoverDepartureDate',
    );
    const nextWarrantyStartDate =
      warrantyStartDate ??
      installation.warrantyStartDate ??
      installation.warrantyCard?.startDate ??
      null;
    const nextWarrantyEndDate =
      warrantyEndDate ??
      installation.warrantyEndDate ??
      installation.warrantyCard?.endDate ??
      null;

    if (
      nextWarrantyStartDate &&
      nextWarrantyEndDate &&
      nextWarrantyEndDate < nextWarrantyStartDate
    ) {
      throw new BadRequestException(
        'warrantyEndDate must be after warrantyStartDate',
      );
    }

    const isAssignedEngineerCompleting =
      isEngineer(actor) &&
      (installation.installedById === actor.id ||
        installation.assignments?.some(
          (assignment) => assignment.engineerId === actor.id,
        )) &&
      installation.status === InstallationStatus.PENDING &&
      dto.status === InstallationStatus.INSTALLED;
    const isAdminApprovingInstallation =
      (isAdmin(actor) || isManager(actor)) &&
      (installation.status === InstallationStatus.PENDING ||
        installation.reviewStatus === WorkReviewStatus.PENDING) &&
      dto.status === InstallationStatus.INSTALLED;
    const deviceItemsToComplete =
      dto.installedDeviceItems ??
      (installation.installedDeviceItems as unknown as CreateInstallationDto['installedDeviceItems']);
    if (
      dto.status === InstallationStatus.INSTALLED &&
      deviceItemsToComplete?.some((item) => item.isInstalled === false)
    ) {
      throw new BadRequestException(
        'All listed machines must be marked installed before completing the ticket',
      );
    }
    const installationEffectsAlreadyApplied =
      isAdminApprovingInstallation &&
      installation.status === InstallationStatus.INSTALLED &&
      installation.reviewStatus === WorkReviewStatus.PENDING &&
      installation.machine?.id === installation.machineId &&
      installation.machine?.inventoryStatus ===
        MachineInventoryStatus.INSTALLED;
    const primaryDeviceAccessories = dto.installedDeviceItems?.find(
      (item) => item.isPrimary,
    )?.accessories;
    const requestedMachineAccessories =
      dto.machineAccessories ?? primaryDeviceAccessories;

    if (
      !isAdmin(actor) &&
      !isManager(actor) &&
      dto.status &&
      dto.status !== installation.status &&
      !isAssignedEngineerCompleting
    ) {
      throw new ForbiddenException('Only admin can change installation status');
    }

    const updatedInstallation = await this.prisma.$transaction(async (tx) => {
      let completedMachineId: string | undefined;
      if (isAdminApprovingInstallation || isAssignedEngineerCompleting) {
        const actualMachine = await this.resolveActualInstallationMachine(
          tx,
          installation,
          dto,
          actor,
        );
        completedMachineId = actualMachine.id;
        if (installationEffectsAlreadyApplied) {
          if (
            actualMachine.inventoryStatus !== MachineInventoryStatus.INSTALLED
          ) {
            throw new BadRequestException(
              'Machine inventory changed before installation review',
            );
          }
        } else {
          const nextInstalledAt = installedAt ?? installation.installedAt;
          const approvedWarrantyStartDate =
            warrantyStartDate ??
            installation.warrantyStartDate ??
            installation.warrantyCard?.startDate ??
            nextInstalledAt;
          const approvedWarrantyEndDate =
            warrantyEndDate ??
            installation.warrantyEndDate ??
            installation.warrantyCard?.endDate ??
            null;

          if (
            actualMachine.inventoryStatus === MachineInventoryStatus.INSTALLED
          ) {
            throw new BadRequestException('Machine is already installed');
          }
          validateInventoryMovement(
            InventoryMovementType.INSTALL,
            actualMachine.inventoryStatus,
            MachineInventoryStatus.INSTALLED,
            installation.customerId,
          );

          const machineUpdate = await tx.machine.updateMany({
            where: {
              id: actualMachine.id,
              inventoryStatus: actualMachine.inventoryStatus,
            },
            data: {
              customerId: installation.customerId,
              businessLineId:
                dto.businessLineId === undefined
                  ? (installation.businessLineId ??
                    actualMachine.businessLineId)
                  : (businessLine?.id ?? null),
              installedById: installedBy?.id ?? installation.installedById,
              primaryEngineerId:
                installedBy?.id ?? installation.installedById ?? undefined,
              installDate: nextInstalledAt,
              warrantyStartDate: approvedWarrantyStartDate,
              warrantyEndDate: approvedWarrantyEndDate,
              inventoryStatus: MachineInventoryStatus.INSTALLED,
              status: MachineStatus.ACTIVE,
            },
          });

          if (machineUpdate.count !== 1) {
            throw new BadRequestException(
              'Machine has already been installed or changed status',
            );
          }

          await this.syncMachineEngineerAssignments(
            tx,
            actualMachine.id,
            installation.assignments?.map(
              (assignment) => assignment.engineerId,
            ) ??
              [installedBy?.id ?? installation.installedById].filter(
                (id): id is string => Boolean(id),
              ),
          );

          await tx.machineInventoryMovement.create({
            data: {
              code: await this.generateMovementCode(tx),
              type: InventoryMovementType.INSTALL,
              machineId: actualMachine.id,
              fromStatus: actualMachine.inventoryStatus,
              toStatus: MachineInventoryStatus.INSTALLED,
              occurredAt: nextInstalledAt,
              note: `Approved installation ${installation.code}`,
              customerId: installation.customerId,
              createdById: actor?.id || null,
            },
          });
        }
      }

      if (
        installation.status === InstallationStatus.PENDING &&
        dto.status === InstallationStatus.CANCELLED
      ) {
        await tx.warrantyCard.updateMany({
          where: { installationId: id },
          data: { status: WarrantyStatus.CANCELLED },
        });
      }

      const updated = await tx.machineInstallation.update({
        where: { id },
        data: {
          status: dto.status,
          machineId: completedMachineId ?? dto.machineId ?? undefined,
          installedAt: installedAt ?? undefined,
          installedById: installedBy?.id,
          reviewStatus: isAssignedEngineerCompleting
            ? WorkReviewStatus.PENDING
            : isAdminApprovingInstallation
              ? WorkReviewStatus.APPROVED
              : dto.status
                ? WorkReviewStatus.NOT_REQUIRED
                : undefined,
          reviewNote:
            isAssignedEngineerCompleting || isAdminApprovingInstallation
              ? null
              : undefined,
          reviewedAt: isAdminApprovingInstallation
            ? new Date()
            : isAssignedEngineerCompleting
              ? undefined
              : undefined,
          reviewerId: isAdminApprovingInstallation
            ? actor.id
            : isAssignedEngineerCompleting
              ? undefined
              : undefined,
          plannedMachineModelId: dto.machineModelId ?? undefined,
          businessLineId:
            dto.businessLineId === undefined
              ? undefined
              : (businessLine?.id ?? null),
          accessories:
            dto.accessories === undefined
              ? undefined
              : this.normalizeAccessories(dto.accessories),
          note: dto.note === undefined ? undefined : dto.note?.trim() || null,
          warrantyStartDate:
            dto.warrantyStartDate === undefined
              ? undefined
              : (warrantyStartDate ?? null),
          warrantyEndDate:
            dto.warrantyEndDate === undefined
              ? undefined
              : (warrantyEndDate ?? null),
          warrantyNote:
            dto.warrantyNote === undefined
              ? undefined
              : dto.warrantyNote?.trim() || null,
          handoverInstallerName:
            dto.handoverInstallerName === undefined
              ? undefined
              : this.cleanOptionalString(dto.handoverInstallerName),
          handoverInstallerPosition:
            dto.handoverInstallerPosition === undefined
              ? undefined
              : this.cleanOptionalString(dto.handoverInstallerPosition),
          handoverVehicle:
            dto.handoverVehicle === undefined
              ? undefined
              : this.cleanOptionalString(dto.handoverVehicle),
          handoverDepartureDate:
            dto.handoverDepartureDate === undefined
              ? undefined
              : (handoverDepartureDate ?? null),
          receiverInstallAddress:
            dto.receiverInstallAddress === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverInstallAddress),
          receiverRepresentative:
            dto.receiverRepresentative === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverRepresentative),
          receiverPosition:
            dto.receiverPosition === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverPosition),
          receiverPhone:
            dto.receiverPhone === undefined
              ? undefined
              : this.cleanOptionalString(dto.receiverPhone),
          installedDeviceItems:
            dto.installedDeviceItems === undefined
              ? undefined
              : this.normalizeDeviceItems(dto.installedDeviceItems),
          deviceCondition:
            dto.deviceCondition === undefined ? undefined : dto.deviceCondition,
          deviceConditionNote:
            dto.deviceConditionNote === undefined
              ? undefined
              : this.cleanOptionalString(dto.deviceConditionNote),
        },
        include: this.defaultInclude(),
      });

      if (
        warrantyStartDate ||
        warrantyEndDate ||
        dto.warrantyNote !== undefined
      ) {
        const warrantyUpdate = await tx.warrantyCard.updateMany({
          where: { installationId: id },
          data: {
            startDate: warrantyStartDate ?? undefined,
            endDate: warrantyEndDate ?? undefined,
            note:
              dto.warrantyNote === undefined
                ? undefined
                : dto.warrantyNote?.trim() || null,
          },
        });

        if (
          warrantyUpdate.count === 0 &&
          updated.machineId &&
          warrantyEndDate
        ) {
          await tx.warrantyCard.create({
            data: {
              code: await this.generateWarrantyCode(tx),
              installationId: id,
              machineId: updated.machineId,
              customerId: updated.customerId,
              issuedAt: new Date(),
              startDate: warrantyStartDate ?? updated.installedAt,
              endDate: warrantyEndDate,
              note: dto.warrantyNote?.trim() || null,
              issuedById: actor?.id || null,
              issuedByEmail: actor?.email || null,
            },
          });
        }
      }

      if (
        installedAt ||
        installedBy ||
        warrantyStartDate ||
        warrantyEndDate ||
        dto.businessLineId !== undefined
      ) {
        const machineId = updated.machineId;
        if (machineId) {
          await tx.machine.update({
            where: { id: machineId },
            data: {
              installedById: installedBy?.id,
              primaryEngineerId: installedBy?.id,
              installDate: installedAt ?? undefined,
              warrantyStartDate: warrantyStartDate ?? undefined,
              warrantyEndDate: warrantyEndDate ?? undefined,
              businessLineId:
                dto.businessLineId === undefined
                  ? undefined
                  : (businessLine?.id ?? installation.machine?.businessLineId),
            },
          });
        }
      }

      if (requestedMachineAccessories !== undefined) {
        const machineId = updated.machineId;
        // A not-yet-registered primary machine keeps its accessories in the
        // installation's primary device item. They are attached to the machine
        // in this same transaction when the engineer completes the ticket.
        if (machineId) {
          const machine = await tx.machine.findUnique({
            where: { id: machineId },
            select: { machineModelId: true },
          });
          const accessoriesToSync =
            !dto.machineId && !installation.machineId
              ? requestedMachineAccessories.map(({ id: _id, ...item }) => item)
              : requestedMachineAccessories;
          await this.machinesService.syncMachineAccessories(
            tx,
            machineId,
            machine?.machineModelId ?? null,
            accessoriesToSync,
          );
          await this.machinesService.refreshMachineAccessoriesSnapshot(
            tx,
            machineId,
          );
        }
      }

      if (
        (isAdminApprovingInstallation || isAssignedEngineerCompleting) &&
        !installationEffectsAlreadyApplied
      ) {
        const model = dto.machineModelId
          ? await tx.machineModel.findUnique({
              where: { id: dto.machineModelId },
              include: { businessLine: true },
            })
          : installation.plannedMachineModel;

        await this.ensureInstalledDeviceItemMachines(tx, {
          actor,
          customerId: updated.customerId,
          engineerId:
            updated.installedById ?? installation.installedById ?? actor.id,
          engineerIds:
            installation.assignments?.map(
              (assignment) => assignment.engineerId,
            ) ??
            [installation.installedById].filter((id): id is string =>
              Boolean(id),
            ),
          installedAt: updated.installedAt,
          warrantyStartDate:
            updated.warrantyStartDate ??
            updated.warrantyCard?.startDate ??
            updated.installedAt,
          warrantyEndDate:
            updated.warrantyEndDate ?? updated.warrantyCard?.endDate ?? null,
          businessLineId:
            updated.businessLineId ?? installation.businessLineId ?? null,
          machineModel: model,
          mainMachineId: updated.machineId ?? null,
          installationCode: updated.code,
          installedDeviceItems:
            dto.installedDeviceItems ??
            (installation.installedDeviceItems as unknown as CreateInstallationDto['installedDeviceItems']),
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.UPDATE,
          entityType: 'MachineInstallation',
          entityId: id,
          actor,
          changes: {
            status: { from: installation.status, to: updated.status },
            installedAt: {
              from: installation.installedAt,
              to: updated.installedAt,
            },
            installedById: {
              from: installation.installedById,
              to: updated.installedById,
            },
            businessLineId: {
              from: installation.businessLineId,
              to: updated.businessLineId,
            },
            accessories: {
              from: installation.accessories,
              to: updated.accessories,
            },
            note: { from: installation.note, to: updated.note },
          },
        },
        tx,
      );

      return updated;
    });

    if (isAssignedEngineerCompleting) {
      await this.notificationsService
        .createForAdmins({
          title: 'Phiếu lắp đặt chờ phê duyệt',
          message: `Phiếu ${updatedInstallation.code} đã hoàn tất, chờ phê duyệt hồ sơ lắp đặt.`,
          href: '/my-tasks',
          entityType: 'MachineInstallation',
          entityId: updatedInstallation.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updatedInstallation;
  }

  async remove(id: string, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.INSTALLATION_DELETE);
    const installation = await this.findOne(id, actor);
    if (installation.status !== InstallationStatus.PENDING) {
      throw new BadRequestException(
        'Only installation tickets waiting for processing can be deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.warrantyCard.deleteMany({
        where: { installationId: id },
      });

      await tx.machineInstallation.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.DELETE,
          entityType: 'MachineInstallation',
          entityId: id,
          actor,
          metadata: {
            code: installation.code,
            machineId: installation.machineId,
            customerId: installation.customerId,
            installedById: installation.installedById,
            status: installation.status,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  async updateStatus(
    id: string,
    dto: UpdateInstallationStatusDto,
    actor: RequestUser,
  ) {
    if (!dto.status) {
      throw new BadRequestException('status is required');
    }

    assertPermission(actor, PERMISSIONS.INSTALLATION_STATUS_UPDATE);
    const installation = await this.findOne(id, actor);
    ensureInstallationStatusTransitionIsAllowed(
      installation.status,
      dto.status,
    );
    const installedAt = this.parseOptionalDate(dto.installedAt, 'installedAt');
    const isPendingDecision =
      installation.status === InstallationStatus.PENDING &&
      (dto.status === InstallationStatus.INSTALLED ||
        dto.status === InstallationStatus.CANCELLED);
    const isInstallationApprover = isAdmin(actor) || isManager(actor);
    const isInstallationReviewApproval =
      isInstallationApprover &&
      (installation.status === InstallationStatus.PENDING ||
        installation.reviewStatus === WorkReviewStatus.PENDING) &&
      dto.status === InstallationStatus.INSTALLED;
    const installationEffectsAlreadyApplied =
      isInstallationReviewApproval &&
      installation.status === InstallationStatus.INSTALLED &&
      installation.reviewStatus === WorkReviewStatus.PENDING &&
      installation.machine?.id === installation.machineId &&
      installation.machine?.inventoryStatus ===
        MachineInventoryStatus.INSTALLED;
    const isAssignedEngineerDecision =
      isEngineer(actor) &&
      (installation.installedById === actor.id ||
        installation.assignments?.some(
          (assignment) => assignment.engineerId === actor.id,
        ));

    if (
      isPendingDecision &&
      !isInstallationApprover &&
      !isAssignedEngineerDecision
    ) {
      throw new ForbiddenException(
        'Only admin can approve installation requests',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        if (
          isInstallationReviewApproval &&
          !installationEffectsAlreadyApplied
        ) {
          if (!installation.machine) {
            throw new BadRequestException(
              'Machine serial number must be updated before approving installation',
            );
          }
          const nextInstalledAt = installedAt ?? installation.installedAt;
          const warrantyStartDate =
            installation.warrantyStartDate ??
            installation.warrantyCard?.startDate ??
            nextInstalledAt;
          const warrantyEndDate =
            installation.warrantyEndDate ??
            installation.warrantyCard?.endDate ??
            null;

          validateInventoryMovement(
            InventoryMovementType.INSTALL,
            installation.machine.inventoryStatus,
            MachineInventoryStatus.INSTALLED,
            installation.customerId,
          );

          const machineUpdate = await tx.machine.updateMany({
            where: {
              id: installation.machineId,
              inventoryStatus: installation.machine.inventoryStatus,
            },
            data: {
              customerId: installation.customerId,
              businessLineId:
                installation.businessLineId ??
                installation.machine.businessLineId,
              installedById: installation.installedById,
              primaryEngineerId: installation.installedById ?? undefined,
              installDate: nextInstalledAt,
              warrantyStartDate,
              warrantyEndDate,
              inventoryStatus: MachineInventoryStatus.INSTALLED,
              status: MachineStatus.ACTIVE,
            },
          });

          if (machineUpdate.count !== 1) {
            throw new BadRequestException(
              'Machine has already been installed or changed status',
            );
          }

          await this.syncMachineEngineerAssignments(
            tx,
            installation.machineId,
            installation.assignments?.map(
              (assignment) => assignment.engineerId,
            ) ??
              [installation.installedById].filter((id): id is string =>
                Boolean(id),
              ),
          );

          await tx.machineInventoryMovement.create({
            data: {
              code: await this.generateMovementCode(tx),
              type: InventoryMovementType.INSTALL,
              machineId: installation.machineId,
              fromStatus: installation.machine.inventoryStatus,
              toStatus: MachineInventoryStatus.INSTALLED,
              occurredAt: nextInstalledAt,
              note: `Approved installation ${installation.code}`,
              customerId: installation.customerId,
              createdById: actor?.id || null,
            },
          });

          if (warrantyEndDate) {
            const warrantyUpdate = await tx.warrantyCard.updateMany({
              where: { installationId: id },
              data: {
                machineId: installation.machine.id,
                customerId: installation.customerId,
                startDate: warrantyStartDate,
                endDate: warrantyEndDate,
                note: installation.warrantyNote,
              },
            });

            if (warrantyUpdate.count === 0) {
              await tx.warrantyCard.create({
                data: {
                  code: await this.generateWarrantyCode(tx),
                  installationId: id,
                  machineId: installation.machine.id,
                  customerId: installation.customerId,
                  issuedAt: new Date(),
                  startDate: warrantyStartDate,
                  endDate: warrantyEndDate,
                  note: installation.warrantyNote,
                  issuedById: actor?.id || null,
                  issuedByEmail: actor?.email || null,
                },
              });
            }
          }

          await this.ensureInstalledDeviceItemMachines(tx, {
            actor,
            customerId: installation.customerId,
            engineerId: installation.installedById ?? actor.id,
            engineerIds:
              installation.assignments?.map(
                (assignment) => assignment.engineerId,
              ) ??
              [installation.installedById].filter((id): id is string =>
                Boolean(id),
              ),
            installedAt: nextInstalledAt,
            warrantyStartDate,
            warrantyEndDate,
            businessLineId: installation.businessLineId ?? null,
            machineModel: installation.plannedMachineModel,
            mainMachineId: installation.machineId ?? null,
            installationCode: installation.code,
            installedDeviceItems:
              installation.installedDeviceItems as unknown as CreateInstallationDto['installedDeviceItems'],
          });
        }

        if (
          installation.status === InstallationStatus.PENDING &&
          dto.status === InstallationStatus.CANCELLED
        ) {
          await tx.warrantyCard.updateMany({
            where: { installationId: id },
            data: { status: WarrantyStatus.CANCELLED },
          });
        }

        const updated = await tx.machineInstallation.update({
          where: { id },
          data: {
            status: dto.status,
            installedAt: installedAt ?? undefined,
            note: dto.note?.trim(),
            reviewStatus:
              dto.status === InstallationStatus.INSTALLED
                ? isInstallationApprover
                  ? WorkReviewStatus.APPROVED
                  : WorkReviewStatus.PENDING
                : dto.status
                  ? WorkReviewStatus.NOT_REQUIRED
                  : undefined,
            reviewedAt:
              dto.status === InstallationStatus.INSTALLED &&
              isInstallationApprover
                ? new Date()
                : undefined,
            reviewerId:
              dto.status === InstallationStatus.INSTALLED &&
              isInstallationApprover
                ? actor.id
                : undefined,
            reviewNote:
              dto.status === InstallationStatus.INSTALLED ? null : undefined,
          },
          include: this.defaultInclude(),
        });

        if (
          installedAt &&
          (dto.status === InstallationStatus.INSTALLED ||
            installation.status === InstallationStatus.INSTALLED) &&
          installation.machineId
        ) {
          await tx.machine.update({
            where: { id: installation.machineId },
            data: {
              installDate: installedAt,
            },
          });
        }

        await this.auditLogsService.create(
          {
            action: AUDIT_ACTIONS.STATUS_CHANGE,
            entityType: 'MachineInstallation',
            entityId: id,
            actor,
            changes: {
              status: {
                from: installation.status,
                to: updated.status,
              },
              installedAt: {
                from: installation.installedAt,
                to: updated.installedAt,
              },
              note: {
                from: installation.note,
                to: updated.note,
              },
            },
          },
          tx,
        );

        return updated;
      },
      { timeout: 20_000 },
    );
  }

  async review(id: string, dto: ReviewWorkTaskDto, actor: RequestUser) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('Only admins can review installation tasks');
    }

    if (
      dto.status !== WorkReviewStatus.APPROVED &&
      dto.status !== WorkReviewStatus.NEEDS_REVISION
    ) {
      throw new BadRequestException(
        'Review status must be APPROVED or NEEDS_REVISION',
      );
    }

    const installation = await this.findOne(id, actor);
    if (installation.reviewStatus !== WorkReviewStatus.PENDING) {
      throw new BadRequestException(
        'Only pending review installations can be reviewed',
      );
    }

    const reviewNote = this.cleanOptionalString(dto.reviewNote);
    if (dto.status === WorkReviewStatus.NEEDS_REVISION && !reviewNote) {
      throw new BadRequestException(
        'reviewNote is required when returning an installation',
      );
    }

    const updated =
      dto.status === WorkReviewStatus.APPROVED
        ? await this.update(
            id,
            {
              status: InstallationStatus.INSTALLED,
              warrantyEndDate: installation.warrantyEndDate
                ? installation.warrantyEndDate.toISOString()
                : installation.warrantyCard?.endDate
                  ? installation.warrantyCard.endDate.toISOString()
                  : undefined,
              warrantyStartDate: installation.warrantyStartDate
                ? installation.warrantyStartDate.toISOString()
                : installation.warrantyCard?.startDate
                  ? installation.warrantyCard.startDate.toISOString()
                  : undefined,
              warrantyNote: installation.warrantyNote ?? undefined,
              reviewNote,
            } as UpdateInstallationDto,
            actor,
          )
        : await this.prisma.$transaction(async (tx) => {
            const reviewed = await tx.machineInstallation.update({
              where: { id },
              data: {
                reviewStatus: dto.status,
                reviewNote,
                reviewedAt: new Date(),
                reviewerId: actor.id,
              },
              include: this.defaultInclude(),
            });

            await this.auditLogsService.create(
              {
                action: AUDIT_ACTIONS.STATUS_CHANGE,
                entityType: 'MachineInstallation',
                entityId: id,
                actor,
                changes: {
                  reviewStatus: {
                    from: installation.reviewStatus,
                    to: reviewed.reviewStatus,
                  },
                  reviewNote: {
                    from: installation.reviewNote,
                    to: reviewed.reviewNote,
                  },
                },
              },
              tx,
            );

            return reviewed;
          });

    if (updated.installedById) {
      await this.notificationsService
        .create({
          userId: updated.installedById,
          title:
            dto.status === WorkReviewStatus.APPROVED
              ? 'Phiếu lắp đặt đã được phê duyệt'
              : 'Phiếu lắp đặt cần bổ sung',
          message:
            dto.status === WorkReviewStatus.APPROVED
              ? `Quản trị viên đã phê duyệt phiếu ${updated.code}.`
              : `Quản trị viên yêu cầu bổ sung hồ sơ phiếu ${updated.code}: ${reviewNote}`,
          href: '/my-tasks',
          entityType: 'MachineInstallation',
          entityId: updated.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updated;
  }

  getStatuses() {
    return Object.values(InstallationStatus);
  }

  previewCode(date?: string) {
    return this.generateInstallationCode(
      this.prisma,
      this.parseOptionalDate(date, 'date') ?? new Date(),
    );
  }

  previewMachineCode(source?: string) {
    return this.generateMachineCode(this.prisma, source || 'MAY');
  }

  private buildHandoverDeviceRows(installation: any): Array<{
    itemName: string;
    model: string;
    serialNumber: string;
    manufactureDate: string | null;
    quantity: number;
    warrantyPeriod: string;
  }> {
    const items = Array.isArray(installation.installedDeviceItems)
      ? installation.installedDeviceItems
      : [];
    const normalized = items
      .map((item) => ({
        itemName: docValue(item?.itemName),
        model: docValue(item?.model),
        serialNumber: docValue(item?.serialNumber),
        manufactureDate: item?.manufactureDate || null,
        quantity: Number(item?.quantity) || 1,
        warrantyPeriod: docValue(item?.warrantyPeriod),
      }))
      .filter((item) => item.itemName !== '................................');

    const mainMachineRow = {
      itemName: docValue(
        installation.machine?.name ||
          installation.plannedMachineModel?.displayName ||
          installation.plannedMachineModel?.name ||
          installation.plannedModelName ||
          'Thiết bị',
      ),
      model: docValue(
        installation.machine?.modelName ||
          installation.plannedMachineModel?.name ||
          installation.plannedModelName,
      ),
      serialNumber: docValue(installation.machine?.serialNumber),
      manufactureDate: null,
      quantity: 1,
      warrantyPeriod: formatWarrantyPeriod(
        installation.warrantyStartDate || installation.warrantyCard?.startDate,
        installation.warrantyEndDate || installation.warrantyCard?.endDate,
      ),
    };

    return [
      mainMachineRow,
      ...normalized.filter(
        (item) => !isSameHandoverDevice(item, mainMachineRow),
      ),
    ];
  }

  private validateCreate(dto: CreateInstallationDto) {
    const engineerIds = dto.engineerIds?.length
      ? dto.engineerIds
      : dto.installedById
        ? [dto.installedById]
        : [];
    if (!dto.customerId || !engineerIds.length) {
      throw new BadRequestException(
        'customerId and at least one assigned engineer are required',
      );
    }

    if (dto.deviceCondition === 'OTHER' && !dto.deviceConditionNote?.trim()) {
      throw new BadRequestException(
        'deviceConditionNote is required when deviceCondition is OTHER',
      );
    }
  }

  private withPrimaryMachineDraft(
    dto: CreateInstallationDto,
    machineModel: Awaited<ReturnType<InstallationsService['findMachineModel']>> | null,
  ): CreateInstallationDto['installedDeviceItems'] {
    const items = [...(dto.installedDeviceItems ?? [])];
    if (dto.machineId) return items;

    const serialNumber = dto.machineSerialNumber?.trim();
    const itemName =
      dto.machineName?.trim() ||
      machineModel?.displayName ||
      machineModel?.name ||
      dto.plannedModelName?.trim();
    const existingPrimaryIndex = items.findIndex((item) => item.isPrimary);
    if (!serialNumber && !itemName) {
      if (existingPrimaryIndex >= 0 || !items.length) return items;
      items[0] = { ...items[0], isPrimary: true };
      return items;
    }

    const primaryItem = {
      itemName: itemName || 'Máy chính',
      model: machineModel?.name || dto.plannedModelName?.trim() || undefined,
      serialNumber: serialNumber || undefined,
      quantity: 1,
      isPrimary: true,
    };
    if (existingPrimaryIndex >= 0) {
      items[existingPrimaryIndex] = {
        ...items[existingPrimaryIndex],
        ...primaryItem,
        serialNumber: serialNumber || items[existingPrimaryIndex].serialNumber,
      };
    } else {
      items.unshift(primaryItem);
    }
    return items;
  }

  private async createManualInstallationMachine(
    tx: Prisma.TransactionClient,
    input: {
      dto: CreateInstallationDto;
      actor: RequestUser;
      customerId: string;
      engineerId: string;
      machineModel: Awaited<
        ReturnType<InstallationsService['findMachineModel']>
      > | null;
      businessLineId: string | null;
      installedAt: Date;
    },
  ) {
    const primaryDeviceItem = (
      this.normalizeDeviceItems(
        input.dto.installedDeviceItems,
      ) as unknown as Array<{
        itemName?: string | null;
        model?: string | null;
        serialNumber?: string | null;
        engineerIds?: string[];
      }>
    ).find((item) => item.serialNumber?.trim());
    const serialNumber = (
      input.dto.machineSerialNumber?.trim() ||
      primaryDeviceItem?.serialNumber?.trim()
    )?.toUpperCase();
    if (!serialNumber) {
      return null;
    }

    const existing = await tx.machine.findUnique({
      where: { serialNumber },
    });

    if (existing) {
      if (existing.inventoryStatus === MachineInventoryStatus.INSTALLED) {
        throw new BadRequestException('Machine is already installed');
      }
      return existing;
    }

    const fallbackModelName =
      primaryDeviceItem?.model?.trim() ||
      primaryDeviceItem?.itemName?.trim() ||
      input.dto.plannedModelName?.trim() ||
      input.dto.machineName?.trim() ||
      input.machineModel?.name ||
      'Máy lắp đặt';

    const machine = await tx.machine.create({
      data: {
        machineCode:
          input.dto.machineCode?.trim() ||
          (await this.generateMachineCode(
            tx,
            input.machineModel?.code ||
              input.machineModel?.name ||
              fallbackModelName,
          )),
        serialNumber,
        name:
          input.dto.machineName?.trim() ||
          primaryDeviceItem?.itemName?.trim() ||
          input.machineModel?.displayName ||
          input.machineModel?.name ||
          fallbackModelName,
        modelName: input.machineModel?.name || fallbackModelName,
        manufacturer: input.machineModel?.manufacturer || '',
        productCategory: input.machineModel?.productCategory || 'OTHER',
        productLine: input.machineModel?.productLine || null,
        machineModelId: input.machineModel?.id || null,
        businessLineId: input.businessLineId,
        customerId: input.customerId,
        installedById: input.engineerId,
        primaryEngineerId: input.engineerId,
        warehouseImportDate: input.installedAt,
        inventoryStatus: MachineInventoryStatus.RESERVED,
        status: MachineStatus.ACTIVE,
        createdSource: isEngineer(input.actor) ? 'ENGINEER' : 'ADMIN',
        dataStatus: isEngineer(input.actor) ? 'PENDING_REVIEW' : 'VERIFIED',
      },
    });
    await this.machinesService.ensureMachineAccessoryTemplates(
      tx,
      machine.id,
      machine.machineModelId,
    );
    return machine;
  }

  private async findMachine(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        businessLine: {
          include: {
            productIndustry: true,
          },
        },
        machineModel: {
          include: {
            businessLine: {
              include: {
                productIndustry: true,
              },
            },
          },
        },
      },
    });

    if (!machine) {
      throw new BadRequestException('Machine does not exist');
    }

    return machine;
  }

  private async findMachineModel(machineModelId: string) {
    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id: machineModelId },
      include: {
        businessLine: {
          include: {
            productIndustry: true,
          },
        },
      },
    });

    if (!machineModel) {
      throw new BadRequestException('Machine model does not exist');
    }

    return machineModel;
  }

  private async assertEngineerCanUseMachine(
    actor: RequestUser,
    machine: Awaited<ReturnType<InstallationsService['findMachine']>>,
  ) {
    if (!isEngineer(actor)) {
      return;
    }

    const engineer = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: { engineerProfile: true },
    });
    const expertiseGroup = engineer?.engineerProfile?.expertiseGroup;

    if (!expertiseGroup) {
      return;
    }

    const machineGroup =
      machine.businessLine?.productIndustry?.expertiseGroup ??
      machine.businessLine?.expertiseGroup ??
      machine.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machine.machineModel?.businessLine?.expertiseGroup;

    if (machineGroup && machineGroup !== expertiseGroup) {
      throw new ForbiddenException(
        'Engineer can only create tickets for assigned product group',
      );
    }
  }

  private async resolveActualInstallationMachine(
    tx: Prisma.TransactionClient,
    installation: any,
    dto: UpdateInstallationDto,
    actor: RequestUser,
  ) {
    const primarySourceMachineId = dto.installedDeviceItems?.find(
      (item) => item.isPrimary,
    )?.sourceMachineId;
    const existingMachineId =
      dto.machineId || installation.machineId || primarySourceMachineId;
    if (existingMachineId) {
      const machine = await tx.machine.findUnique({
        where: { id: existingMachineId },
      });
      if (!machine) {
        throw new BadRequestException('Machine does not exist');
      }
      const activeDemoLoan = await tx.demoLoan.findFirst({
        where: {
          machineId: machine.id,
          status: {
            in: [
              DemoLoanStatus.PLANNED,
              DemoLoanStatus.HANDED_OVER,
              DemoLoanStatus.OVERDUE,
            ],
          },
        },
        select: { id: true },
      });
      if (activeDemoLoan) {
        throw new BadRequestException(
          'Machine is currently assigned to a demo loan and cannot be installed',
        );
      }
      return machine;
    }

    const serialNumber =
      dto.machineSerialNumber?.trim() ||
      dto.installedDeviceItems
        ?.find((item) => item.serialNumber?.trim())
        ?.serialNumber?.trim();

    if (!serialNumber) {
      throw new BadRequestException(
        'Machine serial number is required to complete installation',
      );
    }

    const machineModelId =
      dto.machineModelId || installation.plannedMachineModelId;
    const machineModel = machineModelId
      ? await tx.machineModel.findUnique({
          where: { id: machineModelId },
          include: { businessLine: true },
        })
      : null;
    const primaryItem = dto.installedDeviceItems?.find(
      (item) => item.isPrimary,
    );
    const fallbackModelName =
      dto.modelName?.trim() ||
      dto.installedDeviceItems
        ?.find((item) => item.model?.trim())
        ?.model?.trim() ||
      installation.plannedModelName ||
      primaryItem?.itemName?.trim() ||
      dto.machineName?.trim() ||
      'Máy lắp đặt';
    const manufacturer =
      dto.manufacturer?.trim() ||
      machineModel?.manufacturer?.trim() ||
      primaryItem?.manufacturer?.trim();
    const machineName =
      dto.machineName?.trim() ||
      primaryItem?.itemName?.trim() ||
      machineModel?.displayName ||
      machineModel?.name;

    if (!machineName || !fallbackModelName || !manufacturer) {
      throw new BadRequestException(
        'Machine name, model, and manufacturer are required when registering a new machine',
      );
    }

    const machine = await tx.machine.create({
      data: {
        machineCode:
          dto.machineCode?.trim() ||
          (await this.generateMachineCode(
            tx,
            machineModel?.code || machineModel?.name || fallbackModelName,
          )),
        serialNumber: serialNumber.toUpperCase(),
        name: machineName,
        modelName:
          dto.modelName?.trim() || machineModel?.name || fallbackModelName,
        manufacturer,
        productCategory:
          dto.productCategory || machineModel?.productCategory || 'OTHER',
        productLine: machineModel?.productLine || null,
        machineModelId: machineModel?.id || null,
        businessLineId:
          installation.businessLineId || machineModel?.businessLineId || null,
        customerId: installation.customerId,
        installedById: installation.installedById,
        primaryEngineerId: installation.installedById,
        inventoryStatus: MachineInventoryStatus.RESERVED,
        status: MachineStatus.ACTIVE,
        createdSource: isEngineer(actor) ? 'ENGINEER' : 'ADMIN',
        dataStatus: isEngineer(actor) ? 'PENDING_REVIEW' : 'VERIFIED',
      },
    });

    await this.machinesService.ensureMachineAccessoryTemplates(
      tx,
      machine.id,
      machine.machineModelId,
    );

    return machine;
  }

  private async ensureInstalledDeviceItemMachines(
    tx: Prisma.TransactionClient,
    input: {
      actor: RequestUser;
      customerId: string;
      engineerId: string;
      engineerIds: string[];
      installedAt: Date;
      warrantyStartDate: Date;
      warrantyEndDate: Date | null;
      businessLineId: string | null;
      machineModel: any;
      mainMachineId: string | null;
      installationCode: string;
      installedDeviceItems?: CreateInstallationDto['installedDeviceItems'];
    },
  ) {
    const normalizedItems = this.normalizeDeviceItems(
      input.installedDeviceItems,
    ) as unknown as Array<{
      sourceMachineId?: string | null;
      itemName?: string | null;
      model?: string | null;
      serialNumber?: string | null;
      quantity?: number;
      engineerIds?: string[];
      accessories?: import('../machines/dto/update-machine.dto').UpdateMachineAccessoryItemDto[];
    }>;
    const items = normalizedItems
      .flatMap((item) => {
        const serialNumbers = (item.serialNumber || '')
          .split(/[\n,;]+/)
          .map((serialNumber) => serialNumber.trim())
          .filter(Boolean);
        const hasDevice = Boolean(item.itemName?.trim() || item.model?.trim());
        const expectedQuantity = Math.max(1, Number(item.quantity) || 1);
        if (hasDevice && serialNumbers.length !== expectedQuantity) {
          throw new BadRequestException(
            `Vui lòng nhập đủ ${expectedQuantity} S/N cho thiết bị ${item.itemName || item.model || ''}`.trim(),
          );
        }
        return serialNumbers.map((serialNumber) => ({
          ...item,
          serialNumber,
          sourceMachineId:
            serialNumbers.length === 1 ? item.sourceMachineId : null,
        }));
      })
      .filter((item) => item.serialNumber?.trim());
    if (!items.length) return;

    const mainMachine = input.mainMachineId
      ? await tx.machine.findUnique({ where: { id: input.mainMachineId } })
      : null;
    const mainSerial = mainMachine?.serialNumber?.trim().toUpperCase();
    const seenSerials = new Set<string>();

    for (const item of items) {
      const serialNumber = item.serialNumber?.trim().toUpperCase();
      if (!serialNumber || seenSerials.has(serialNumber)) continue;
      seenSerials.add(serialNumber);
      if (mainSerial && serialNumber === mainSerial) continue;

      const itemMachineModel =
        (await this.findMachineModelForDeviceItem(tx, item)) ??
        input.machineModel;
      const modelName =
        item.model?.trim() ||
        itemMachineModel?.name ||
        itemMachineModel?.displayName ||
        item.itemName?.trim() ||
        'Máy lắp đặt';
      const machineName =
        item.itemName?.trim() ||
        itemMachineModel?.displayName ||
        itemMachineModel?.name ||
        modelName;
      const businessLineId =
        input.businessLineId ?? itemMachineModel?.businessLineId ?? null;

      const existing = item.sourceMachineId
        ? await tx.machine.findUnique({ where: { id: item.sourceMachineId } })
        : await tx.machine.findUnique({ where: { serialNumber } });
      if (
        existing &&
        existing.serialNumber.trim().toUpperCase() !== serialNumber
      ) {
        throw new BadRequestException(
          `Serial number on linked machine ${existing.machineCode || existing.id} does not match the handover item`,
        );
      }

      if (existing) {
        if (existing.demoCategory === DemoMachineCategory.DEMO_UNIT) {
          throw new BadRequestException(
            `Dedicated demo machine ${serialNumber} cannot be installed`,
          );
        }
        if (existing.inventoryStatus !== MachineInventoryStatus.INSTALLED) {
          validateInventoryMovement(
            InventoryMovementType.INSTALL,
            existing.inventoryStatus,
            MachineInventoryStatus.INSTALLED,
            input.customerId,
          );

          const updated = await tx.machine.updateMany({
            where: {
              id: existing.id,
              inventoryStatus: existing.inventoryStatus,
            },
            data: {
              customerId: input.customerId,
              businessLineId,
              installedById: input.engineerId,
              primaryEngineerId: input.engineerId,
              installDate: input.installedAt,
              warrantyStartDate: input.warrantyStartDate,
              warrantyEndDate: input.warrantyEndDate,
              inventoryStatus: MachineInventoryStatus.INSTALLED,
              status: MachineStatus.ACTIVE,
            },
          });

          if (updated.count !== 1) {
            throw new BadRequestException(
              `Machine ${serialNumber} has already been installed or changed status`,
            );
          }

          await tx.machineInventoryMovement.create({
            data: {
              code: await this.generateMovementCode(tx),
              type: InventoryMovementType.INSTALL,
              machineId: existing.id,
              fromStatus: existing.inventoryStatus,
              toStatus: MachineInventoryStatus.INSTALLED,
              occurredAt: input.installedAt,
              note: `Installed from multi-device ticket ${input.installationCode}`,
              customerId: input.customerId,
              createdById: input.actor?.id || null,
            },
          });
        } else {
          throw new BadRequestException(
            `Machine ${serialNumber} is already installed`,
          );
        }
        await this.syncMachineEngineerAssignments(
          tx,
          existing.id,
          item.engineerIds?.length ? item.engineerIds : input.engineerIds,
        );
        if (item.accessories) {
          await this.machinesService.syncMachineAccessories(
            tx,
            existing.id,
            existing.machineModelId,
            item.accessories,
          );
          await this.machinesService.refreshMachineAccessoriesSnapshot(
            tx,
            existing.id,
          );
        }
        continue;
      }

      const createdMachine = await tx.machine.create({
        data: {
          machineCode: await this.generateMachineCode(
            tx,
            itemMachineModel?.code || itemMachineModel?.name || modelName,
          ),
          serialNumber,
          name: machineName,
          modelName,
          manufacturer: itemMachineModel?.manufacturer || '',
          productCategory: itemMachineModel?.productCategory || 'OTHER',
          productLine: itemMachineModel?.productLine || null,
          machineModelId: itemMachineModel?.id || null,
          businessLineId,
          customerId: input.customerId,
          installedById: input.engineerId,
          primaryEngineerId: input.engineerId,
          warehouseImportDate: input.installedAt,
          installDate: input.installedAt,
          warrantyStartDate: input.warrantyStartDate,
          warrantyEndDate: input.warrantyEndDate,
          inventoryStatus: MachineInventoryStatus.INSTALLED,
          status: MachineStatus.ACTIVE,
          createdSource: isEngineer(input.actor) ? 'ENGINEER' : 'ADMIN',
          dataStatus: isEngineer(input.actor) ? 'PENDING_REVIEW' : 'VERIFIED',
        },
      });

      await this.machinesService.ensureMachineAccessoryTemplates(
        tx,
        createdMachine.id,
        createdMachine.machineModelId,
      );

      await this.syncMachineEngineerAssignments(
        tx,
        createdMachine.id,
        item.engineerIds?.length ? item.engineerIds : input.engineerIds,
      );
      if (item.accessories) {
        await this.machinesService.syncMachineAccessories(
          tx,
          createdMachine.id,
          createdMachine.machineModelId,
          item.accessories,
        );
        await this.machinesService.refreshMachineAccessoriesSnapshot(
          tx,
          createdMachine.id,
        );
      }

      await tx.machineInventoryMovement.create({
        data: {
          code: await this.generateMovementCode(tx),
          type: InventoryMovementType.INSTALL,
          machineId: createdMachine.id,
          fromStatus: null,
          toStatus: MachineInventoryStatus.INSTALLED,
          occurredAt: input.installedAt,
          note: `Created from multi-device ticket ${input.installationCode}`,
          customerId: input.customerId,
          createdById: input.actor?.id || null,
        },
      });
    }
  }

  private async syncMachineEngineerAssignments(
    tx: Prisma.TransactionClient,
    machineId: string,
    engineerIds: string[],
  ) {
    const uniqueIds = [...new Set(engineerIds.filter(Boolean))];
    if (!uniqueIds.length) return;
    await tx.machineEngineerAssignment.createMany({
      data: uniqueIds.map((engineerId, index) => ({
        machineId,
        engineerId,
        isPrimary: index === 0,
      })),
      skipDuplicates: true,
    });
  }

  private async findMachineModelForDeviceItem(
    tx: Prisma.TransactionClient,
    item: { itemName?: string | null; model?: string | null },
  ) {
    const candidates = [item.model, item.itemName]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    if (!candidates.length) return null;

    return tx.machineModel.findFirst({
      where: {
        OR: candidates.flatMap((value) => [
          { code: value },
          { name: value },
          { displayName: value },
        ]),
      },
      include: { businessLine: true },
    });
  }

  private async findCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }

    return customer;
  }

  private async findEngineer(engineerId: string) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: {
        role: true,
        engineerProfile: true,
      },
    });

    if (!engineer || engineer.status !== 'ACTIVE') {
      throw new BadRequestException('Engineer does not exist or is inactive');
    }

    if (engineer.role.name !== 'engineer' && engineer.role.name !== 'admin') {
      throw new BadRequestException('Installed by user must be an engineer');
    }

    return engineer;
  }

  private async findBusinessLine(businessLineId?: string | null) {
    if (!businessLineId) {
      return null;
    }

    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id: businessLineId },
      include: { productIndustry: true },
    });

    if (!businessLine) {
      throw new BadRequestException('Business line does not exist');
    }

    return businessLine;
  }

  private normalizeAccessories(accessories?: string[]): string[] {
    if (!accessories?.length) {
      return [];
    }

    return accessories
      .map((accessory) => accessory.trim())
      .filter((accessory) => accessory.length > 0);
  }

  private normalizeDeviceItems(
    items?: CreateInstallationDto['installedDeviceItems'],
  ): Prisma.InputJsonValue {
    if (!items?.length) {
      return [];
    }

    return items
      .map((item) => ({
        itemName: item.itemName?.trim(),
        model: item.model?.trim() || null,
        serialNumber: item.serialNumber?.trim() || null,
        sourceMachineId: item.sourceMachineId?.trim() || null,
        manufactureDate: item.manufactureDate || null,
        quantity: Number(item.quantity) || 1,
        warrantyPeriod: item.warrantyPeriod?.trim() || null,
        manufacturer: item.manufacturer?.trim() || null,
        productCategory: item.productCategory || null,
        isPrimary: item.isPrimary === true,
        isInstalled: item.isInstalled ?? null,
        engineerIds: [...new Set(item.engineerIds ?? [])],
        ...(item.accessories !== undefined
          ? {
              accessories: item.accessories.map((accessory) => ({
                id: accessory.id ?? null,
                componentAccessoryId: accessory.componentAccessoryId ?? null,
                code: accessory.code ?? null,
                name: accessory.name ?? null,
                quantity: accessory.quantity ?? null,
                serialNumber: accessory.serialNumber ?? null,
                description: accessory.description ?? null,
                note: accessory.note ?? null,
              })),
            }
          : {}),
      }))
      .filter((item) => item.itemName);
  }

  private cleanOptionalString(value?: string | null) {
    return value?.trim() || null;
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return date;
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    return this.parseRequiredDate(value, fieldName);
  }

  private buildFindAllWhere(
    query: ListInstallationsQueryDto,
  ): Prisma.MachineInstallationWhereInput {
    const search = query.search?.trim();
    const baseWhere: Prisma.MachineInstallationWhereInput = {
      status: query.status,
      customerId: query.customerId,
      machineId: query.machineId,
      businessLineId: query.businessLineId,
      installedById: undefined,
      AND: query.installedById
        ? [
            {
              OR: [
                { installedById: query.installedById },
                { assignments: { some: { engineerId: query.installedById } } },
              ],
            },
          ]
        : undefined,
      installedAt:
        query.installedFrom || query.installedTo
          ? {
              gte: query.installedFrom
                ? this.parseRequiredDate(query.installedFrom, 'installedFrom')
                : undefined,
              lte: query.installedTo
                ? this.parseRequiredDate(query.installedTo, 'installedTo')
                : undefined,
            }
          : undefined,
      OR: search
        ? [
            { code: { contains: search } },
            { note: { contains: search } },
            {
              machine: {
                serialNumber: { contains: search },
              },
            },
            {
              machine: {
                modelName: { contains: search },
              },
            },
            {
              customer: {
                name: { contains: search },
              },
            },
            {
              businessLine: {
                name: { contains: search },
              },
            },
            {
              businessLine: {
                manufacturer: { contains: search },
              },
            },
          ]
        : undefined,
    };

    if (!query.productIndustryId) {
      return baseWhere;
    }

    return {
      AND: [
        baseWhere,
        {
          OR: [
            {
              businessLine: {
                productIndustryId: query.productIndustryId,
              },
            },
            {
              machine: {
                businessLine: {
                  productIndustryId: query.productIndustryId,
                },
              },
            },
            {
              plannedMachineModel: {
                businessLine: {
                  productIndustryId: query.productIndustryId,
                },
              },
            },
          ],
        },
      ],
    };
  }

  private withAccessScope(
    where: Prisma.MachineInstallationWhereInput,
    user?: RequestUser,
  ): Prisma.MachineInstallationWhereInput {
    return {
      AND: [where, installationAccessWhere(user)],
    };
  }

  private async generateInstallationCode(
    tx: Prisma.TransactionClient,
    date: Date,
  ): Promise<string> {
    const prefix = `LD-${shortDateCode(date)}`;
    return sequenceCode(tx, 'installation', prefix, 3, tx === this.prisma);
  }

  private normalizeCodeSegment(value: string) {
    const normalized = value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return normalized || null;
  }

  private async generateMachineCode(
    tx: Prisma.TransactionClient,
    source: string,
  ) {
    const prefix = normalizeCodeSegment(source, 'MAY');
    return sequenceCode(tx, 'machine', prefix, 3, tx === this.prisma);
  }

  private getExpertiseGroupCode(
    machine?: Awaited<ReturnType<InstallationsService['findMachine']>> | null,
    machineModel?: Awaited<
      ReturnType<InstallationsService['findMachineModel']>
    > | null,
    businessLine?: Awaited<
      ReturnType<InstallationsService['findBusinessLine']>
    > | null,
  ) {
    const group =
      businessLine?.productIndustry?.expertiseGroup ??
      businessLine?.expertiseGroup ??
      machine?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.businessLine?.expertiseGroup ??
      machine?.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.machineModel?.businessLine?.expertiseGroup ??
      machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machineModel?.businessLine?.expertiseGroup;

    if (group === 'LAB_TESTING') return 'XN';
    if (group === 'IMAGING') return 'SA';
    return 'KT';
  }

  private async generateWarrantyCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('WAR');
    return sequenceCode(tx, 'warranty', prefix, 4, false);
  }

  private async generateMovementCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('INV');
    return sequenceCode(tx, 'inventory', prefix, 4, false);
  }

  private getDailyCodePrefix(prefix: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${prefix}-${year}${month}${day}`;
  }

  private toPaginatedResult<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): PaginatedResult<T> {
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private defaultInclude() {
    return {
      machine: {
        select: {
          id: true,
          businessLineId: true,
          businessLine: {
            include: {
              productIndustry: true,
            },
          },
          machineCode: true,
          serialNumber: true,
          modelName: true,
          name: true,
          manufacturer: true,
          inventoryStatus: true,
          status: true,
          warrantyStartDate: true,
          warrantyEndDate: true,
        },
      },
      customer: {
        include: {
          region: true,
        },
      },
      businessLine: {
        include: {
          productIndustry: true,
        },
      },
      plannedMachineModel: {
        include: {
          businessLine: {
            include: {
              productIndustry: true,
            },
          },
        },
      },
      installedBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          region: true,
          engineerProfile: true,
        },
      },
      assignments: {
        include: {
          engineer: {
            select: {
              id: true,
              email: true,
              fullName: true,
              engineerProfile: true,
            },
          },
        },
        orderBy: [{ isLead: 'desc' as const }, { assignedAt: 'asc' as const }],
      },
      reviewer: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      warrantyCard: true,
    };
  }
}

function docParagraph(
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    underline?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
) {
  return new Paragraph({
    alignment: options.align,
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        italics: options.italics,
        underline: options.underline
          ? { type: UnderlineType.SINGLE }
          : undefined,
        size: options.size ?? 24,
        font: 'Times New Roman',
      }),
    ],
  });
}

function docFieldLine(text: string) {
  return docParagraph(text || '................................');
}

function docTwoColumns(left: string, right: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderlessTableBorders(),
    rows: [
      new TableRow({
        children: [
          docCell([docParagraph(left)]),
          docCell([docParagraph(right)]),
        ],
      }),
    ],
  });
}

function docCell(children: Paragraph[], options: { width?: number } = {}) {
  return new TableCell({
    width: options.width
      ? { size: options.width, type: WidthType.PERCENTAGE }
      : undefined,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children,
  });
}

function docHeaderCell(text: string) {
  return new TableCell({
    shading: { fill: 'F3F4F6' },
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  });
}

function docBodyCell(
  text: string,
  options: { align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) {
  return new TableCell({
    margins: { top: 100, bottom: 100, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: options.align,
        children: [
          new TextRun({
            text: text || '',
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      }),
    ],
  });
}

function signatureCell(title: string) {
  return new TableCell({
    margins: { top: 220, bottom: 900, left: 80, right: 80 },
    children: [
      docParagraph(title, {
        bold: true,
        align: AlignmentType.CENTER,
      }),
    ],
  });
}

function signatureNameCell(name?: string | null) {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [
      docParagraph(docValue(name), {
        align: AlignmentType.CENTER,
      }),
    ],
  });
}

function borderlessTableBorders() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };
}

function docValue(value?: string | number | null) {
  const text =
    value === undefined || value === null ? '' : String(value).trim();
  return text || '................................';
}

function isSameHandoverDevice(
  item: { itemName: string; model: string; serialNumber: string },
  main: { itemName: string; model: string; serialNumber: string },
) {
  const itemSerial = normalizedDocValue(item.serialNumber);
  const mainSerial = normalizedDocValue(main.serialNumber);
  if (itemSerial && mainSerial && itemSerial === mainSerial) return true;

  const itemName = normalizedDocValue(item.itemName);
  const itemModel = normalizedDocValue(item.model);
  const mainName = normalizedDocValue(main.itemName);
  const mainModel = normalizedDocValue(main.model);

  return Boolean(
    !itemSerial &&
    ((itemName && (itemName === mainName || itemName === mainModel)) ||
      (itemModel && (itemModel === mainModel || itemModel === mainName))),
  );
}

function normalizedDocValue(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized === '................................' ? '' : normalized;
}

function formatVietnameseFullDate(value?: Date | string | null) {
  const date = toDate(value) ?? new Date();
  return `Ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(
    date.getMonth() + 1,
  ).padStart(2, '0')} năm ${date.getFullYear()}`;
}

function formatShortDate(value?: Date | string | null) {
  const date = toDate(value);
  if (!date) return '................................';

  return `${String(date.getDate()).padStart(2, '0')}/${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatWarrantyPeriod(
  startValue?: Date | string | null,
  endValue?: Date | string | null,
) {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end) return 'Theo hợp đồng';

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  if (months > 0) return `${months} tháng`;

  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
