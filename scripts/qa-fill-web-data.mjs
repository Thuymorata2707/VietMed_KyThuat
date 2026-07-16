const API = process.env.QA_API_BASE_URL || 'http://localhost:3000';
const stamp = process.env.QA_STAMP || 'QA-20260716-1555';
const adminEmail = `qa.admin.${stamp.toLowerCase()}@vietmed.vn`;
const engineerEmail = `qa.engineer.${stamp.toLowerCase()}@vietmed.vn`;
const password = process.env.QA_PASSWORD || '123456';

async function request(path, { method = 'GET', token, body, form, ok = [200, 201] } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!ok.includes(res.status)) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${text}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}

async function login(identifier) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: { identifier, password },
  });

  return {
    token: result.accessToken || result.token,
    user: result.user,
  };
}

function listOf(resp) {
  return Array.isArray(resp) ? resp : resp?.data || [];
}

function findBy(items, keys) {
  return listOf(items).find((item) =>
    Object.entries(keys).every(
      ([key, value]) => item[key] === value || String(item[key] || '').includes(value),
    ),
  );
}

async function getOrCreate({ listPath, createPath = listPath, token, match, body, label }) {
  const list = await request(`${listPath}?limit=100&search=${encodeURIComponent(stamp)}`, {
    token,
  });
  const found = findBy(list, match);
  if (found) {
    console.log(`reuse ${label}:`, found.id || found.code || found.email);
    return found;
  }

  const created = await request(createPath, { method: 'POST', token, body });
  console.log(`create ${label}:`, created.id || created.code || created.email);
  return created;
}

async function patch(path, token, body, label) {
  const result = await request(path, { method: 'PATCH', token, body });
  console.log(`patch ${label}:`, result.id || result.code || 'ok');
  return result;
}

async function upload(token, entityType, entityId, type, title, description) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax9Y6kAAAAASUVORK5CYII=',
    'base64',
  );
  const form = new FormData();
  form.append('entityType', entityType);
  form.append('entityId', entityId);
  form.append('type', type);
  form.append('title', title);
  form.append('description', description);
  form.append('file', new Blob([png], { type: 'image/png' }), `${title.replace(/\s+/g, '-').toLowerCase()}.png`);

  const result = await request('/attachments', { method: 'POST', token, form });
  console.log(`upload ${entityType}/${type}:`, result.id, result.originalName);
  return result;
}

async function getOrCreateDailyNote(token, body, label) {
  const notes = await request(`/daily-work-notes?from=${body.workDate}&to=${body.workDate}`, { token });
  const found = listOf(notes).find((note) => note.title === body.title);
  if (found) {
    console.log(`reuse ${label}:`, found.id);
    return found;
  }

  const created = await request('/daily-work-notes', { method: 'POST', token, body });
  console.log(`create ${label}:`, created.id);
  return created;
}

