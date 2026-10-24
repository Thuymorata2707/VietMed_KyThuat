import { useState } from 'react';
import { AlertTriangle, Box, CheckCircle2, FileSpreadsheet, Loader2, Upload, Users } from 'lucide-react';
import { apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { queryKeys } from '../../lib/queryKeys';

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
  rowsMissingInstallDate: number;
  unresolvedInstallerNames: string[];
  unresolvedCheckerNames: string[];
  warnings: string[];
};

type PreviewResponse = {
  batchId: string;
  status: string;
  summary: ImportSummary;
};

type ImportResult = {
  createdCustomers: number;
  reusedCustomers: number;
  createdMachines: number;
  createdProbes: number;
  createdInstallationHistory: number;
  createdInventoryMovements: number;
  skippedDuplicateMachines: number;
  skippedProbeSerials: number;
  skippedMissingParty: number;
  missingInstallDate: number;
  alreadyImported?: boolean;
};

const numberFormatter = new Intl.NumberFormat('vi-VN');

export function DataImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');

  async function createPreview() {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    setPreview(null);
    setAcknowledged(false);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await apiFetch<PreviewResponse>('/data-imports/preview', { method: 'POST', body });
      setPreview(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể phân tích tệp Excel.');
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!preview || !acknowledged) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch<ImportResult>('/data-imports/commit', {
        method: 'POST',
        body: JSON.stringify({ batchId: preview.batchId }),
      });
      setResult(response);
      setPreview(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
        queryClient.invalidateQueries({ queryKey: ['resources'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.regions.list }),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể nhập dữ liệu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame>
      <div className="grid gap-5">
        <PageTitle eyebrow="Khách hàng & thiết bị" title="Nhập dữ liệu từ Excel" />

        {error ? <Notice message={error} /> : null}

        <section className="grid gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3f4f6] text-[#374151]"><FileSpreadsheet size={20} /></span>
            <div>
              <h2 className="text-base font-semibold text-[#202124]">Chọn tệp Excel</h2>
              <p className="mt-1 text-sm leading-6 text-[#667085]">Hỗ trợ các sheet Siêu âm, Xét nghiệm và Máy khác. Hệ thống xem trước serial trùng, giữ tên kỹ sư lịch sử và lưu model theo đúng nội dung Excel, không tự tạo model trong danh mục.</p>
            </div>
          </div>

          <label className="grid min-h-32 cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-[#cbd5e1] bg-[#fafafa] p-5 text-center transition hover:border-[#64748b] hover:bg-[#f8fafc]">
            <Upload className="text-[#64748b]" size={22} />
            <span className="text-sm font-semibold text-[#344054]">{file?.name || 'Chọn tệp .xlsx từ máy tính'}</span>
            <span className="text-xs text-[#667085]">Dung lượng tối đa 15 MB</span>
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
                setAcknowledged(false);
                setError('');
              }}
              type="file"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <button className="primary-button" disabled={!file || busy} onClick={() => void createPreview()} type="button">
              {busy && !result ? <Loader2 className="spin-icon" size={17} /> : <FileSpreadsheet size={17} />}
              Phân tích và xem trước
            </button>
          </div>
        </section>

        {preview ? (
          <section className="grid gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef0f3] pb-4">
              <div>
                <h2 className="text-base font-semibold text-[#202124]">Bản xem trước</h2>
                <p className="mt-1 break-all text-sm text-[#667085]">{preview.summary.sourceFileName}</p>
              </div>
              <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-semibold text-[#9a3412]">Chưa ghi vào dữ liệu chính</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard icon={<Users size={17} />} label="Tên khách hàng nhận diện được" value={preview.summary.distinctCustomerNames} />
              <SummaryCard icon={<Box size={17} />} label="Dòng máy" value={preview.summary.machineRows} />
              <SummaryCard icon={<Box size={17} />} label="Đầu dò" value={preview.summary.probeRows} />
              <SummaryCard icon={<AlertTriangle size={17} />} label="Nhóm serial máy trùng" value={preview.summary.duplicateMachineSerialGroups} warning={preview.summary.duplicateMachineSerialGroups > 0} />
            </div>

            {preview.summary.warnings.length ? (
              <div className="grid gap-2 rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#9a3412]"><AlertTriangle size={16} />Cần lưu ý</h3>
                {preview.summary.warnings.map((warning) => <p className="text-sm leading-5 text-[#7c2d12]" key={warning}>{warning}</p>)}
              </div>
            ) : (
              <p className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm text-[#166534]">Không phát hiện cảnh báo cơ bản.</p>
            )}

            <label className="flex items-start gap-2 rounded-xl bg-[#f8fafc] p-3 text-sm leading-5 text-[#344054]">
              <input checked={acknowledged} className="mt-0.5 accent-[#971b2b]" onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
              <span>Tôi đã xem cảnh báo. Serial đã tồn tại hoặc bị trùng trong file sẽ được bỏ qua; dữ liệu hiện có không bị ghi đè.</span>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="primary-button" disabled={!acknowledged || busy} onClick={() => void commitImport()} type="button">
                {busy ? <Loader2 className="spin-icon" size={17} /> : <CheckCircle2 size={17} />}
                Xác nhận nhập vào database
              </button>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="grid gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#166534]"><CheckCircle2 size={19} />Đã nhập dữ liệu</h2>
            <p className="text-sm leading-5 text-[#14532d]">Khách hàng và thiết bị đã được tạo trong dữ liệu chính. Mở danh sách tương ứng để xem hồ sơ vừa nhập.</p>
            <div className="grid gap-2 text-sm text-[#14532d] sm:grid-cols-2 xl:grid-cols-3">
              <p>Khách hàng mới: <strong>{numberFormatter.format(result.createdCustomers)}</strong> · Đã ghép: <strong>{numberFormatter.format(result.reusedCustomers)}</strong></p>
              <p>Máy mới: <strong>{numberFormatter.format(result.createdMachines)}</strong></p>
              <p>Đầu dò mới: <strong>{numberFormatter.format(result.createdProbes)}</strong></p>
              <p>Lịch sử lắp đặt: <strong>{numberFormatter.format(result.createdInstallationHistory)}</strong></p>
              <p>Serial máy bỏ qua: <strong>{numberFormatter.format(result.skippedDuplicateMachines)}</strong></p>
              <p>Đầu dò bỏ qua: <strong>{numberFormatter.format(result.skippedProbeSerials)}</strong></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="primary-button" to="/customers">Mở danh sách khách hàng</Link>
              <Link className="secondary-button" to="/technical-machines?installState=INSTALLED">Mở hồ sơ máy</Link>
            </div>
          </section>
        ) : null}
      </div>
    </PageFrame>
  );
}

function SummaryCard({ icon, label, value, warning = false }: { icon: React.ReactNode; label: string; value: number; warning?: boolean }) {
  return (
    <div className={`grid gap-3 rounded-xl border p-4 ${warning ? 'border-[#fed7aa] bg-[#fff7ed]' : 'border-[#eaecf0] bg-[#fafafa]'}`}>
      <div className="flex items-center gap-2 text-sm text-[#667085]">{icon}<span>{label}</span></div>
      <strong className={`text-2xl font-semibold ${warning ? 'text-[#c2410c]' : 'text-[#202124]'}`}>{numberFormatter.format(value)}</strong>
    </div>
  );
}
