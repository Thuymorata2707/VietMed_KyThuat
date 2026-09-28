import { Edit3, Headphones, Loader2, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { DeleteTicketDialog } from '../../components/DeleteTicketDialog';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';
import {
  workEyebrowClass,
  workPanelClass,
  workSectionHeaderClass,
  workSectionTitleClass,
  workStepBadgeClass,
} from '../../styles/workFormClasses';

type ApplicationSupportPageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

type SupportChannel = 'PHONE' | 'ZALO' | 'REMOTE' | 'ONSITE' | 'EMAIL' | 'OTHER';
type SupportIssueCategory = 'APP_ERROR' | 'USER_GUIDANCE' | 'CONFIGURATION' | 'HIS_RIS_PACS' | 'DICOM' | 'WORKLIST' | 'PRINTING' | 'LICENSE' | 'DATA_EXPORT' | 'TRAINING' | 'OTHER';
type SupportWorkType = 'APP_SUPPORT' | 'REAGENT_SETUP' | 'QC_CALIBRATION' | 'LIS_HIS' | 'TRAINING' | 'FOLLOW_UP' | 'OTHER';
type SupportStatus = 'RESOLVED' | 'WAITING_CUSTOMER' | 'WAITING_HOSPITAL_IT' | 'WAITING_VENDOR' | 'NEEDS_ONSITE' | 'FOLLOW_UP';

type SupportCase = {
  id: string;
  engineerId: string;
  supportedAt: string;
  channel: SupportChannel;
  workType: SupportWorkType;
  issueCategory: SupportIssueCategory;
  status: SupportStatus;
  customerId?: string | null;
  machineId?: string | null;
  machineModelId?: string | null;
  customerName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  appModule?: string | null;
  machineText?: string | null;
  impactLevel?: string | null;
  reagentName?: string | null;
  reagentLot?: string | null;
  reagentExpiry?: string | null;
  assayName?: string | null;
  qcResult?: string | null;
  calibrationResult?: string | null;
  lisHisStatus?: string | null;
  title: string;
  issueDescription: string;
  resolution: string;
  durationMinutes?: number | null;
  pending?: string | null;
  nextAction?: string | null;
  followUpNeeded: boolean;
  followUpDate?: string | null;
  knowledgeCandidate: boolean;
  note?: string | null;
  engineer?: { id: string; fullName?: string | null; email?: string | null } | null;
  customer?: { id: string; name: string; phone?: string | null; contactPerson?: string | null; contactPhone?: string | null; province?: string | null } | null;
  machine?: { id: string; machineCode?: string | null; serialNumber: string; modelName?: string | null; name?: string | null } | null;
  machineModel?: { id: string; code?: string | null; name?: string | null; displayName?: string | null } | null;
};

type CustomerOption = {
  id: string;
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
};

type MachineOption = {
  id: string;
  machineCode?: string | null;
  serialNumber: string;
  modelName?: string | null;
  name?: string | null;
};

type ModelOption = {
  id: string;
  code?: string | null;
  name: string;
  displayName?: string | null;
};

type FormState = {
  supportedAt: string;
  channel: SupportChannel;
  workType: SupportWorkType;
  issueCategory: SupportIssueCategory;
  status: SupportStatus;
  customerId: string;
  machineId: string;
  machineModelId: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  appModule: string;
  machineText: string;
  impactLevel: string;
  reagentName: string;
  reagentLot: string;
  reagentExpiry: string;
  assayName: string;
  qcResult: string;
  calibrationResult: string;
  lisHisStatus: string;
  title: string;
  issueDescription: string;
  resolution: string;
  durationMinutes: string;
  pending: string;
  nextAction: string;
  followUpNeeded: boolean;
  followUpDate: string;
  knowledgeCandidate: boolean;
  note: string;
};

const channelLabels: Record<SupportChannel, string> = {
  PHONE: 'Điện thoại',
  ZALO: 'Zalo',
  REMOTE: 'Remote',
  ONSITE: 'Onsite',
  EMAIL: 'Email',
  OTHER: 'Khác',
};

const issueLabels: Record<SupportIssueCategory, string> = {
  APP_ERROR: 'Lỗi app',
  USER_GUIDANCE: 'Hướng dẫn thao tác',
  CONFIGURATION: 'Cấu hình',
  HIS_RIS_PACS: 'HIS/RIS/PACS',
  DICOM: 'DICOM',
  WORKLIST: 'Worklist',
  PRINTING: 'In ấn',
  LICENSE: 'License',
  DATA_EXPORT: 'Xuất dữ liệu',
  TRAINING: 'Đào tạo',
  OTHER: 'Khác',
};

const workTypeLabels: Record<SupportWorkType, string> = {
  APP_SUPPORT: 'Ứng dụng xét nghiệm',
  REAGENT_SETUP: 'Cài hóa chất',
  QC_CALIBRATION: 'QC/Calib',
  LIS_HIS: 'LIS/HIS',
  TRAINING: 'Đào tạo',
  FOLLOW_UP: 'Theo dõi ứng dụng',
  OTHER: 'Hỗ trợ khác',
};

const statusLabels: Record<SupportStatus, string> = {
  RESOLVED: 'Đã xử lý',
  WAITING_CUSTOMER: 'Chờ khách hàng',
  WAITING_HOSPITAL_IT: 'Chờ IT bệnh viện',
  WAITING_VENDOR: 'Chờ hãng',
  NEEDS_ONSITE: 'Cần onsite',
  FOLLOW_UP: 'Follow-up',
};

const today = toDateInput(new Date());

export function ApplicationSupportPage({ currentRole, user }: ApplicationSupportPageProps) {
  const isLabApplicationUser = user.engineerProfile?.expertiseGroups?.includes('LAB_TESTING')
    ?? user.engineerProfile?.expertiseGroup === 'LAB_TESTING';
  const isAdmin = currentRole === 'admin';
  const canManageCases = currentRole === 'engineer' && isLabApplicationUser;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedCaseId = searchParams.get('case');
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [workType, setWorkType] = useState<SupportWorkType | ''>('');
  const [status, setStatus] = useState<SupportStatus | ''>('');
  const [issueCategory, setIssueCategory] = useState<SupportIssueCategory | ''>('');
  const [editingId, setEditingId] = useState('');
  const [selectedCase, setSelectedCase] = useState<SupportCase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportCase | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const params = useMemo(() => {
    const next = new URLSearchParams({ limit: '50' });
    if (requestedCaseId) next.set('id', requestedCaseId);
    else if (search.trim()) next.set('search', search.trim());
    if (workType) next.set('workType', workType);
    if (status) next.set('status', status);
    if (issueCategory) next.set('issueCategory', issueCategory);
    return next.toString();
  }, [issueCategory, requestedCaseId, search, status, workType]);

  const casesQuery = useQuery({
    queryKey: queryKeys.applicationSupport.list(params),
    queryFn: async () => apiFetch<Paginated<SupportCase>>(`/application-support?${params}`),
  });

  const optionsQuery = useQuery({
    enabled: canManageCases,
    queryKey: queryKeys.applicationSupport.options,
    queryFn: async () => {
      const [customers, machines, models] = await Promise.all([
        apiFetchAllPages<CustomerOption>('/customers'),
        apiFetchAllPages<MachineOption>('/machines'),
        apiFetchAllPages<ModelOption>('/machine-models'),
      ]);
      return {
        customers,
        machines,
        models,
      };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form, user.id);
      return editingId
        ? apiFetch<SupportCase>(`/application-support/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : apiFetch<SupportCase>('/application-support', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      setSuccess(editingId ? 'Đã cập nhật ca ứng dụng xét nghiệm.' : 'Đã ghi nhận ca ứng dụng xét nghiệm.');
      setEditingId('');
      setForm(emptyForm());
      await queryClient.invalidateQueries({ queryKey: ['application-support'] });
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/application-support/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleteTarget(null);
      setSuccess('Đã xóa ca ứng dụng xét nghiệm.');
      await queryClient.invalidateQueries({ queryKey: ['application-support'] });
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports'] });
    },
  });

  const cases = casesQuery.data?.data ?? [];
  useEffect(() => {
    if (!requestedCaseId || casesQuery.isLoading) return;
    const requestedCase = cases.find((item) => item.id === requestedCaseId);
    if (requestedCase) setSelectedCase(requestedCase);
  }, [cases, casesQuery.isLoading, requestedCaseId]);
  const options = optionsQuery.data ?? { customers: [], machines: [], models: [] };
  const loading = casesQuery.isLoading || casesQuery.isFetching || optionsQuery.isFetching;
  const error =
    formError ||
    (casesQuery.error instanceof Error ? casesQuery.error.message : '') ||
    (optionsQuery.error instanceof Error ? optionsQuery.error.message : '') ||
    (saveMutation.error instanceof Error ? saveMutation.error.message : '') ||
    (deleteMutation.error instanceof Error ? deleteMutation.error.message : '');

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function saveCase() {
    setFormError('');
    setSuccess('');
    if (!form.title.trim() || !form.issueDescription.trim() || !form.resolution.trim()) {
      setFormError('Vui lòng nhập lỗi/yêu cầu, mô tả và cách khắc phục.');
      return;
    }
    try {
      await saveMutation.mutateAsync();
    } catch {
      // handled by mutation error
    }
  }

  function editCase(item: SupportCase) {
    if (!canManageCases) return;
    setEditingId(item.id);
    setForm({
      supportedAt: toDateInput(new Date(item.supportedAt)),
      channel: item.channel,
      workType: item.workType || 'APP_SUPPORT',
      issueCategory: item.issueCategory,
      status: item.status,
      customerId: item.customerId ?? '',
      machineId: item.machineId ?? '',
      machineModelId: item.machineModelId ?? '',
      customerName: item.customerName ?? item.customer?.name ?? '',
      contactName: item.contactName ?? item.customer?.contactPerson ?? '',
      contactPhone: item.contactPhone ?? item.customer?.contactPhone ?? item.customer?.phone ?? '',
      appModule: item.appModule ?? '',
      machineText: item.machineText ?? '',
      impactLevel: item.impactLevel ?? '',
      reagentName: item.reagentName ?? '',
      reagentLot: item.reagentLot ?? '',
      reagentExpiry: item.reagentExpiry ? toDateInput(new Date(item.reagentExpiry)) : '',
      assayName: item.assayName ?? '',
      qcResult: item.qcResult ?? '',
      calibrationResult: item.calibrationResult ?? '',
      lisHisStatus: item.lisHisStatus ?? '',
      title: item.title,
      issueDescription: item.issueDescription,
      resolution: item.resolution,
      durationMinutes: item.durationMinutes ? String(item.durationMinutes) : '',
      pending: item.pending ?? '',
      nextAction: item.nextAction ?? '',
      followUpNeeded: item.followUpNeeded,
      followUpDate: item.followUpDate ? toDateInput(new Date(item.followUpDate)) : '',
      knowledgeCandidate: item.knowledgeCandidate,
      note: item.note ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId('');
    setForm(emptyForm());
    setFormError('');
  }

  return (
    <PageFrame>
      <PageTitle
        eyebrow="Application specialist"
        title="Hỗ trợ app xét nghiệm"
      />

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {canManageCases ? (
      <section className="grid min-w-0 gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[24px] border border-[#e4e4e7] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#eefaf3] text-[#177245]">
              <Headphones size={19} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">{editingId ? 'Sửa ca ứng dụng xét nghiệm' : 'Ghi nhận ca ứng dụng xét nghiệm'}</h2>
            </div>
          </div>
          {editingId ? (
            <button className="secondary-button" onClick={cancelEdit} type="button">
              <X size={16} />
              Hủy sửa
            </button>
          ) : null}
        </div>

        <div className={panelClass}>
          <div className={sectionHeaderClass}>
            <span className={stepBadgeClass}>1</span>
            <div>
              <span className={eyebrowClass}>Thông tin ca</span>
              <h2 className={sectionTitleClass}>Tiếp nhận yêu cầu</h2>
            </div>
          </div>

          <div className="grid min-w-0 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <label className={labelClass}>
              Ngày hỗ trợ
              <input className={inputClass} onChange={(event) => updateForm({ supportedAt: event.target.value })} type="date" value={form.supportedAt} />
            </label>
            <label className={labelClass}>
              Kênh
              <select className={inputClass} onChange={(event) => updateForm({ channel: event.target.value as SupportChannel })} value={form.channel}>
                {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Loại việc
              <select className={inputClass} onChange={(event) => updateForm({ workType: event.target.value as SupportWorkType })} value={form.workType}>
                {Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Nhóm vấn đề
              <select className={inputClass} onChange={(event) => updateForm({ issueCategory: event.target.value as SupportIssueCategory })} value={form.issueCategory}>
                {Object.entries(issueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Trạng thái
              <select className={inputClass} onChange={(event) => updateForm({ status: event.target.value as SupportStatus })} value={form.status}>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-5 grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(140px,200px)]">
            <label className={labelClass}>
              Lỗi/yêu cầu
              <input className={inputClass} onChange={(event) => updateForm({ title: event.target.value })} placeholder="VD: Không gửi được kết quả qua LIS" value={form.title} />
            </label>
            <label className={labelClass}>
              Thời lượng phút
              <input className={inputClass} min={0} onChange={(event) => updateForm({ durationMinutes: event.target.value })} type="number" value={form.durationMinutes} />
            </label>
          </div>

          <div className="mt-5 grid min-w-0 gap-5">
            <label className={labelClass}>
              Mô tả lỗi
              <textarea className={`${inputClass} min-h-28 py-2.5`} onChange={(event) => updateForm({ issueDescription: event.target.value })} value={form.issueDescription} />
            </label>
          </div>
        </div>

        <div className={panelClass}>
          <div className={sectionHeaderClass}>
            <span className={stepBadgeClass}>2</span>
            <div>
              <span className={eyebrowClass}>Khách hàng & máy</span>
              <h2 className={sectionTitleClass}>Thông tin tại điểm hỗ trợ</h2>
            </div>
          </div>

          <div className="grid min-w-0 gap-5 md:grid-cols-3">
            <label className={labelClass}>
              Khách hàng có sẵn
              <select className={inputClass} onChange={(event) => {
                const customer = options.customers.find((item) => item.id === event.target.value);
                updateForm({
                  customerId: event.target.value,
                  customerName: customer?.name ?? form.customerName,
                  contactName: customer?.contactPerson ?? form.contactName,
                  contactPhone: customer?.contactPhone ?? customer?.phone ?? form.contactPhone,
                });
              }} value={form.customerId}>
                <option value="">Không chọn</option>
                {options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Tên khách hàng/bệnh viện
              <input className={inputClass} onChange={(event) => updateForm({ customerName: event.target.value })} value={form.customerName} />
            </label>
            <label className={labelClass}>
              Người gọi / số điện thoại
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <input className={inputClass} onChange={(event) => updateForm({ contactName: event.target.value })} placeholder="Người gọi" value={form.contactName} />
                <input className={inputClass} onChange={(event) => updateForm({ contactPhone: event.target.value })} placeholder="Số ĐT" value={form.contactPhone} />
              </div>
            </label>
          </div>

          <div className="mt-5 grid min-w-0 gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Máy
              <select className={inputClass} onChange={(event) => {
                const machine = options.machines.find((item) => item.id === event.target.value);
                updateForm({
                  machineId: event.target.value,
                  machineText: machine ? machineLabel(machine) : form.machineText,
                });
              }} value={form.machineId}>
                <option value="">Không chọn</option>
                {options.machines.map((machine) => <option key={machine.id} value={machine.id}>{machineLabel(machine)}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Model
              <select className={inputClass} onChange={(event) => updateForm({ machineModelId: event.target.value })} value={form.machineModelId}>
                <option value="">Không chọn</option>
                {options.models.map((model) => <option key={model.id} value={model.id}>{model.displayName || model.name || model.code}</option>)}
              </select>
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              App/module
              <input className={inputClass} onChange={(event) => updateForm({ appModule: event.target.value })} placeholder="VD: DICOM, Worklist, QC, LIS..." value={form.appModule} />
            </label>
          </div>
        </div>

        <div className={panelClass}>
          <div className={sectionHeaderClass}>
            <span className={stepBadgeClass}>3</span>
            <div>
              <span className={eyebrowClass}>Xử lý và kết quả</span>
              <h2 className={sectionTitleClass}>Thực hiện và bàn giao</h2>
            </div>
          </div>

          {['REAGENT_SETUP', 'QC_CALIBRATION', 'LIS_HIS'].includes(form.workType) ? (
            <div className="mb-5 grid min-w-0 gap-5 rounded-2xl border border-[#dbe6f3] bg-[#fbfdff] p-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="md:col-span-2 lg:col-span-4">
                <span className={eyebrowClass}>Thông tin xét nghiệm</span>
                <h3 className="mt-1 text-sm font-semibold text-[#1f1f1f]">Hóa chất, QC/Calib và LIS/HIS</h3>
              </div>
              <label className={labelClass}>
                Hóa chất/kit
                <input className={inputClass} onChange={(event) => updateForm({ reagentName: event.target.value })} value={form.reagentName} />
              </label>
              <label className={labelClass}>
                Lot
                <input className={inputClass} onChange={(event) => updateForm({ reagentLot: event.target.value })} value={form.reagentLot} />
              </label>
              <label className={labelClass}>
                Hạn dùng
                <input className={inputClass} onChange={(event) => updateForm({ reagentExpiry: event.target.value })} type="date" value={form.reagentExpiry} />
              </label>
              <label className={labelClass}>
                Assay/test
                <input className={inputClass} onChange={(event) => updateForm({ assayName: event.target.value })} value={form.assayName} />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Kết quả QC
                <input className={inputClass} onChange={(event) => updateForm({ qcResult: event.target.value })} value={form.qcResult} />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Kết quả calibration
                <input className={inputClass} onChange={(event) => updateForm({ calibrationResult: event.target.value })} value={form.calibrationResult} />
              </label>
              <label className={`${labelClass} md:col-span-2 lg:col-span-4`}>
                Trạng thái LIS/HIS
                <input className={inputClass} onChange={(event) => updateForm({ lisHisStatus: event.target.value })} value={form.lisHisStatus} />
              </label>
            </div>
          ) : null}

          <div className="grid min-w-0 gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Cách khắc phục
              <textarea className={`${inputClass} min-h-28 py-2.5`} onChange={(event) => updateForm({ resolution: event.target.value })} value={form.resolution} />
            </label>
            <label className={labelClass}>
              Tồn đọng
              <textarea className={`${inputClass} min-h-28 py-2.5`} onChange={(event) => updateForm({ pending: event.target.value })} value={form.pending} />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              Việc tiếp theo
              <textarea className={`${inputClass} min-h-20 py-2.5`} onChange={(event) => updateForm({ nextAction: event.target.value })} value={form.nextAction} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeeee] pt-4">
            <div className="flex flex-wrap gap-3 text-sm font-semibold text-[#333333]">
              <label className="inline-flex items-center gap-2">
                <input checked={form.followUpNeeded} onChange={(event) => updateForm({ followUpNeeded: event.target.checked })} type="checkbox" />
                Cần follow-up
              </label>
              {form.followUpNeeded ? <input className={inputClass} onChange={(event) => updateForm({ followUpDate: event.target.value })} type="date" value={form.followUpDate} /> : null}
              <label className="inline-flex items-center gap-2">
                <input checked={form.knowledgeCandidate} onChange={(event) => updateForm({ knowledgeCandidate: event.target.checked })} type="checkbox" />
                Nên đưa vào tri thức
              </label>
            </div>
            <button className="primary-button" disabled={saveMutation.isPending} onClick={saveCase} type="button">
              {saveMutation.isPending ? <Loader2 className="spin-icon" size={16} /> : editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? 'Lưu thay đổi' : 'Ghi nhận'}
            </button>
          </div>
        </div>
      </section>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 border-b border-[#eeeeee] bg-[#fafafa] p-4 lg:grid-cols-[minmax(260px,1fr)_180px_190px_220px_auto]">
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#d4d4d8] bg-white px-3 text-[#666666]">
            <Search size={16} />
            <input className="min-w-0 flex-1 border-0 bg-transparent text-[#1f1f1f] outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khách hàng, số ĐT, lỗi, cách xử lý" value={search} />
          </label>
          <select className={inputClass} onChange={(event) => setWorkType(event.target.value as SupportWorkType | '')} value={workType}>
            <option value="">Tất cả loại việc</option>
            {Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className={inputClass} onChange={(event) => setStatus(event.target.value as SupportStatus | '')} value={status}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className={inputClass} onChange={(event) => setIssueCategory(event.target.value as SupportIssueCategory | '')} value={issueCategory}>
            <option value="">Tất cả nhóm lỗi</option>
            {Object.entries(issueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="secondary-button" disabled={loading} onClick={() => void casesQuery.refetch()} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
        </div>

        <div className="grid">
          {loading ? <div className="grid min-h-32 place-items-center text-sm font-semibold text-[#666666]">Đang tải ca hỗ trợ...</div> : null}
          {!loading && !cases.length ? <div className="grid min-h-40 place-items-center p-6 text-center text-sm text-[#666666]">Chưa có ca ứng dụng xét nghiệm phù hợp.</div> : null}
          {!loading ? cases.map((item) => (
            <article className="grid gap-3 border-b border-[#eeeeee] p-4 last:border-b-0 xl:grid-cols-[minmax(0,1fr)_220px_auto]" key={item.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#666666]">
                  <span>{formatDate(item.supportedAt)}</span>
                  <span>{workTypeLabels[item.workType || 'APP_SUPPORT']}</span>
                  <span>{channelLabels[item.channel]}</span>
                  <span>{issueLabels[item.issueCategory]}</span>
                  {item.durationMinutes ? <span>{item.durationMinutes} phút</span> : null}
                </div>
                <h3 className="mt-1 text-base font-semibold text-[#1f1f1f] [overflow-wrap:anywhere]">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#666666] [overflow-wrap:anywhere]">{item.issueDescription}</p>
                <p className="mt-2 rounded-xl bg-[#fafafa] px-3 py-2 text-sm leading-6 text-[#333333] [overflow-wrap:anywhere]">
                  <strong>Khắc phục:</strong> {item.resolution}
                </p>
                {caseLabSummary(item) ? (
                  <p className="mt-2 text-sm leading-6 text-[#555555] [overflow-wrap:anywhere]">{caseLabSummary(item)}</p>
                ) : null}
              </div>
              <div className="grid content-start gap-1.5 text-sm text-[#666666]">
                <strong className="text-[#1f1f1f]">{item.customer?.name || item.customerName || 'Chưa rõ khách hàng'}</strong>
                <span>{[item.contactName, item.contactPhone].filter(Boolean).join(' - ') || 'Chưa có liên hệ'}</span>
                <span>{caseMachineLabel(item) || 'Chưa gắn máy/model'}</span>
                <span className={statusBadgeClass(item.status)}>{statusLabels[item.status]}</span>
                {item.followUpNeeded ? <span className="font-semibold text-[#9b5a17]">Follow-up {item.followUpDate ? formatDate(item.followUpDate) : ''}</span> : null}
              </div>
              {canManageCases || isAdmin ? (
              <div className="flex flex-wrap items-start gap-2 xl:justify-end">
                <button className="secondary-button" onClick={() => setSelectedCase(item)} type="button">Chi tiết</button>
                {canManageCases ? (
                  <button className="secondary-button" onClick={() => editCase(item)} type="button">
                    <Edit3 size={15} />
                    Sửa
                  </button>
                ) : null}
                {isAdmin ? (
                  <button className="secondary-button danger" disabled={deleteMutation.isPending} onClick={() => setDeleteTarget(item)} type="button">
                    <Trash2 size={15} />
                    Xóa phiếu
                  </button>
                ) : null}
              </div>
              ) : <button className="secondary-button w-fit" onClick={() => setSelectedCase(item)} type="button">Chi tiết</button>}
            </article>
          )) : null}
        </div>
      </section>
      {selectedCase ? (
        <ApplicationSupportDetailModal
          canEdit={canManageCases}
          item={selectedCase}
          onClose={() => setSelectedCase(null)}
          onEdit={() => {
            editCase(selectedCase);
            setSelectedCase(null);
          }}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteTicketDialog
          details={[
            { label: 'Ngày ghi nhận', value: formatDate(deleteTarget.supportedAt) },
            { label: 'Nội dung', value: deleteTarget.title },
            { label: 'Khách hàng', value: deleteTarget.customer?.name || deleteTarget.customerName },
            { label: 'Thiết bị', value: caseMachineLabel(deleteTarget) },
            { label: 'Kỹ sư', value: deleteTarget.engineer?.fullName || deleteTarget.engineer?.email },
            { label: 'Trạng thái', value: statusLabels[deleteTarget.status] },
          ]}
          loading={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          title="Bạn sắp xóa phiếu hỗ trợ này"
          warning="Nội dung và lịch sử liên kết của phiếu sẽ bị xóa vĩnh viễn. Kỹ sư có thể tạo lại phiếu sau đó."
        />
      ) : null}
    </PageFrame>
  );
}

function ApplicationSupportDetailModal({
  canEdit,
  item,
  onClose,
  onEdit,
}: {
  canEdit: boolean;
  item: SupportCase;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <section aria-labelledby="application-case-detail-title" aria-modal="true" className="grid max-h-[90vh] w-full max-w-4xl gap-5 overflow-y-auto rounded-2xl border border-[#e7e2dc] bg-white p-5 shadow-[0_24px_72px_rgba(24,24,27,0.2)] sm:p-6" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee9e4] pb-4">
          <div>
            <span className="text-sm font-medium text-[#737b80]">{workTypeLabels[item.workType]} · {statusLabels[item.status]}</span>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#252c30]" id="application-case-detail-title">{item.title}</h2>
          </div>
          <button aria-label="Đóng chi tiết" className="secondary-button compact" onClick={onClose} type="button">Đóng</button>
        </header>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="grid content-start gap-3">
            <h3 className="font-semibold text-[#252c30]">Tiếp nhận</h3>
            <SupportDetailRow label="Ngày hỗ trợ" value={formatDate(item.supportedAt)} />
            <SupportDetailRow label="Kênh" value={channelLabels[item.channel]} />
            <SupportDetailRow label="Nhóm vấn đề" value={issueLabels[item.issueCategory]} />
            <SupportDetailRow label="Thời lượng" value={item.durationMinutes ? `${item.durationMinutes} phút` : null} />
            <SupportDetailRow label="Khách hàng" value={item.customer?.name || item.customerName} />
            <SupportDetailRow label="Người liên hệ" value={[item.contactName, item.contactPhone].filter(Boolean).join(' · ')} />
            <SupportDetailRow label="Kỹ sư" value={item.engineer?.fullName || item.engineer?.email} />
          </section>
          <section className="grid content-start gap-3">
            <h3 className="font-semibold text-[#252c30]">Thiết bị và ứng dụng</h3>
            <SupportDetailRow label="Máy" value={caseMachineLabel(item)} />
            <SupportDetailRow label="Module" value={item.appModule} />
            <SupportDetailRow label="Mức ảnh hưởng" value={item.impactLevel} />
            <SupportDetailRow label="Hóa chất / kit" value={item.reagentName} />
            <SupportDetailRow label="Lot / hạn dùng" value={[item.reagentLot, item.reagentExpiry ? formatDate(item.reagentExpiry) : ''].filter(Boolean).join(' · ')} />
            <SupportDetailRow label="Assay / test" value={item.assayName} />
            <SupportDetailRow label="Kết quả QC / calib" value={[item.qcResult, item.calibrationResult].filter(Boolean).join(' · ')} />
            <SupportDetailRow label="LIS / HIS" value={item.lisHisStatus} />
          </section>
          <section className="grid content-start gap-3 md:col-span-2">
            <h3 className="font-semibold text-[#252c30]">Nội dung và kết quả</h3>
            <SupportDetailRow label="Mô tả yêu cầu" value={item.issueDescription} />
            <SupportDetailRow label="Cách xử lý" value={item.resolution} />
            <SupportDetailRow label="Tồn đọng" value={item.pending} />
            <SupportDetailRow label="Việc tiếp theo" value={item.nextAction} />
            <SupportDetailRow label="Follow-up" value={item.followUpNeeded ? (item.followUpDate ? formatDate(item.followUpDate) : 'Có, chưa đặt ngày') : 'Không'} />
            <SupportDetailRow label="Ghi chú" value={item.note} />
          </section>
        </div>
        {canEdit ? <div className="flex justify-end border-t border-[#eee9e4] pt-4"><button className="primary-button" onClick={onEdit} type="button"><Edit3 size={16} />Sửa ca hỗ trợ</button></div> : null}
      </section>
    </div>
  );
}

function SupportDetailRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="grid gap-1 border-b border-[#f0ece8] pb-2 text-sm sm:grid-cols-[145px_minmax(0,1fr)]"><span className="text-[#737b80]">{label}</span><strong className="break-words font-medium text-[#252c30]">{value || '—'}</strong></div>;
}

function emptyForm(): FormState {
  return {
    supportedAt: today,
    channel: 'PHONE',
    workType: 'APP_SUPPORT',
    issueCategory: 'APP_ERROR',
    status: 'RESOLVED',
    customerId: '',
    machineId: '',
    machineModelId: '',
    customerName: '',
    contactName: '',
    contactPhone: '',
    appModule: '',
    machineText: '',
    impactLevel: '',
    reagentName: '',
    reagentLot: '',
    reagentExpiry: '',
    assayName: '',
    qcResult: '',
    calibrationResult: '',
    lisHisStatus: '',
    title: '',
    issueDescription: '',
    resolution: '',
    durationMinutes: '',
    pending: '',
    nextAction: '',
    followUpNeeded: false,
    followUpDate: '',
    knowledgeCandidate: false,
    note: '',
  };
}

function buildPayload(form: FormState, engineerId?: string) {
  return {
    ...form,
    engineerId,
    customerId: form.customerId || undefined,
    machineId: form.machineId || undefined,
    machineModelId: form.machineModelId || undefined,
    reagentExpiry: form.reagentExpiry || undefined,
    durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
    followUpDate: form.followUpNeeded && form.followUpDate ? form.followUpDate : undefined,
  };
}

function machineLabel(machine: MachineOption) {
  return [machine.machineCode, machine.serialNumber, machine.modelName || machine.name].filter(Boolean).join(' - ');
}

function caseMachineLabel(item: SupportCase) {
  return [
    item.machine?.machineCode,
    item.machine?.serialNumber,
    item.machine?.modelName || item.machine?.name,
    item.machineModel?.displayName || item.machineModel?.name || item.machineModel?.code,
    item.machineText,
    item.appModule,
  ].filter(Boolean).join(' - ');
}

function caseLabSummary(item: SupportCase) {
  return [
    item.reagentName ? `Hóa chất: ${item.reagentName}` : '',
    item.reagentLot ? `Lot: ${item.reagentLot}` : '',
    item.reagentExpiry ? `HSD: ${formatDate(item.reagentExpiry)}` : '',
    item.assayName ? `Assay: ${item.assayName}` : '',
    item.qcResult ? `QC: ${item.qcResult}` : '',
    item.calibrationResult ? `Calib: ${item.calibrationResult}` : '',
    item.lisHisStatus ? `LIS/HIS: ${item.lisHisStatus}` : '',
  ].filter(Boolean).join(' | ');
}

function statusBadgeClass(status: SupportStatus) {
  const base = 'mt-1 inline-flex w-fit rounded-lg border px-2.5 py-1 text-xs font-semibold';
  if (status === 'RESOLVED') return `${base} border-[#b9e8ca] bg-[#eefaf3] text-[#177245]`;
  if (status === 'NEEDS_ONSITE' || status === 'WAITING_VENDOR') return `${base} border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]`;
  return `${base} border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]`;
}

function toDateInput(value: Date) {
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

const labelClass = 'grid min-w-0 gap-1.5 text-sm font-semibold leading-snug text-[#333333]';
const inputClass = 'box-border min-h-11 w-full min-w-0 rounded-xl border border-[#d4d4d8] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]';
const panelClass = workPanelClass;
const sectionHeaderClass = workSectionHeaderClass;
const stepBadgeClass = workStepBadgeClass;
const eyebrowClass = workEyebrowClass;
const sectionTitleClass = workSectionTitleClass;