async function main() {
  const admin = await login(adminEmail);
  const engineerLogin = await login(engineerEmail);
  console.log('login ok:', admin.user.email, engineerLogin.user.email);

  const adminToken = admin.token;
  const engToken = engineerLogin.token;

  const regions = await request('/regions?limit=100', { token: adminToken });
  const hanoi = listOf(regions).find((region) => region.code === 'HN' || /hà nội|ha noi/i.test(region.name));
  if (!hanoi) throw new Error('No HN region found');

  const users = await request(`/users?limit=100&search=${encodeURIComponent(stamp)}`, { token: adminToken });
  const engineer = listOf(users).find((user) => user.email === engineerEmail);
  if (!engineer) throw new Error('QA engineer missing');

  const industry = await getOrCreate({
    listPath: '/product-industries',
    token: adminToken,
    label: 'industry',
    match: { code: `QA-IND-${stamp}` },
    body: {
      code: `QA-IND-${stamp}`,
      name: `QA ngành Chẩn đoán hình ảnh ${stamp}`,
      expertiseGroup: 'IMAGING',
      status: 'ACTIVE',
      sortOrder: 99,
      description: 'Dữ liệu kiểm thử đầy đủ cho nhóm siêu âm/X-quang.',
    },
  });

  const line = await getOrCreate({
    listPath: '/business-lines',
    token: adminToken,
    label: 'business line',
    match: { code: `QA-BL-${stamp}` },
    body: {
      code: `QA-BL-${stamp}`,
      name: `QA dòng máy siêu âm ${stamp}`,
      status: 'ACTIVE',
      manufacturer: 'VietMed QA',
      productCategory: 'ULTRASOUND',
      expertiseGroup: 'IMAGING',
      productIndustryId: industry.id,
      countryOfOrigin: 'Japan',
      website: 'vietmed.vn',
      contactPerson: 'QA Hãng',
      contactPhone: '0900000000',
      contactEmail: 'qa.brand@vietmed.vn',
      description: 'Dòng máy phục vụ kiểm thử toàn bộ nghiệp vụ.',
      note: 'Có model, linh kiện, phụ kiện, máy và phiếu phát sinh.',
      managerId: engineer.id,
    },
  });

  let model = await getOrCreate({
    listPath: '/machine-models',
    token: adminToken,
    label: 'machine model',
    match: { code: `QA-MDL-${stamp}` },
    body: {
      businessLineId: line.id,
      code: `QA-MDL-${stamp}`,
      name: `QA UltraCare 500 ${stamp}`,
      displayName: 'QA UltraCare 500',
      status: 'ACTIVE',
      manufacturer: 'VietMed QA',
      countryOfOrigin: 'Japan',
      productCategory: 'ULTRASOUND',
      productLine: 'QA Imaging',
      description: 'Model kiểm thử có probe, monitor, cable.',
      note: 'Dùng để test phiếu kỹ sư và admin.',
      components: [
        {
          code: `QA-COMP-MON-${stamp}`,
          name: 'Màn hình hiển thị',
          description: 'Kiểm tra lỗi hiển thị và cáp tín hiệu',
          accessories: [
            {
              code: `QA-ACC-CABLE-${stamp}`,
              name: 'Cáp tín hiệu monitor',
              requiresSerial: true,
              description: 'Cáp thay thế khi nhiễu hình',
            },
          ],
        },
        {
          code: `QA-COMP-PRB-${stamp}`,
          name: 'Đầu dò convex',
          description: 'Kiểm tra hình ảnh và connector',
          accessories: [
            {
              code: `QA-ACC-PROBE-${stamp}`,
              name: 'Đầu dò convex C5-2',
              requiresSerial: true,
              description: 'Phụ kiện đầu dò cần serial',
            },
          ],
        },
      ],
    },
  });
  model = await request(`/machine-models/${model.id}`, { token: adminToken });

  const customer = await getOrCreate({
    listPath: '/customers',
    token: adminToken,
    label: 'customer',
    match: { customerCode: `QA-CUS-${stamp}` },
    body: {
      customerCode: `QA-CUS-${stamp}`,
      name: `Bệnh viện QA Đa khoa ${stamp}`,
      shortName: 'BV QA',
      hospitalName: `Bệnh viện QA Đa khoa ${stamp}`,
      customerType: 'HOSPITAL',
      status: 'ACTIVE',
      taxCode: '0100000000',
      email: 'qa.benhvien@vietmed.vn',
      website: 'benhvienqa.vn',
      phone: '0240000000',
      contactPerson: 'Nguyễn Văn QA',
      contactPosition: 'Trưởng khoa CĐHA',
      contactPhone: '0912000000',
      contactEmail: 'qa.khachhang@vietmed.vn',
      province: 'Hà Nội',
      district: 'Cầu Giấy',
      ward: 'Dịch Vọng',
      address: 'Số 1 phố Kiểm thử',
      fullAddress: 'Số 1 phố Kiểm thử, Dịch Vọng, Cầu Giấy, Hà Nội',
      note: 'Khách hàng kiểm thử có đủ thông tin liên hệ và địa chỉ.',
      regionId: hanoi.id,
      primaryEngineerId: engineer.id,
    },
  });

  const accs = (model.components || []).flatMap((component) => component.ComponentAccessory || component.accessories || []);
  const machine = await getOrCreate({
    listPath: '/machines',
    token: adminToken,
    label: 'machine',
    match: { serialNumber: `QA-SN-${stamp}` },
    body: {
      machineCode: `QA-MAY-${stamp}`,
      serialNumber: `QA-SN-${stamp}`,
      name: `QA Máy siêu âm phòng CĐHA ${stamp}`,
      imageUrl: 'https://example.com/qa-ultrasound.png',
      modelName: model.name,
      version: 'v1.0-QA',
      manufacturer: 'VietMed QA',
      productCategory: 'ULTRASOUND',
      productLine: 'QA Imaging',
      status: 'ACTIVE',
      inventoryStatus: 'IN_STOCK',
      dataStatus: 'VERIFIED',
      createdSource: 'ADMIN',
      manufacturingDate: '2025-05-20',
      warehouseImportDate: '2026-07-13',
      businessLineId: line.id,
      machineModelId: model.id,
      customerId: customer.id,
      installedById: engineer.id,
      primaryEngineerId: engineer.id,
      accessories: [
        {
          componentAccessoryId: accs[0]?.id,
          code: `QA-MACC-CABLE-${stamp}`,
          name: 'Cáp tín hiệu monitor',
          serialNumber: `QA-CABLE-SN-${stamp}`,
          description: 'Cáp đi kèm máy',
          note: 'Đủ khi bàn giao',
        },
        {
          componentAccessoryId: accs[1]?.id,
          code: `QA-MACC-PROBE-${stamp}`,
          name: 'Đầu dò convex C5-2',
          serialNumber: `QA-PROBE-SN-${stamp}`,
          description: 'Đầu dò chính',
          note: 'Cần kiểm tra hình ảnh trước bàn giao',
        },
      ],
    },
  });
  await upload(adminToken, 'Machine', machine.id, 'MACHINE_PHOTO', `Ảnh máy kho ${stamp}`, 'Ảnh kiểm thử máy trong kho trước khi bàn giao.');

  const installation = await getOrCreate({
    listPath: '/installations',
    token: adminToken,
    label: 'installation',
    match: { machineId: machine.id },
    body: {
      machineId: machine.id,
      customerId: customer.id,
      installedById: engineer.id,
      businessLineId: line.id,
      installedAt: '2026-07-16T02:00:00.000Z',
      accessories: ['Đầu dò convex C5-2', 'Cáp nguồn', 'Gel siêu âm'],
      note: `QA lắp đặt đầy đủ hồ sơ ${stamp}`,
      warrantyStartDate: '2026-07-16T00:00:00.000Z',
      warrantyEndDate: '2027-07-16T00:00:00.000Z',
      warrantyNote: 'Bảo hành 12 tháng cho kiểm thử.',
      handoverInstallerName: 'QA Kỹ sư thiết bị y tế',
      handoverInstallerPosition: 'Kỹ sư dịch vụ',
      handoverVehicle: 'Ô tô công ty 30A-QA',
      handoverDepartureDate: '2026-07-16T01:00:00.000Z',
      receiverInstallAddress: customer.fullAddress,
      receiverRepresentative: 'Nguyễn Văn QA',
      receiverPosition: 'Trưởng khoa CĐHA',
      receiverPhone: '0912000000',
      installedDeviceItems: [
        {
          itemName: 'Máy siêu âm UltraCare 500',
          model: model.name,
          serialNumber: machine.serialNumber,
          manufactureDate: '2025-05-20',
          quantity: 1,
          warrantyPeriod: '12 tháng',
        },
        {
          itemName: 'Đầu dò convex C5-2',
          model: 'C5-2',
          serialNumber: `QA-PROBE-SN-${stamp}`,
          quantity: 1,
          warrantyPeriod: '12 tháng',
        },
      ],
      deviceCondition: 'NEW_100',
      deviceConditionNote: 'Máy mới 100%, đủ phụ kiện, chạy test hình ảnh đạt.',
    },
  });
  await patch(`/installations/${installation.id}/status`, adminToken, { status: 'INSTALLED', note: 'QA duyệt trạng thái lắp đặt hoàn tất.' }, 'installation status');
  await request(`/work-operations/installation/${installation.id}`, {
    method: 'PUT',
    token: engToken,
    body: {
      workLogs: [
        { stepTime: '2026-07-16T02:15:00.000Z', title: 'Khảo sát vị trí lắp', note: 'Kiểm tra nguồn điện, tiếp địa, khoảng cách thao tác.', sortOrder: 1 },
        { stepTime: '2026-07-16T03:10:00.000Z', title: 'Lắp máy và phụ kiện', note: 'Gắn đầu dò, cáp nguồn, kết nối màn hình.', sortOrder: 2 },
        { stepTime: '2026-07-16T04:00:00.000Z', title: 'Hướng dẫn sử dụng', note: 'Hướng dẫn bật/tắt, chọn preset, vệ sinh đầu dò.', sortOrder: 3 },
      ],
      usedParts: [{ name: 'Gel siêu âm bàn giao', quantity: 2, unit: 'chai', unitCost: 85000, status: 'USED', serialNumber: null, note: 'Vật tư bàn giao ban đầu.', usedAt: '2026-07-16T04:20:00.000Z' }],
      checklistItems: [
        { label: 'Kiểm tra nguồn và tiếp địa', status: 'DONE', note: 'Đạt', sortOrder: 1 },
        { label: 'Ghi nhận serial máy và đầu dò', status: 'DONE', note: `Máy ${machine.serialNumber}, đầu dò QA-PROBE-SN`, sortOrder: 2 },
        { label: 'Ký biên bản bàn giao', status: 'DONE', note: 'Đã ký với đại diện khoa.', sortOrder: 3 },
      ],
    },
  });
  await upload(engToken, 'MachineInstallation', installation.id, 'MACHINE_PHOTO', `Ảnh vị trí lắp ${stamp}`, 'Ảnh vị trí máy sau lắp đặt.');
  await upload(engToken, 'MachineInstallation', installation.id, 'HANDOVER_MINUTES', `Biên bản bàn giao ${stamp}`, 'Ảnh/scan biên bản bàn giao kiểm thử.');

  const repair = await getOrCreate({
    listPath: '/repairs',
    token: adminToken,
    label: 'repair',
    match: { title: `QA lỗi nhiễu hình ảnh ${stamp}` },
    body: {
      title: `QA lỗi nhiễu hình ảnh ${stamp}`,
      description: 'Hình ảnh siêu âm nhiễu nhẹ khi chuyển preset bụng tổng quát.',
      machineId: machine.id,
      customerId: customer.id,
      engineerId: engineer.id,
      priority: 'HIGH',
      reportedAt: '2026-07-16T05:00:00.000Z',
      usingDepartment: 'Khoa Chẩn đoán hình ảnh',
      representative: 'Nguyễn Văn QA',
      address: customer.fullAddress,
      contactPhone: '0912000000',
      deviceName: machine.name,
      modelName: model.name,
      serialNumber: machine.serialNumber,
      warrantyStatus: 'Còn bảo hành',
      conditionAssessment: 'Máy hoạt động, lỗi xuất hiện không liên tục.',
      repairMethod: 'Kiểm tra cáp tín hiệu, vệ sinh connector, thay cáp monitor nếu cần.',
    },
  });
  await patch(`/repairs/${repair.id}/status`, adminToken, { status: 'IN_PROGRESS' }, 'repair in progress');
  await request(`/work-operations/repair/${repair.id}`, {
    method: 'PUT',
    token: engToken,
    body: {
      workLogs: [
        { stepTime: '2026-07-16T05:20:00.000Z', title: 'Tiếp nhận hiện trạng', note: 'Ghi nhận lỗi nhiễu hình, chụp ảnh màn hình trước xử lý.', sortOrder: 1 },
        { stepTime: '2026-07-16T05:45:00.000Z', title: 'Kiểm tra nguồn và tiếp địa', note: 'Nguồn ổn định, tiếp địa đạt.', sortOrder: 2 },
        { stepTime: '2026-07-16T06:15:00.000Z', title: 'Vệ sinh connector đầu dò', note: 'Connector có bụi nhẹ, vệ sinh bằng dung dịch chuyên dụng.', sortOrder: 3 },
        { stepTime: '2026-07-16T06:45:00.000Z', title: 'Test lại chức năng', note: 'Preset bụng tổng quát hình ảnh ổn định sau xử lý.', sortOrder: 4 },
      ],
      usedParts: [
        { name: 'Cáp tín hiệu monitor dự phòng', quantity: 1, unit: 'sợi', serialNumber: `QA-PART-CABLE-${stamp}`, unitCost: 450000, status: 'USED', note: 'Thay thử và giữ lại theo phiếu.', usedAt: '2026-07-16T06:10:00.000Z' },
        { name: 'Bo xử lý hình ảnh dự phòng', quantity: 1, unit: 'cái', serialNumber: `QA-PART-BOARD-${stamp}`, unitCost: 2500000, status: 'WAITING', note: 'Chờ linh kiện nếu lỗi tái diễn trong 7 ngày.', usedAt: '2026-07-16T06:20:00.000Z' },
      ],
      checklistItems: [
        { label: 'Ảnh trước xử lý', status: 'DONE', note: 'Đã upload ảnh lỗi.', sortOrder: 1 },
        { label: 'Kiểm tra nguồn', status: 'DONE', note: 'Đạt 220V ổn định.', sortOrder: 2 },
        { label: 'Kiểm tra lỗi hiển thị', status: 'DONE', note: 'Lỗi giảm sau vệ sinh connector.', sortOrder: 3 },
        { label: 'Ảnh sau xử lý', status: 'DONE', note: 'Đã upload ảnh sau xử lý.', sortOrder: 4 },
        { label: 'Kết luận kỹ thuật', status: 'DONE', note: 'Theo dõi thêm, có vật tư chờ nếu lỗi tái diễn.', sortOrder: 5 },
      ],
    },
  });
  await upload(engToken, 'Repair', repair.id, 'ERROR_PHOTO', `Ảnh trước sửa chữa ${stamp}`, 'Màn hình nhiễu trước khi vệ sinh connector.');
  await upload(engToken, 'Repair', repair.id, 'ERROR_PHOTO', `Ảnh sau sửa chữa ${stamp}`, 'Màn hình ổn định sau xử lý.');
  await patch(
    `/repairs/${repair.id}/status`,
    adminToken,
    {
      status: 'WAITING_PARTS',
      resultNote: 'QA đã xử lý giảm lỗi nhiễu hình, chờ linh kiện dự phòng nếu lỗi tái diễn.',
      customerFeedback: 'Khách xác nhận máy vận hành ổn định sau khi vệ sinh connector.',
    },
    'repair waiting parts',
  );

  const maintenance = await getOrCreate({
    listPath: '/maintenance',
    token: adminToken,
    label: 'maintenance',
    match: { title: `QA bảo trì định kỳ ${stamp}` },
    body: {
      title: `QA bảo trì định kỳ ${stamp}`,
      description: 'Bảo trì định kỳ máy siêu âm sau lắp đặt và chạy thử.',
      type: 'PERIODIC',
      machineId: machine.id,
      customerId: customer.id,
      engineerId: engineer.id,
      scheduledDate: '2026-07-17T02:00:00.000Z',
      checklist: ['Vệ sinh máy và đầu dò', 'Hiệu chuẩn hình ảnh', 'Test chức năng Doppler', 'Cảnh báo linh kiện hao mòn'],
      nextDueDate: '2026-10-17T02:00:00.000Z',
      usingDepartment: 'Khoa Chẩn đoán hình ảnh',
      representative: 'Nguyễn Văn QA',
      address: customer.fullAddress,
      contactPhone: '0912000000',
      deviceName: machine.name,
      modelName: model.name,
      serialNumber: machine.serialNumber,
    },
  });
  if (maintenance.status === 'COMPLETED') {
    console.log('reuse maintenance completed:', maintenance.id);
  } else {
    await patch(`/maintenance/${maintenance.id}/status`, adminToken, { status: 'IN_PROGRESS' }, 'maintenance in progress');
    await request(`/work-operations/maintenance/${maintenance.id}`, {
      method: 'PUT',
      token: engToken,
      body: {
        workLogs: [
          { stepTime: '2026-07-17T02:10:00.000Z', title: 'Vệ sinh tổng thể', note: 'Lau vỏ máy, đầu dò, bàn phím, màn hình.', sortOrder: 1 },
          { stepTime: '2026-07-17T02:50:00.000Z', title: 'Hiệu chuẩn và test chức năng', note: 'Test B-mode, Doppler, lưu ảnh, in báo cáo.', sortOrder: 2 },
          { stepTime: '2026-07-17T03:30:00.000Z', title: 'Khuyến nghị vận hành', note: 'Nhắc lịch vệ sinh đầu dò hằng ngày và không kéo căng cáp.', sortOrder: 3 },
        ],
        usedParts: [{ name: 'Dung dịch vệ sinh đầu dò', quantity: 1, unit: 'chai', unitCost: 120000, status: 'USED', note: 'Dùng trong đợt bảo trì.', usedAt: '2026-07-17T02:20:00.000Z' }],
        checklistItems: [
          { label: 'Checklist vệ sinh', status: 'DONE', note: 'Hoàn tất', sortOrder: 1 },
          { label: 'Hiệu chuẩn hình ảnh', status: 'DONE', note: 'Đạt', sortOrder: 2 },
          { label: 'Test chức năng', status: 'DONE', note: 'Đạt', sortOrder: 3 },
          { label: 'Cảnh báo linh kiện', status: 'DONE', note: 'Theo dõi cáp đầu dò sau 3 tháng.', sortOrder: 4 },
        ],
      },
    });
    await upload(engToken, 'Maintenance', maintenance.id, 'MAINTENANCE_FORM', `Ảnh bảo trì ${stamp}`, 'Ảnh checklist bảo trì và vệ sinh máy.');
    await patch(
      `/maintenance/${maintenance.id}/status`,
      adminToken,
      {
        status: 'COMPLETED',
        resultNote: 'QA hoàn tất vệ sinh, hiệu chuẩn và test chức năng. Máy đạt yêu cầu vận hành.',
        nextDueDate: '2026-10-17T02:00:00.000Z',
      },
      'maintenance completed',
    );
  }

  await getOrCreateDailyNote(
    engToken,
    {
      title: `QA lịch lắp đặt và sửa chữa ${stamp}`,
      note: 'Sáng lắp máy, chiều xử lý lỗi nhiễu hình và upload ảnh trước/sau.',
      workDate: '2026-07-16',
      startTime: '08:00',
      endTime: '17:30',
      color: '#2563eb',
      type: 'REPAIR',
      status: 'APPROVED',
    },
    'daily note install/repair',
  );
  await getOrCreateDailyNote(
    engToken,
    {
      title: `QA lịch bảo trì ${stamp}`,
      note: 'Bảo trì định kỳ, test chức năng, ghi nhận vật tư vệ sinh.',
      workDate: '2026-07-17',
      startTime: '08:30',
      endTime: '11:30',
      color: '#059669',
      type: 'MAINTENANCE',
      status: 'APPROVED',
    },
    'daily note maintenance',
  );

  const daily = await request('/daily-reports', {
    method: 'POST',
    token: engToken,
    body: {
      reportDate: '2026-07-16',
      summary: `QA báo cáo ngày ${stamp}: lắp đặt máy siêu âm, xử lý lỗi nhiễu hình, upload ảnh trước/sau, ghi nhận vật tư thay thế và vật tư chờ.\n- Máy: ${machine.name}\n- Khách hàng: ${customer.name}\n- Kết quả: máy chạy ổn định, phiếu sửa chữa đang chờ linh kiện dự phòng nếu lỗi tái diễn.`,
      pending: 'Theo dõi lỗi nhiễu hình 7 ngày; chuẩn bị bo xử lý hình ảnh dự phòng nếu khách báo lại.',
      proposal: 'Bổ sung cảnh báo tự động khi phiếu sửa chữa có vật tư WAITING và thiếu ảnh sau xử lý.',
    },
  });
  console.log('save daily report:', daily.id, daily.status);

  const article = await getOrCreate({
    listPath: '/knowledge-articles',
    token: engToken,
    label: 'knowledge article',
    match: { title: `QA kinh nghiệm xử lý nhiễu hình ${stamp}` },
    body: {
      title: `QA kinh nghiệm xử lý nhiễu hình ${stamp}`,
      summary: 'Kinh nghiệm kiểm tra lỗi nhiễu hình sau lắp đặt máy siêu âm.',
      content: 'Triệu chứng: hình ảnh nhiễu không liên tục khi chuyển preset. Nguyên nhân thường gặp: connector bụi, cáp tín hiệu lỏng, nguồn/tiếp địa chưa ổn định. Cách xử lý: chụp ảnh trước, kiểm tra nguồn, vệ sinh connector, test lại các preset, chụp ảnh sau và ghi vật tư phát sinh.',
      modelHint: model.name,
      ownerTeam: 'Kỹ thuật hình ảnh',
      category: 'REPAIR',
      status: 'DRAFT',
      tags: ['QA', 'siêu âm', 'nhiễu hình', 'connector'],
      symptoms: ['Hình ảnh nhiễu nhẹ', 'Preset chuyển chậm', 'Lỗi không liên tục'],
      steps: ['Chụp ảnh lỗi trước xử lý', 'Kiểm tra nguồn/tiếp địa', 'Vệ sinh connector đầu dò', 'Thay thử cáp tín hiệu', 'Test lại và chụp ảnh sau'],
      checklist: ['Có ảnh trước/sau', 'Có serial máy/đầu dò', 'Có vật tư sử dụng', 'Có kết luận kỹ thuật'],
      note: 'Tạo từ phiếu sửa chữa QA để admin duyệt vào knowledge base.',
      sortOrder: 99,
    },
  });

  const partsSummary = await request(`/work-operations/used-parts/summary?engineerId=${engineer.id}&weekStart=2026-07-13`, { token: adminToken });
  const weekly = await request(`/weekly-reports?userId=${engineer.id}&weekStart=2026-07-13`, { token: adminToken });
  const attachments = await request(`/attachments?limit=100&search=${encodeURIComponent(stamp)}`, { token: adminToken });
  const repairOps = await request(`/work-operations/repair/${repair.id}`, { token: adminToken });

  console.log(
    'VERIFY',
    JSON.stringify(
      {
        engineer: engineer.email,
        ids: {
          industry: industry.id,
          line: line.id,
          model: model.id,
          customer: customer.id,
          machine: machine.id,
          installation: installation.id,
          repair: repair.id,
          maintenance: maintenance.id,
          daily: daily.id,
          article: article.id,
        },
        usedPartsSummaryCount: Array.isArray(partsSummary)
          ? partsSummary.length
          : partsSummary?.data?.length || partsSummary?.items?.length || 0,
        weeklyRows: weekly?.rows?.length || weekly?.data?.[0]?.rows?.length || 0,
        attachments: listOf(attachments).length,
        repairOps: {
          logs: repairOps.workLogs?.length,
          parts: repairOps.usedParts?.length,
          checklist: repairOps.checklistItems?.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('QA_SCRIPT_ERROR');
  console.error(err.stack || err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
