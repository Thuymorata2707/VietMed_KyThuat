import { Text, TextInput } from '@/components/text';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { EngineerWork, WorkKind, WorkOperations, workApi } from '@/api/work.api';
import { FieldColors } from '@/constants/field-theme';
import { dateOnlyToIso } from '@/utils/date';
import { FormChoiceGroup, FormField, FormSection } from '@/components/form-controls';
import { useAuth } from '@/contexts/auth-context';
import { RepairPhotosField } from '@/components/RepairPhotosField';
import { LocalPhoto } from '@/api/attachment.api';

const labels: Record<WorkKind, string> = { repair: 'Sửa chữa', maintenance: 'Bảo trì', installation: 'Lắp đặt' };
const defaultChecklist = ['Kiểm tra tình trạng thiết bị', 'Thực hiện công việc theo yêu cầu', 'Chạy thử và xác nhận kết quả', 'Bàn giao và hướng dẫn khách hàng'];
const validKinds: WorkKind[] = ['repair', 'maintenance', 'installation'];
const statusName: Record<string, string> = { PENDING: 'Chờ xử lý', ASSIGNED: 'Đã phân công', SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang xử lý', WAITING_PARTS: 'Chờ linh kiện', OVERDUE: 'Quá hạn', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy' };
function availableStatuses(kind: WorkKind, current: string) {
  const repair: Record<string, string[]> = { PENDING: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'], IN_PROGRESS: ['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'], WAITING_PARTS: ['WAITING_PARTS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], COMPLETED: ['COMPLETED'], CANCELLED: ['CANCELLED'] };
  const maintenance: Record<string, string[]> = { SCHEDULED: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], OVERDUE: ['OVERDUE', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'], COMPLETED: ['COMPLETED'], CANCELLED: ['CANCELLED'] };
  return (kind === 'repair' ? repair : maintenance)[current] || [current];
}
type WorkDraft = {
  title: string; description: string; status: string; priority: string; type: string; usingDepartment: string;
  representative: string; representativePosition: string; address: string; contactPhone: string;
  deviceName: string; modelName: string; serialNumber: string;
  warrantyStatus: string; warrantyTerm: string; receivedAccessories: string; preliminaryCause: string;
  conditionAssessment: string; repairMethod: string; repairCostItems: string;
  totalRepairCost: string; repairCostInWords: string; resultNote: string;
  customerFeedback: string; scheduledDate: string; nextDueDate: string; checklist: string;
};
const emptyDraft: WorkDraft = { title: '', description: '', status: 'PENDING', priority: 'NORMAL', type: 'PERIODIC', usingDepartment: '', representative: '', representativePosition: '', address: '', contactPhone: '', deviceName: '', modelName: '', serialNumber: '', warrantyStatus: '', warrantyTerm: '', receivedAccessories: '', preliminaryCause: '', conditionAssessment: '', repairMethod: '', repairCostItems: '', totalRepairCost: '', repairCostInWords: '', resultNote: '', customerFeedback: '', scheduledDate: '', nextDueDate: '', checklist: '' };
function draftFrom(row: EngineerWork): WorkDraft {
  return { ...emptyDraft, title: row.title || '', description: row.description || '', status: row.status || 'PENDING', priority: row.priority || 'NORMAL', type: row.type || 'PERIODIC', usingDepartment: row.usingDepartment || '', representative: row.representative || '', representativePosition: row.representativePosition || '', address: row.address || '', contactPhone: row.contactPhone || '', deviceName: row.deviceName || row.machine?.name || '', modelName: row.modelName || row.machine?.machineModel?.name || '', serialNumber: row.serialNumber || row.machine?.serialNumber || '', warrantyStatus: row.warrantyStatus || '', warrantyTerm: row.warrantyTerm || '', receivedAccessories: row.receivedAccessories || '', preliminaryCause: row.preliminaryCause || '', conditionAssessment: row.conditionAssessment || '', repairMethod: row.repairMethod || '', repairCostItems: row.repairCostItems || '', totalRepairCost: row.totalRepairCost || '', repairCostInWords: row.repairCostInWords || '', resultNote: row.resultNote || '', customerFeedback: row.customerFeedback || '', scheduledDate: (row.scheduledDate || row.reportedAt || '').slice(0, 10), nextDueDate: (row.nextDueDate || '').slice(0, 10), checklist: (row.checklist || []).join('\n') };
}

