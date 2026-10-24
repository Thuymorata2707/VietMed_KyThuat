import { Text, TextInput } from '@/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { customerApi, Customer } from '@/api/customer.api';
import { deviceApi, Machine, MachineModel } from '@/api/device.api';
import { WorkKind, workApi } from '@/api/work.api';
import { FieldColors } from '@/constants/field-theme';
import { dateOnlyToIso } from '@/utils/date';
import { FormChoiceGroup, FormField, FormSection, FormSelect } from '@/components/form-controls';
import { useAuth } from '@/contexts/auth-context';
import { MachineAccessoryEditor } from '@/components/MachineAccessoryEditor';
import { RepairPhotosField } from '@/components/RepairPhotosField';
import { LocalPhoto, attachmentApi } from '@/api/attachment.api';
import { EngineerOption, userApi } from '@/api/user.api';

type WorkFormKind = Extract<WorkKind, 'repair' | 'maintenance'>;
const kindLabels: Record<WorkFormKind, string> = { repair: 'Sửa chữa', maintenance: 'Bảo trì' };
const dateNow = new Date().toISOString().slice(0, 10);

export default function WorkCreateScreen() {
  const { user } = useAuth();
  const { kind: initialKind } = useLocalSearchParams<{ kind?: string }>();
  const kind: WorkFormKind = initialKind === 'maintenance' ? 'maintenance' : 'repair';
  const [customers, setCustomers] = useState<Customer[]>([]); const [machines, setMachines] = useState<Machine[]>([]); const [models, setModels] = useState<MachineModel[]>([]);
  const isAdmin = /admin|quản trị/i.test(user?.role?.name || '');
  const [engineers, setEngineers] = useState<EngineerOption[]>([]); const [assignedEngineerIds, setAssignedEngineerIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState(''); const [machineIds, setMachineIds] = useState<string[]>([]); const [modelId, setModelId] = useState(''); const [pickerQuery, setPickerQuery] = useState('');
  const [title, setTitle] = useState(kind === 'repair' ? 'Phiếu sửa chữa' : 'Phiếu bảo trì'); const [description, setDescription] = useState('');
  const [workDate, setWorkDate] = useState(dateNow); const [repairPriority, setRepairPriority] = useState('NORMAL');
  const [maintenanceType, setMaintenanceType] = useState('PERIODIC'); const [nextDueDate, setNextDueDate] = useState(''); const [checklist, setChecklist] = useState('');
  const [usingDepartment, setUsingDepartment] = useState(''); const [representative, setRepresentative] = useState(''); const [representativePosition, setRepresentativePosition] = useState(''); const [address, setAddress] = useState(''); const [contactPhone, setContactPhone] = useState('');
  const [warrantyStatus, setWarrantyStatus] = useState('IN_WARRANTY'); const [warrantyTerm, setWarrantyTerm] = useState(''); const [receivedAccessories, setReceivedAccessories] = useState('');
  const [preliminaryCause, setPreliminaryCause] = useState(''); const [conditionAssessment, setConditionAssessment] = useState(''); const [repairMethod, setRepairMethod] = useState(''); const [resultNote, setResultNote] = useState(''); const [customerFeedback, setCustomerFeedback] = useState('');
  const [repairCostItems, setRepairCostItems] = useState(''); const [totalRepairCost, setTotalRepairCost] = useState(''); const [repairCostInWords, setRepairCostInWords] = useState('');
  const [repairPhotos, setRepairPhotos] = useState<LocalPhoto[]>([]); const [savedRepairId, setSavedRepairId] = useState('');
  const [picker, setPicker] = useState<'customer' | 'machine' | 'model' | 'engineer' | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const selectedCustomer = customers.find((item) => item.id === customerId); const selectedMachines = machineIds.map((id) => machines.find((item) => item.id === id)).filter((item): item is Machine => Boolean(item)); const selectedMachine = selectedMachines[0]; const selectedModel = models.find((item) => item.id === modelId) || selectedMachine?.machineModel;
  const visibleMachines = machines.filter((item) => (!customerId || item.customerId === customerId) && `${item.machineCode || ''} ${item.serialNumber || ''} ${item.name || ''} ${item.machineModel?.name || item.modelName || ''}`.toLocaleLowerCase('vi').includes(pickerQuery.trim().toLocaleLowerCase('vi')));
  const visibleModels = models.filter((item) => `${item.code || ''} ${item.name} ${item.displayName || ''} ${item.manufacturer || ''}`.toLocaleLowerCase('vi').includes(pickerQuery.trim().toLocaleLowerCase('vi')));
  const visibleCustomers = customers.filter((item) => `${item.name} ${item.phone || ''} ${item.address || ''}`.toLocaleLowerCase('vi').includes(pickerQuery.trim().toLocaleLowerCase('vi')));
  function openPicker(target: 'customer' | 'machine' | 'model' | 'engineer') { setPickerQuery(''); setPicker(target); }
  useEffect(() => { void Promise.all([customerApi.list(), deviceApi.machines('INSTALLED'), deviceApi.models()]).then(([customerRows, machineRows, modelRows]) => { setCustomers(customerRows); setMachines(machineRows); setModels(modelRows); }).catch((cause) => setError(apiErrorMessage(cause))).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (isAdmin) void userApi.engineers().then(setEngineers).catch((cause) => setError(apiErrorMessage(cause))); }, [isAdmin]);
  function applyCustomer(customer: Customer | undefined) {
    if (!customer) return;
    const contact = customer.contacts?.find((item) => item.isPrimary) || customer.contacts?.[0];
    if (selectedMachines.some((item) => item.customerId !== customer.id)) { setMachineIds([]); setModelId(''); }
    setCustomerId(customer.id);
    setUsingDepartment(customer.name || '');
    setRepresentative(contact?.name || customer.contactPerson || '');
    setRepresentativePosition(contact?.position || customer.contactPosition || '');
    setContactPhone(contact?.phone || customer.contactPhone || customer.phone || '');
    setAddress(customer.fullAddress || customer.address || '');
  }
  async function save() {
    if (!title.trim()) { setError('Vui lòng nhập nội dung yêu cầu.'); return; }
    if (!customerId) { setError('Vui lòng chọn khách hàng.'); return; }
    if (!machineIds.length || !description.trim()) { setError('Phiếu sửa chữa/bảo trì cần có ít nhất một máy và mô tả công việc.'); return; }
    if (isAdmin && !assignedEngineerIds.length) { setError('Chọn ít nhất một kỹ sư nhận phiếu.'); return; }
    const workDateIso = dateOnlyToIso(workDate);
    if (!workDateIso) { setError('Ngày cần theo định dạng YYYY-MM-DD hợp lệ.'); return; }
    const nextDueDateIso = nextDueDate ? dateOnlyToIso(nextDueDate) : undefined;
    if (nextDueDate && !nextDueDateIso) { setError('Ngày bảo trì tiếp theo không hợp lệ.'); return; }
    if (kind === 'repair' && !isAdmin && (!repairMethod.trim() || !resultNote.trim())) { setError('Phiếu sửa chữa cần có phương án và kết quả xử lý.'); return; }
    if (kind === 'maintenance' && (!checklist.split('\n').some((item) => item.trim()) || (!isAdmin && !resultNote.trim()))) { setError('Vui lòng nhập hạng mục kiểm tra và kết quả bảo trì trước khi gửi admin duyệt.'); return; }
    setSaving(true); setError('');
    let createdCount = 0;
    try {
      for (const machine of selectedMachines) {
        const machineModel = models.find((item) => item.id === (machine.machineModel?.id || machine.machineModelId)) || machine.machineModel || selectedModel;
        const machineFields = { machineId: machine.id, customerId, deviceName: machine.name || machineModel?.displayName || machineModel?.name, modelName: machineModel?.name || machine.modelName, serialNumber: machine.serialNumber };
        const accessories = machine.accessories?.length ? JSON.stringify(machine.accessories.map((item) => ({ componentAccessoryId: item.componentAccessory?.id, code: item.code || item.name, name: item.name || item.code || '', serialNumber: item.serialNumber || '', quantity: item.quantity || 1, description: item.note || item.description || '' }))) : receivedAccessories.trim() || undefined;
        const engineerIds = isAdmin ? assignedEngineerIds : (user?.id ? [user.id] : []);
        const shared = { ...machineFields, title: title.trim(), description: description.trim() || undefined, customerId, engineerId: engineerIds[0], engineerIds, usingDepartment: usingDepartment.trim() || undefined, representative: representative.trim() || undefined, address: address.trim() || undefined, contactPhone: contactPhone.trim() || undefined };
        if (kind === 'repair') {
          const created = await workApi.createRepair({ ...shared, priority: repairPriority, reportedAt: workDateIso, representativePosition: representativePosition.trim() || undefined, warrantyStatus, warrantyTerm: warrantyTerm.trim() || undefined, receivedAccessories: accessories, preliminaryCause: preliminaryCause.trim() || undefined, conditionAssessment: conditionAssessment.trim() || undefined, repairMethod: repairMethod.trim() || undefined, resultNote: resultNote.trim() || undefined, customerFeedback: customerFeedback.trim() || undefined, repairCostItems: repairCostItems.trim() || undefined, totalRepairCost: totalRepairCost.trim() || undefined, repairCostInWords: repairCostInWords.trim() || undefined }) as { id?: string };
          createdCount += 1;
          if (repairPhotos.length && created.id) {
            setSavedRepairId(created.id);
            let uploadedPhotos = 0;
            try { for (const photo of repairPhotos) { await attachmentApi.upload(created.id, photo); uploadedPhotos += 1; } setRepairPhotos([]); router.replace('/tasks'); return; }
            catch (cause) { setRepairPhotos((current) => current.slice(uploadedPhotos)); setError(`Phiếu đã được tạo${isAdmin ? ' và giao kỹ sư' : ', đang chờ admin duyệt'}, nhưng ảnh chưa tải hết. Bạn có thể xóa ảnh sai hoặc thử tải lại. ${apiErrorMessage(cause)}`); return; }
          }
        }
        else {
          const created = await workApi.createMaintenance({ ...shared, type: maintenanceType, scheduledDate: workDateIso, nextDueDate: nextDueDateIso, checklist: checklist.split('\n').map((item) => item.trim()).filter(Boolean), receivedAccessories: accessories, resultNote: resultNote.trim() }) as { id?: string };
          if (repairPhotos.length && created.id) {
            setSavedRepairId(created.id);
            let uploadedPhotos = 0;
            try { for (const photo of repairPhotos) { await attachmentApi.upload(created.id, photo, 'Maintenance'); uploadedPhotos += 1; } setRepairPhotos([]); router.replace('/tasks'); return; }
            catch (cause) { setRepairPhotos((current) => current.slice(uploadedPhotos)); setError(`Phiếu đã được tạo${isAdmin ? ' và giao kỹ sư' : ', đang chờ admin duyệt'}, nhưng ảnh chưa tải hết. ${apiErrorMessage(cause)}`); return; }
          }
        }
        if (kind !== 'repair') createdCount += 1;
      }
      router.replace('/tasks');
    } catch (cause) { setError(createdCount ? `Đã tạo ${createdCount}/${selectedMachines.length} phiếu trước khi gặp lỗi. Kiểm tra danh sách phiếu trước khi thử lại. ${apiErrorMessage(cause)}` : apiErrorMessage(cause)); }
    finally { setSaving(false); }
  }
  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={FieldColors.brand} /></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text onPress={() => router.back()} style={styles.back}>‹  Phiếu</Text><Text style={styles.eyebrow}>PHIẾU {kindLabels[kind].toLocaleUpperCase('vi')}</Text><Text style={styles.title}>Tạo phiếu {kindLabels[kind].toLocaleLowerCase('vi')}</Text>
    {savedRepairId ? <><View style={styles.createdNotice}><Text style={styles.createdTitle}>Phiếu đã được tạo</Text><Text style={styles.createdBody}>{isAdmin ? 'Phiếu đã giao kỹ sư.' : 'Phiếu đang chờ admin duyệt.'}</Text></View><RepairPhotosField entityId={savedRepairId} entityType={kind === 'maintenance' ? 'Maintenance' : 'Repair'} photos={repairPhotos} onChange={setRepairPhotos} /><Pressable onPress={() => router.replace('/tasks')} style={styles.save}><Text style={styles.saveText}>Quay lại công việc</Text></Pressable></> : <>
      {isAdmin ? <FormSection title="Phân công"><FormSelect label="Kỹ sư nhận việc" value={assignedEngineerIds.map((id) => engineers.find((item) => item.id === id)?.fullName || engineers.find((item) => item.id === id)?.email).filter(Boolean).join(', ') || undefined} placeholder="Chọn kỹ sư *" onPress={() => openPicker('engineer')} required /></FormSection> : null}
      <FormSection title="Khách hàng và thiết bị">
        <Picker title={selectedCustomer?.name || 'Chọn khách hàng *'} onPress={() => openPicker('customer')} />
        <Picker title={selectedMachines.length ? `${selectedMachines.length} máy đã chọn` : kind === 'repair' ? 'Chọn thiết bị *' : 'Chọn một hoặc nhiều máy *'} onPress={() => openPicker('machine')} />
        <FormSelect label="Model" value={selectedModel?.displayName || selectedModel?.name || selectedModel?.code} placeholder="Chọn model" onPress={() => openPicker('model')} />
        <MachineAccessoryEditor model={selectedModel} value={receivedAccessories} onChange={setReceivedAccessories} title="Phụ kiện theo model" />
        <FormField label="Tiêu đề công việc" value={title} onChangeText={setTitle} placeholder={kind === 'repair' ? 'Phiếu sửa chữa' : 'Phiếu bảo trì'} required />
        <FormField label="Mô tả chi tiết" value={description} onChangeText={setDescription} placeholder="Triệu chứng, yêu cầu hoặc thông tin hiện trường..." multiline />
        <FormField label={kind === 'repair' ? 'Ngày báo lỗi' : 'Ngày dự kiến'} value={workDate} onChangeText={setWorkDate} placeholder="YYYY-MM-DD" />
        {kind === 'repair' ? <FormChoiceGroup label="Mức độ ưu tiên" value={repairPriority} onChange={setRepairPriority} options={[{ value: 'LOW', label: 'Thấp' }, { value: 'NORMAL', label: 'Bình thường' }, { value: 'HIGH', label: 'Cao' }, { value: 'URGENT', label: 'Khẩn' }]} /> : <FormChoiceGroup label="Loại bảo trì" value={maintenanceType} onChange={setMaintenanceType} options={[{ value: 'PERIODIC', label: 'Định kỳ' }, { value: 'WARRANTY', label: 'Bảo hành' }, { value: 'CONTRACT', label: 'Hợp đồng' }, { value: 'INTERNAL', label: 'Nội bộ' }, { value: 'OTHER', label: 'Khác' }]} />}
      </FormSection>
      <FormSection title="Liên hệ tại cơ sở">
        <FormField label="Khoa / phòng sử dụng" value={usingDepartment} onChangeText={setUsingDepartment} placeholder="Khoa hoặc phòng ban" />
        <FormField label="Người liên hệ" value={representative} onChangeText={setRepresentative} placeholder="Họ tên" />
        {kind === 'repair' ? <FormField label="Chức vụ" value={representativePosition} onChangeText={setRepresentativePosition} placeholder="Chức vụ người liên hệ" /> : null}
        <FormField label="Điện thoại" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" placeholder="Số điện thoại" />
        <FormField label="Địa chỉ làm việc" value={address} onChangeText={setAddress} placeholder="Địa chỉ cơ sở" />
      </FormSection>
      {kind === 'repair' ? <FormSection title="Tiếp nhận và sửa chữa">
        <FormChoiceGroup label="Bảo hành" value={warrantyStatus} onChange={setWarrantyStatus} options={[{ value: 'IN_WARRANTY', label: 'Còn bảo hành' }, { value: 'OUT_OF_WARRANTY', label: 'Hết bảo hành' }]} />
        <FormField label="Thời hạn bảo hành" value={warrantyTerm} onChangeText={setWarrantyTerm} placeholder="Ví dụ: 12 tháng" />
        <FormField label="Tình trạng khi tiếp nhận" value={conditionAssessment} onChangeText={setConditionAssessment} placeholder="Mô tả tình trạng thiết bị" multiline />
        <FormField label="Nguyên nhân sơ bộ" value={preliminaryCause} onChangeText={setPreliminaryCause} placeholder="Nguyên nhân dự kiến" multiline />
        <FormField label="Phương pháp sửa chữa" value={repairMethod} onChangeText={setRepairMethod} multiline required={!isAdmin} />
        <FormField label="Kết quả xử lý" value={resultNote} onChangeText={setResultNote} multiline required={!isAdmin} />
        <FormField label="Phản hồi khách hàng" value={customerFeedback} onChangeText={setCustomerFeedback} placeholder="Ý kiến khi bàn giao" multiline />
        <FormField label="Chi tiết chi phí" value={repairCostItems} onChangeText={setRepairCostItems} placeholder="Hạng mục và chi phí" multiline />
        <FormField label="Tổng chi phí" value={totalRepairCost} onChangeText={setTotalRepairCost} keyboardType="decimal-pad" placeholder="0" />
        <FormField label="Chi phí bằng chữ" value={repairCostInWords} onChangeText={setRepairCostInWords} placeholder="Số tiền bằng chữ" />
        <RepairPhotosField photos={repairPhotos} onChange={setRepairPhotos} />
      </FormSection> : <FormSection title="Checklist bảo trì">
        <FormField label="Ngày bảo trì tiếp theo" value={nextDueDate} onChangeText={setNextDueDate} placeholder="YYYY-MM-DD" />
        <FormField label="Hạng mục kiểm tra" value={checklist} onChangeText={setChecklist} placeholder="Mỗi dòng một hạng mục" multiline required />
        <FormField label="Kết quả bảo trì" value={resultNote} onChangeText={setResultNote} placeholder="Tình trạng, kiểm tra và kết quả" multiline required />
        <RepairPhotosField photos={repairPhotos} onChange={setRepairPhotos} />
      </FormSection>}
      {!!error && <Text style={styles.error}>{error}</Text>}<Pressable disabled={saving} onPress={() => void save()} style={styles.save}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{kind === 'repair' ? isAdmin ? 'Tạo và giao phiếu' : 'Tạo phiếu & gửi admin duyệt' : selectedMachines.length > 1 ? `Tạo ${selectedMachines.length} phiếu ${kindLabels[kind].toLocaleLowerCase('vi')}` : `Tạo phiếu ${kindLabels[kind].toLocaleLowerCase('vi')}`}</Text>}</Pressable>
    </>}
  </ScrollView>
    <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}><View style={styles.backdrop}><View style={styles.modal}><View style={styles.modalHead}><Text style={styles.modalTitle}>{picker === 'customer' ? 'Chọn khách hàng' : picker === 'model' ? 'Chọn model thiết bị' : picker === 'engineer' ? 'Chọn kỹ sư nhận việc' : `Chọn máy (${machineIds.length})`}</Text><Text onPress={() => setPicker(null)} style={styles.close}>{picker === 'machine' || picker === 'engineer' ? 'Xong' : 'Đóng'}</Text></View><TextInput value={pickerQuery} onChangeText={setPickerQuery} placeholder={picker === 'customer' ? 'Tìm khách hàng' : picker === 'model' ? 'Tìm tên, mã model hoặc hãng' : picker === 'engineer' ? 'Tìm kỹ sư' : 'Tìm mã máy, model hoặc serial'} placeholderTextColor={FieldColors.muted} style={styles.search} /><ScrollView keyboardShouldPersistTaps="handled">
      {picker === 'customer' ? visibleCustomers.map((item) => <Pressable key={item.id} onPress={() => { applyCustomer(item); setPicker(null); }} style={styles.option}><Text style={styles.optionText}>{item.name}</Text><Text style={styles.optionMeta}>{item.phone || item.address || ''}</Text></Pressable>) : null}
      {picker === 'machine' ? visibleMachines.map((item) => <Pressable key={item.id} onPress={() => { const isSelected = machineIds.includes(item.id); if (kind === 'repair') { setMachineIds([item.id]); if (item.customerId) applyCustomer(customers.find((customer) => customer.id === item.customerId)); setModelId(item.machineModel?.id || item.machineModelId || ''); setPicker(null); return; } if (isSelected) { const next = machineIds.filter((id) => id !== item.id); setMachineIds(next); if (!next.length) setModelId(''); } else { if (!machineIds.length) { if (item.customerId) applyCustomer(customers.find((customer) => customer.id === item.customerId)); setModelId(item.machineModel?.id || item.machineModelId || ''); } setMachineIds([...machineIds, item.id]); } }} style={styles.option}><Text style={styles.optionText}>{machineIds.includes(item.id) ? '✓  ' : ''}{item.machineCode || item.name || 'Máy'}</Text><Text style={styles.optionMeta}>{item.machineModel?.name || item.modelName || 'Chưa rõ model'} · {item.serialNumber || 'Chưa có serial'}</Text></Pressable>) : null}
      {picker === 'model' ? visibleModels.map((item) => <Pressable key={item.id} onPress={() => { setModelId(item.id); setPicker(null); }} style={styles.option}><Text style={styles.optionText}>{item.code ? `${item.code} · ` : ''}{item.displayName || item.name}</Text><Text style={styles.optionMeta}>{[item.manufacturer, item.countryOfOrigin, item.productCategory].filter(Boolean).join(' · ')}</Text></Pressable>) : null}
      {picker === 'engineer' ? engineers.filter((item) => `${item.fullName || ''} ${item.email}`.toLocaleLowerCase('vi').includes(pickerQuery.trim().toLocaleLowerCase('vi'))).map((item) => <Pressable key={item.id} onPress={() => setAssignedEngineerIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} style={styles.option}><Text style={styles.optionText}>{assignedEngineerIds.includes(item.id) ? '✓  ' : ''}{item.fullName || item.email}</Text><Text style={styles.optionMeta}>{item.email}</Text></Pressable>) : null}
      {picker === 'machine' && visibleMachines.length === 0 ? <Text style={styles.noResults}>{customerId ? 'Khách hàng này chưa có máy đã lắp đặt.' : 'Không tìm thấy máy phù hợp.'}</Text> : null}
      {picker === 'model' && visibleModels.length === 0 ? <Text style={styles.noResults}>Không tìm thấy model phù hợp.</Text> : null}
    </ScrollView></View></View></Modal>
  </SafeAreaView>;
}
function Picker({ title, onPress }: { title: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.picker}><Text style={styles.pickerText}>{title}</Text><Text style={styles.chevron}>⌄</Text></Pressable>; }
const styles = StyleSheet.create({ safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 11, padding: 16, paddingBottom: 32 }, center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, back: { color: FieldColors.brand, fontSize: 13, fontWeight: '700', marginBottom: 5 }, eyebrow: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 }, title: { color: FieldColors.ink, fontSize: 29, fontWeight: '800' }, createdNotice: { backgroundColor: FieldColors.greenSoft, borderRadius: 14, gap: 4, padding: 14 }, createdTitle: { color: FieldColors.green, fontSize: 15, fontWeight: '800' }, createdBody: { color: FieldColors.ink, fontSize: 12 }, priority: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 10, borderWidth: 1, color: FieldColors.muted, fontSize: 10, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 8 }, priorityActive: { backgroundColor: FieldColors.amberSoft, borderColor: FieldColors.amber, color: '#805312' }, picker: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 47, paddingHorizontal: 12 }, pickerText: { color: FieldColors.ink, flex: 1, fontSize: 12 }, chevron: { color: FieldColors.muted, fontSize: 18 }, search: { backgroundColor: FieldColors.canvas, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, color: FieldColors.ink, fontSize: 14, marginBottom: 8, minHeight: 46, paddingHorizontal: 13 }, input: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, color: FieldColors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }, multi: { minHeight: 84, paddingTop: 11 }, save: { alignItems: 'center', backgroundColor: FieldColors.brandDark, borderRadius: 13, justifyContent: 'center', marginTop: 10, minHeight: 50 }, saveText: { color: '#fff', fontSize: 14, fontWeight: '800' }, error: { color: FieldColors.red, fontSize: 12 }, backdrop: { backgroundColor: 'rgba(12,30,34,0.38)', flex: 1, justifyContent: 'flex-end' }, modal: { backgroundColor: FieldColors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%', paddingBottom: 25, paddingHorizontal: 18, paddingTop: 20 }, modalHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }, modalTitle: { color: FieldColors.ink, fontSize: 16, fontWeight: '800' }, close: { color: FieldColors.brand, fontSize: 12, fontWeight: '700', padding: 8 }, option: { borderBottomColor: FieldColors.line, borderBottomWidth: 1, gap: 4, paddingVertical: 13 }, optionText: { color: FieldColors.ink, fontSize: 14, fontWeight: '700' }, optionMeta: { color: FieldColors.muted, fontSize: 10 }, noResults: { color: FieldColors.muted, fontSize: 13, padding: 18, textAlign: 'center' } });