export default function WorkDetailScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role?.name?.toLocaleLowerCase('vi') === 'admin';
  const kind = validKinds.includes(params.kind as WorkKind) ? params.kind as WorkKind : 'repair';
  const id = params.id;
  const [task, setTask] = useState<EngineerWork | null>(null); const [ops, setOps] = useState<WorkOperations>({});
  const [draft, setDraft] = useState<WorkDraft>(emptyDraft);
  const [repairPhotos, setRepairPhotos] = useState<LocalPhoto[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const checklist = useMemo(() => ops.checklistItems?.length ? ops.checklistItems : defaultChecklist.map((label) => ({ label, status: 'PENDING' as const })), [ops.checklistItems]);
  useEffect(() => {
    void (async () => {
      try {
        const [row, operations] = await Promise.all([workApi.get(kind, id), workApi.operations(kind, id)]);
        setTask(row); setDraft(draftFrom(row)); setOps(operations);
        setReviewNote(row.reviewNote || '');
      } catch (cause) { setError(apiErrorMessage(cause)); }
      finally { setLoading(false); }
    })();
  }, [kind, id]);
  function toggleChecklist(label: string) {
    setOps((current) => {
      const rows = current.checklistItems?.length ? current.checklistItems : checklist;
      return { ...current, checklistItems: rows.map((item) => item.label === label ? { ...item, status: item.status === 'DONE' ? 'PENDING' : 'DONE' } : item) };
    });
  }
  async function saveProgress(nextStatus?: string) {
    setSaving(true); setError(''); setSuccess('');
    try {
      const normalizedChecklist = checklist.map((item, index) => ({ label: item.label, status: item.status || 'PENDING', sortOrder: index }));
      await workApi.saveOperations(kind, id, { ...ops, checklistItems: normalizedChecklist });
      const status = nextStatus || draft.status || task?.status || '';
      if (kind !== 'installation') await workApi.update(kind, id, {
        status,
        title: draft.title.trim() || undefined,
        description: draft.description.trim() || undefined,
        ...(kind === 'repair' ? { ...(isAdmin ? { priority: draft.priority } : {}), reportedAt: dateOnlyToIso(draft.scheduledDate), warrantyStatus: draft.warrantyStatus || undefined, warrantyTerm: draft.warrantyTerm.trim() || undefined, representativePosition: draft.representativePosition.trim() || undefined, preliminaryCause: draft.preliminaryCause.trim() || undefined, conditionAssessment: draft.conditionAssessment.trim() || undefined, repairMethod: draft.repairMethod.trim() || undefined, repairCostItems: draft.repairCostItems.trim() || undefined, totalRepairCost: draft.totalRepairCost.trim() || undefined, repairCostInWords: draft.repairCostInWords.trim() || undefined, customerFeedback: draft.customerFeedback.trim() || undefined } : { ...(isAdmin ? { type: draft.type } : {}), scheduledDate: dateOnlyToIso(draft.scheduledDate), checklist: draft.checklist.split('\n').map((line) => line.trim()).filter(Boolean), nextDueDate: dateOnlyToIso(draft.nextDueDate) }),
        usingDepartment: draft.usingDepartment.trim() || undefined,
        representative: draft.representative.trim() || undefined,
        address: draft.address.trim() || undefined,
        contactPhone: draft.contactPhone.trim() || undefined,
        deviceName: draft.deviceName.trim() || undefined,
        modelName: draft.modelName.trim() || undefined,
        serialNumber: draft.serialNumber.trim() || undefined,
        receivedAccessories: draft.receivedAccessories.trim() || undefined,
        resultNote: draft.resultNote.trim() || undefined,
      });
      else if (nextStatus) await workApi.updateStatus(kind, id, { status, resultNote: draft.resultNote.trim() || undefined, nextDueDate: dateOnlyToIso(draft.nextDueDate) });
      setSuccess(nextStatus ? 'Đã lưu trạng thái và thông tin phiếu.' : 'Đã lưu thông tin phiếu và cập nhật hiện trường.');
      const updated = await workApi.get(kind, id); setTask(updated); setDraft(draftFrom(updated));
    } catch (cause) { setError(apiErrorMessage(cause)); }
    finally { setSaving(false); }
  }
  async function reviewTask(status: 'APPROVED' | 'NEEDS_REVISION') {
    if (status === 'NEEDS_REVISION' && !reviewNote.trim()) { setError('Nhập nội dung cần kỹ sư bổ sung.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      if (kind === 'repair') await workApi.reviewRepair(id, status, reviewNote.trim() || undefined);
      else if (kind === 'maintenance') await workApi.reviewMaintenance(id, status, reviewNote.trim() || undefined);
      else await workApi.reviewInstallation(id, status, reviewNote.trim() || undefined);
      const updated = await workApi.get(kind, id);
      setTask(updated); setDraft(draftFrom(updated)); setReviewNote(updated.reviewNote || '');
      setSuccess(status === 'APPROVED' ? 'Đã duyệt phiếu.' : 'Đã gửi yêu cầu bổ sung cho kỹ sư.');
    } catch (cause) { setError(apiErrorMessage(cause)); }
    finally { setSaving(false); }
  }
  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={FieldColors.brand} /></View></SafeAreaView>;
  if (!task) return <SafeAreaView style={styles.safe}><View style={styles.content}><Text onPress={() => router.back()} style={styles.back}>‹  Quay lại</Text><Text style={styles.error}>{error || 'Không tìm thấy công việc.'}</Text></View></SafeAreaView>;
  const canStart = ['PENDING', 'ASSIGNED', 'SCHEDULED'].includes(task.status);
  const canComplete = ['IN_PROGRESS', 'WAITING_PARTS', 'OVERDUE'].includes(task.status);
  const checklistDone = checklist.filter((item) => item.status === 'DONE').length;
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text onPress={() => router.back()} style={styles.back}>‹  Việc của tôi</Text>
    <Text style={styles.eyebrow}>{labels[kind].toLocaleUpperCase('vi')} · {task.code || 'PHIẾU'}</Text><Text style={styles.title}>{task.title || task.machine?.modelName || labels[kind]}</Text>
    <View style={styles.info}><Info label="Trạng thái" value={statusName[draft.status] || draft.status} />{task.reviewStatus && task.reviewStatus !== 'NOT_REQUIRED' ? <Info label="Duyệt hồ sơ" value={({ PENDING: 'Chờ admin duyệt', APPROVED: 'Đã duyệt', NEEDS_REVISION: 'Cần bổ sung' } as Record<string, string>)[task.reviewStatus] || task.reviewStatus} /> : null}<Info label="Khách hàng" value={task.customer?.name || '—'} /><Info label="Thiết bị" value={task.machine?.machineCode || task.machine?.serialNumber || task.machine?.modelName || '—'} /><Info label="Địa chỉ" value={task.customer?.fullAddress || task.customer?.address || '—'} />{task.reviewStatus === 'NEEDS_REVISION' && task.reviewNote ? <Info label="Yêu cầu bổ sung" value={task.reviewNote} /> : null}</View>
    {kind !== 'installation' ? <>
      <FormSection title="Thông tin phiếu"><FormChoiceGroup label="Trạng thái xử lý" value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} options={availableStatuses(kind, draft.status).map((value) => ({ value, label: statusName[value] || value }))} /><FormField label="Nội dung" value={draft.title} onChangeText={(value) => setDraft((current) => ({ ...current, title: value }))} /><FormField label="Mô tả" value={draft.description} onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))} multiline />{kind === 'repair' ? <FormField label="Ngày báo lỗi" value={draft.scheduledDate} onChangeText={(value) => setDraft((current) => ({ ...current, scheduledDate: value }))} /> : null}{kind === 'repair' && isAdmin ? <FormChoiceGroup label="Mức độ ưu tiên" value={draft.priority} onChange={(value) => setDraft((current) => ({ ...current, priority: value }))} options={[{ value: 'LOW', label: 'Thấp' }, { value: 'NORMAL', label: 'Bình thường' }, { value: 'HIGH', label: 'Cao' }, { value: 'URGENT', label: 'Khẩn' }]} /> : kind === 'maintenance' && isAdmin ? <FormChoiceGroup label="Loại bảo trì" value={draft.type} onChange={(value) => setDraft((current) => ({ ...current, type: value }))} options={[{ value: 'PERIODIC', label: 'Định kỳ' }, { value: 'WARRANTY', label: 'Bảo hành' }, { value: 'CONTRACT', label: 'Hợp đồng' }, { value: 'INTERNAL', label: 'Nội bộ' }, { value: 'OTHER', label: 'Khác' }]} /> : null}</FormSection>
      <FormSection title="Liên hệ & thiết bị"><FormField label="Khoa / phòng" value={draft.usingDepartment} onChangeText={(value) => setDraft((current) => ({ ...current, usingDepartment: value }))} /><FormField label="Người liên hệ" value={draft.representative} onChangeText={(value) => setDraft((current) => ({ ...current, representative: value }))} /><FormField label="Chức vụ" value={draft.representativePosition} onChangeText={(value) => setDraft((current) => ({ ...current, representativePosition: value }))} /><FormField label="Điện thoại" value={draft.contactPhone} onChangeText={(value) => setDraft((current) => ({ ...current, contactPhone: value }))} keyboardType="phone-pad" /><FormField label="Địa chỉ" value={draft.address} onChangeText={(value) => setDraft((current) => ({ ...current, address: value }))} /><FormField label="Tên thiết bị" value={draft.deviceName} onChangeText={(value) => setDraft((current) => ({ ...current, deviceName: value }))} /><FormField label="Model" value={draft.modelName} onChangeText={(value) => setDraft((current) => ({ ...current, modelName: value }))} /><FormField label="Serial (S/N)" value={draft.serialNumber} onChangeText={(value) => setDraft((current) => ({ ...current, serialNumber: value.toLocaleUpperCase() }))} autoCapitalize="characters" /></FormSection>
      {kind === 'repair' ? <><FormSection title="Tiếp nhận & sửa chữa"><FormChoiceGroup label="Tình trạng bảo hành" value={draft.warrantyStatus || 'IN_WARRANTY'} onChange={(value) => setDraft((current) => ({ ...current, warrantyStatus: value }))} options={[{ value: 'IN_WARRANTY', label: 'Còn bảo hành' }, { value: 'OUT_OF_WARRANTY', label: 'Hết bảo hành' }]} /><FormField label="Thời hạn bảo hành" value={draft.warrantyTerm} onChangeText={(value) => setDraft((current) => ({ ...current, warrantyTerm: value }))} /><FormField label="Phụ kiện nhận kèm" value={draft.receivedAccessories} onChangeText={(value) => setDraft((current) => ({ ...current, receivedAccessories: value }))} multiline /><FormField label="Tình trạng thiết bị" value={draft.conditionAssessment} onChangeText={(value) => setDraft((current) => ({ ...current, conditionAssessment: value }))} multiline /><FormField label="Nguyên nhân sơ bộ" value={draft.preliminaryCause} onChangeText={(value) => setDraft((current) => ({ ...current, preliminaryCause: value }))} multiline /><FormField label="Phương án sửa chữa" value={draft.repairMethod} onChangeText={(value) => setDraft((current) => ({ ...current, repairMethod: value }))} multiline /><FormField label="Chi tiết chi phí" value={draft.repairCostItems} onChangeText={(value) => setDraft((current) => ({ ...current, repairCostItems: value }))} multiline /><FormField label="Tổng chi phí" value={draft.totalRepairCost} onChangeText={(value) => setDraft((current) => ({ ...current, totalRepairCost: value }))} keyboardType="decimal-pad" /><FormField label="Chi phí bằng chữ" value={draft.repairCostInWords} onChangeText={(value) => setDraft((current) => ({ ...current, repairCostInWords: value }))} /><FormField label="Phản hồi khách hàng" value={draft.customerFeedback} onChangeText={(value) => setDraft((current) => ({ ...current, customerFeedback: value }))} multiline /></FormSection><RepairPhotosField entityId={task.id} photos={repairPhotos} onChange={setRepairPhotos} /></> : <><FormSection title="Bảo trì"><FormField label="Ngày bảo trì" value={draft.scheduledDate} onChangeText={(value) => setDraft((current) => ({ ...current, scheduledDate: value }))} placeholder="YYYY-MM-DD" /><FormField label="Lịch bảo trì tiếp theo" value={draft.nextDueDate} onChangeText={(value) => setDraft((current) => ({ ...current, nextDueDate: value }))} /><FormField label="Checklist bảo trì" value={draft.checklist} onChangeText={(value) => setDraft((current) => ({ ...current, checklist: value }))} multiline /><FormField label="Phụ kiện nhận kèm" value={draft.receivedAccessories} onChangeText={(value) => setDraft((current) => ({ ...current, receivedAccessories: value }))} multiline /></FormSection><RepairPhotosField entityId={task.id} entityType="Maintenance" photos={repairPhotos} onChange={setRepairPhotos} /></>}
      <FormSection title="Kết quả"><FormField label="Kết quả xử lý" value={draft.resultNote} onChangeText={(value) => setDraft((current) => ({ ...current, resultNote: value }))} multiline /></FormSection>
    </> : null}
    {kind === 'installation' ? <><Link href={{ pathname: '/installation-form', params: { id } }} asChild><Pressable style={styles.secondary}><Text style={styles.secondaryText}>Mở phiếu lắp đặt để cập nhật</Text></Pressable></Link><RepairPhotosField entityId={task.id} entityType="MachineInstallation" photos={repairPhotos} onChange={setRepairPhotos} /></> : null}
    <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Checklist hiện trường</Text><Text style={styles.sectionCaption}>{checklistDone}/{checklist.length} mục hoàn thành</Text></View></View>
    <View style={styles.panel}>{checklist.map((item) => <Pressable key={item.label} onPress={() => toggleChecklist(item.label)} style={styles.checkRow}><View style={[styles.checkbox, item.status === 'DONE' && styles.checkboxDone]}>{item.status === 'DONE' ? <Text style={styles.checkmark}>✓</Text> : null}</View><Text style={styles.checkLabel}>{item.label}</Text></Pressable>)}</View>
    <Text style={styles.label}>Nhật ký xử lý</Text><TextInput value={ops.workLogs?.[0]?.note || ''} onChangeText={(value) => setOps((current) => ({ ...current, workLogs: [{ title: 'Cập nhật hiện trường', note: value }] }))} placeholder="Mô tả các bước đã thực hiện..." multiline textAlignVertical="top" style={[styles.input, styles.multi]} />
    <Text style={styles.label}>Vật tư đã sử dụng</Text><TextInput value={(ops.usedParts || []).map((item) => item.name).join('\n')} onChangeText={(value) => setOps((current) => ({ ...current, usedParts: value.split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name, quantity: 1 })) }))} placeholder="Mỗi dòng một vật tư" multiline textAlignVertical="top" style={[styles.input, styles.multiSmall]} />
    {isAdmin && task.reviewStatus === 'PENDING' ? <FormSection title="Admin duyệt phiếu"><FormField label="Ghi chú cho kỹ sư" value={reviewNote} onChangeText={setReviewNote} multiline /><Pressable disabled={saving} onPress={() => void reviewTask('APPROVED')} style={[styles.action, styles.complete, saving && styles.disabled]}><Text style={styles.actionText}>Duyệt phiếu</Text></Pressable><Pressable disabled={saving} onPress={() => void reviewTask('NEEDS_REVISION')} style={[styles.action, styles.needsRevision, saving && styles.disabled]}><Text style={styles.actionText}>Yêu cầu bổ sung</Text></Pressable></FormSection> : null}
    {!!error && <Text style={styles.error}>{error}</Text>}{!!success && <Text style={styles.success}>{success}</Text>}
    <Pressable disabled={saving} onPress={() => void saveProgress()} style={[styles.saveSecondary, saving && styles.disabled]}>{saving ? <ActivityIndicator color={FieldColors.brand} /> : <Text style={styles.saveSecondaryText}>Lưu cập nhật hiện trường</Text>}</Pressable>
    {kind !== 'installation' && canStart ? <Pressable disabled={saving} onPress={() => void saveProgress('IN_PROGRESS')} style={[styles.action, saving && styles.disabled]}><Text style={styles.actionText}>Bắt đầu xử lý</Text></Pressable> : null}
    {kind !== 'installation' && canComplete ? <Pressable disabled={saving} onPress={() => void saveProgress('COMPLETED')} style={[styles.action, styles.complete, saving && styles.disabled]}><Text style={styles.actionText}>Hoàn tất công việc</Text></Pressable> : null}
  </ScrollView></SafeAreaView>;
}
function Info({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
const styles = StyleSheet.create({ safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 13, padding: 16, paddingBottom: 35 }, center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, back: { color: FieldColors.brand, fontSize: 14, fontWeight: '700', marginBottom: 8 }, eyebrow: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: FieldColors.ink, fontSize: 24, fontWeight: '800', lineHeight: 30 }, info: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 }, infoRow: { borderBottomColor: FieldColors.line, borderBottomWidth: 1, gap: 5, paddingVertical: 11 }, infoLabel: { color: FieldColors.muted, fontSize: 10, fontWeight: '700' }, infoValue: { color: FieldColors.ink, fontSize: 13, lineHeight: 18 }, sectionHead: { marginTop: 4 }, sectionTitle: { color: FieldColors.ink, fontSize: 16, fontWeight: '800' }, sectionCaption: { color: FieldColors.muted, fontSize: 10, marginTop: 3 }, panel: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13 }, checkRow: { alignItems: 'center', borderBottomColor: FieldColors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 10, minHeight: 48 }, checkbox: { alignItems: 'center', borderColor: '#BCC9C6', borderRadius: 6, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 }, checkboxDone: { backgroundColor: FieldColors.brand, borderColor: FieldColors.brand }, checkmark: { color: '#fff', fontSize: 12, fontWeight: '900' }, checkLabel: { color: FieldColors.ink, flex: 1, fontSize: 12 }, label: { color: FieldColors.ink, fontSize: 12, fontWeight: '800', marginBottom: -6, marginTop: 4 }, input: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, color: FieldColors.ink, fontSize: 14, minHeight: 48, paddingHorizontal: 13 }, multi: { minHeight: 88, paddingTop: 12 }, multiSmall: { minHeight: 64, paddingTop: 12 }, secondary: { alignItems: 'center', backgroundColor: FieldColors.blueSoft, borderRadius: 13, padding: 13 }, secondaryText: { color: FieldColors.blue, fontSize: 12, fontWeight: '800' }, saveSecondary: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.brand, borderRadius: 13, borderWidth: 1, justifyContent: 'center', marginTop: 3, minHeight: 48 }, saveSecondaryText: { color: FieldColors.brand, fontSize: 12, fontWeight: '800' }, action: { alignItems: 'center', backgroundColor: FieldColors.brandDark, borderRadius: 14, justifyContent: 'center', minHeight: 51 }, complete: { backgroundColor: FieldColors.green }, needsRevision: { backgroundColor: FieldColors.red }, actionText: { color: '#fff', fontSize: 13, fontWeight: '800' }, disabled: { opacity: 0.55 }, error: { color: FieldColors.red, fontSize: 12 }, success: { color: FieldColors.green, fontSize: 12, fontWeight: '700' } });
