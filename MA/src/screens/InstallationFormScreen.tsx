import { Text, TextInput } from '@/components/text';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { customerApi, Customer } from '@/api/customer.api';
import { deviceApi, Machine, MachineModel } from '@/api/device.api';
import { apiErrorMessage } from '@/api/client';
import { InstallationPayload, installationApi } from '@/api/installation.api';
import { FieldColors, FieldRadius } from '@/constants/field-theme';
import { FormChoiceGroup, FormField, FormSection, FormSelect } from '@/components/form-controls';
import { dateOnlyToIso, isoToDateOnly } from '@/utils/date';
import { MachineAccessoryEditor } from '@/components/MachineAccessoryEditor';
import { useAuth } from '@/contexts/auth-context';
import { EngineerOption, userApi } from '@/api/user.api';
import { RepairPhotosField } from '@/components/RepairPhotosField';
import { LocalPhoto, attachmentApi } from '@/api/attachment.api';

type SerialRow = { key: string; serial: string };

export default function InstallationFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const isAdmin = /admin|quản trị/i.test(user?.role?.name || '');
  const [engineers, setEngineers] = useState<EngineerOption[]>([]); const [engineerIds, setEngineerIds] = useState<string[]>([]); const [photos, setPhotos] = useState<LocalPhoto[]>([]); const [savedId, setSavedId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]); const [models, setModels] = useState<MachineModel[]>([]); const [machines, setMachines] = useState<Machine[]>([]);
  const [customerId, setCustomerId] = useState(''); const [modelId, setModelId] = useState('');
  const [machineName, setMachineName] = useState(''); const [manufacturer, setManufacturer] = useState('');
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [serials, setSerials] = useState<SerialRow[]>([{ key: '1', serial: '' }]);
  const [installedAt, setInstalledAt] = useState(new Date().toISOString().slice(0, 10));
  const [address, setAddress] = useState(''); const [note, setNote] = useState('');
  const [status, setStatus] = useState('PENDING'); const [representative, setRepresentative] = useState(''); const [receiverPosition, setReceiverPosition] = useState(''); const [receiverPhone, setReceiverPhone] = useState('');
  const [installerName, setInstallerName] = useState(''); const [installerPosition, setInstallerPosition] = useState(''); const [vehicle, setVehicle] = useState(''); const [departureDate, setDepartureDate] = useState('');
  const [warrantyStart, setWarrantyStart] = useState(''); const [warrantyEnd, setWarrantyEnd] = useState(''); const [warrantyNote, setWarrantyNote] = useState(''); const [accessories, setAccessories] = useState('');
  const [deviceCondition, setDeviceCondition] = useState('NEW_100'); const [deviceConditionNote, setDeviceConditionNote] = useState('');
  const [picker, setPicker] = useState<'customer' | 'model' | 'machines' | 'engineer' | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const selectedCustomer = useMemo(() => customers.find((item) => item.id === customerId), [customers, customerId]);
  const selectedModel = useMemo(() => models.find((item) => item.id === modelId), [models, modelId]);
  const selectedMachines = useMemo(() => machines.filter((item) => selectedMachineIds.includes(item.id)), [machines, selectedMachineIds]);

  useEffect(() => {
    void (async () => {
      try {
        const [customerRows, modelRows, machineRows] = await Promise.all([customerApi.list(), deviceApi.models(), deviceApi.machines('IN_STOCK')]);
        setCustomers(customerRows); setModels(modelRows); setMachines(machineRows);
        if (id) {
          const record = await installationApi.get(id);
          setCustomerId(record.customerId || ''); setAddress(record.receiverInstallAddress || ''); setNote(record.note || '');
          setStatus(record.status || 'PENDING'); setRepresentative(record.receiverRepresentative || ''); setReceiverPosition(record.receiverPosition || ''); setReceiverPhone(record.receiverPhone || '');
          setInstallerName(record.handoverInstallerName || ''); setInstallerPosition(record.handoverInstallerPosition || ''); setVehicle(record.handoverVehicle || ''); setDepartureDate(isoToDateOnly(record.handoverDepartureDate));
          setWarrantyStart(isoToDateOnly(record.warrantyStartDate)); setWarrantyEnd(isoToDateOnly(record.warrantyEndDate)); setWarrantyNote(record.warrantyNote || ''); setAccessories((record.accessories || []).join('\n'));
          setDeviceCondition(record.deviceCondition || 'NEW_100'); setDeviceConditionNote(record.deviceConditionNote || '');
          setInstalledAt(record.installedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
          const matching = modelRows.find((item) => item.name === record.machine?.machineModel?.name || item.name === record.installedDeviceItems?.[0]?.model);
          if (matching) setModelId(matching.id);
          setMachineName(record.machine?.name || record.installedDeviceItems?.[0]?.itemName || ''); setManufacturer(record.machine?.manufacturer || record.machine?.machineModel?.manufacturer || '');
          const existingSerials = (record.installedDeviceItems || []).map((item, index) => ({ key: String(index + 1), serial: item.serialNumber || '' })).filter((item) => item.serial);
          if (existingSerials.length) setSerials(existingSerials);
        }
      } catch (cause) { setError(apiErrorMessage(cause)); }
      finally { setLoading(false); }
    })();
  }, [id]);
  useEffect(() => { if (isAdmin) void userApi.engineers().then(setEngineers).catch((cause) => setError(apiErrorMessage(cause))); }, [isAdmin]);

  function setSerial(key: string, serial: string) { setSerials((rows) => rows.map((row) => row.key === key ? { ...row, serial } : row)); }
  function addSerial() { setSerials((rows) => [...rows, { key: `${Date.now()}`, serial: '' }]); }
  function removeSerial(key: string) { setSerials((rows) => rows.length > 1 ? rows.filter((row) => row.key !== key) : rows); }

  async function save() {
    setError('');
    if (!customerId) { setError('Vui lòng chọn khách hàng.'); return; }
    if (isAdmin && !engineerIds.length) { setError('Chọn ít nhất một kỹ sư nhận phiếu.'); return; }
    if (!selectedModel && selectedMachines.length === 0) { setError('Vui lòng chọn model hoặc máy có sẵn trong kho.'); return; }
    const dates = [installedAt, warrantyStart, warrantyEnd, departureDate].filter(Boolean);
    if (!dateOnlyToIso(installedAt) || dates.some((date) => !dateOnlyToIso(date))) { setError('Kiểm tra lại ngày lắp đặt, bảo hành và ngày xuất phát (YYYY-MM-DD).'); return; }
    const validSerials = serials.map((row) => row.serial.trim()).filter(Boolean);
    if (id && status === 'INSTALLED' && validSerials.length === 0 && selectedMachines.length === 0) { setError('Cần có ít nhất một máy và serial trước khi xác nhận lắp đặt.'); return; }
    if (id && status === 'INSTALLED' && (!address.trim() || !representative.trim() || !receiverPhone.trim() || !installerName.trim())) { setError('Để xác nhận lắp đặt, cần có địa chỉ, người nhận, số điện thoại và kỹ sư bàn giao.'); return; }
    if (id && deviceCondition === 'OTHER' && !deviceConditionNote.trim()) { setError('Vui lòng ghi rõ tình trạng thiết bị.'); return; }
    const primaryMachine = selectedMachines[0];
    const modelName = primaryMachine?.machineModel?.name || selectedModel?.name || '';
    const resolvedMachineName = primaryMachine?.name || machineName.trim() || selectedModel?.displayName || modelName;
    const resolvedManufacturer = primaryMachine?.manufacturer || manufacturer.trim() || selectedModel?.manufacturer || '';
    const payload: InstallationPayload = {
      customerId,
      ...(isAdmin ? { engineerIds } : {}),
      machineId: primaryMachine?.id,
      machineName: resolvedMachineName || undefined,
      manufacturer: resolvedManufacturer || undefined,
      machineModelId: primaryMachine?.machineModel?.id || selectedModel?.id,
      plannedModelName: modelName,
      installedAt: dateOnlyToIso(installedAt),
      warrantyStartDate: dateOnlyToIso(warrantyStart),
      warrantyEndDate: dateOnlyToIso(warrantyEnd),
      warrantyNote: warrantyNote.trim() || undefined,
      receiverInstallAddress: address.trim() || undefined,
      receiverRepresentative: representative.trim() || undefined,
      receiverPosition: receiverPosition.trim() || undefined,
      receiverPhone: receiverPhone.trim() || undefined,
      handoverInstallerName: installerName.trim() || undefined,
      handoverInstallerPosition: installerPosition.trim() || undefined,
      handoverVehicle: vehicle.trim() || undefined,
      handoverDepartureDate: dateOnlyToIso(departureDate),
      accessories: accessoryLines(accessories),
      deviceCondition,
      deviceConditionNote: deviceConditionNote.trim() || undefined,
      note: note.trim() || undefined,
      ...(!primaryMachine && validSerials[0] ? { machineSerialNumber: validSerials[0] } : {}),
      installedDeviceItems: [
        ...selectedMachines.slice(1).map((machine) => ({ sourceMachineId: machine.id, isInstalled: true, itemName: machine.name || machine.machineModel?.name || 'Thiết bị', model: machine.machineModel?.name, serialNumber: machine.serialNumber, quantity: 1, accessories: (machine.accessories || []).map((item) => ({ name: item.name || item.code || 'Phụ kiện', serialNumber: item.serialNumber, quantity: item.quantity || 1, note: item.note || item.description })) })),
        ...validSerials.map((serial, index) => ({ itemName: selectedModel?.displayName || modelName, model: modelName, serialNumber: serial, quantity: 1, isPrimary: !primaryMachine && index === 0, accessories: parseAccessoryRows(accessories).map((item) => ({ name: item.name, serialNumber: item.serialNumber, quantity: item.quantity || 1, note: item.description })) })),
      ],
    };
    setSaving(true);
    try {
      let recordId = id;
      if (id) await installationApi.update(id, {
        status,
        installedAt: payload.installedAt,
        warrantyStartDate: payload.warrantyStartDate,
        warrantyEndDate: payload.warrantyEndDate,
        warrantyNote: payload.warrantyNote,
        receiverInstallAddress: payload.receiverInstallAddress,
        receiverRepresentative: payload.receiverRepresentative,
        receiverPosition: payload.receiverPosition,
        receiverPhone: payload.receiverPhone,
        handoverInstallerName: payload.handoverInstallerName,
        handoverInstallerPosition: payload.handoverInstallerPosition,
        handoverVehicle: payload.handoverVehicle,
        handoverDepartureDate: payload.handoverDepartureDate,
        accessories: payload.accessories,
        deviceCondition: payload.deviceCondition,
        deviceConditionNote: payload.deviceConditionNote,
        note: payload.note,
        machineModelId: payload.machineModelId,
        machineId: primaryMachine?.id,
        machineName: resolvedMachineName,
        manufacturer: resolvedManufacturer,
        modelName,
        machineSerialNumber: validSerials[0],
        installedDeviceItems: payload.installedDeviceItems,
      });
      else { const created = await installationApi.create(payload); recordId = created.id; }
      if (photos.length && recordId) {
        setSavedId(recordId);
        let uploaded = 0;
        try { for (const photo of photos) { await attachmentApi.upload(recordId, photo, 'MachineInstallation'); uploaded += 1; } }
        catch (cause) { setPhotos((current) => current.slice(uploaded)); setError(`Phiếu đã lưu, nhưng ảnh chưa tải hết. ${apiErrorMessage(cause)}`); return; }
      }
      router.back();
    } catch (cause) { setError(apiErrorMessage(cause)); }
    finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={FieldColors.brand} /></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Đóng</Text></Pressable><Text style={styles.headerTitle}>{id ? 'Cập nhật lắp đặt' : 'Phiếu lắp đặt'}</Text><View style={{ width: 55 }} /></View>
      <Text style={styles.kicker}>CÔNG VIỆC HIỆN TRƯỜNG</Text>
      <Text style={styles.title}>{id ? 'Cập nhật phiếu' : 'Tạo phiếu lắp đặt'}</Text>

      {isAdmin ? <FormSection title="Phân công"><FormSelect label="Kỹ sư nhận việc" required value={engineerIds.map((engineerId) => engineers.find((item) => item.id === engineerId)?.fullName || engineers.find((item) => item.id === engineerId)?.email).filter(Boolean).join(', ')} placeholder="Chọn kỹ sư *" onPress={() => setPicker('engineer')} /></FormSection> : null}
      <FormSection title="Khách hàng và thiết bị">
        <FormSelect label="Khách hàng" required value={selectedCustomer?.name} placeholder="Chọn khách hàng" disabled={Boolean(id)} onPress={() => setPicker('customer')} />
        <FormSelect label="Model thiết bị" required value={selectedModel?.displayName || selectedModel?.name} placeholder="Chọn model" onPress={() => setPicker('model')} />
        <MachineAccessoryEditor model={selectedModel} value={accessories} onChange={setAccessories} title="Phụ kiện theo model" />
        <FormField label="Tên thiết bị" value={machineName || selectedModel?.displayName || ''} onChangeText={setMachineName} placeholder="Tên máy" />
        <FormField label="Hãng sản xuất" value={manufacturer || selectedModel?.manufacturer || ''} onChangeText={setManufacturer} placeholder="Hãng" />
        {!id ? <FormSelect label="Máy có sẵn trong kho" value={selectedMachines.length ? `${selectedMachines.length} máy đã chọn` : undefined} placeholder="Chọn một hoặc nhiều máy" onPress={() => setPicker('machines')} /> : null}
      </FormSection>

      <View style={styles.sectionTop}><View><Text style={styles.sectionTitle}>Thiết bị lắp đặt</Text></View><Pressable onPress={addSerial} style={styles.addButton}><Text style={styles.addText}>＋ Thêm máy</Text></Pressable></View>
      <View style={styles.serialList}>
        {serials.map((row, index) => <View key={row.key} style={styles.serialRow}>
          <View style={styles.serialNumber}><Text style={styles.index}>{String(index + 1).padStart(2, '0')}</Text><TextInput value={row.serial} onChangeText={(value) => setSerial(row.key, value)} autoCapitalize="characters" placeholder="Nhập số serial (S/N)" placeholderTextColor="#9AA7A8" style={styles.serialInput} /></View>
          {serials.length > 1 && <Pressable accessibilityLabel="Xóa thiết bị" onPress={() => removeSerial(row.key)} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable>}
        </View>)}
      </View>

      <FormSection title="Tiến độ và lịch lắp đặt">
        {id ? <FormChoiceGroup label="Trạng thái phiếu" value={status} options={[{ value: 'PENDING', label: 'Chờ triển khai' }, { value: 'INSTALLED', label: 'Đã lắp đặt' }]} onChange={setStatus} /> : null}
        <FormField label="Ngày lắp đặt" value={installedAt} onChangeText={setInstalledAt} placeholder="YYYY-MM-DD" />
        <FormField label="Địa chỉ lắp đặt" value={address} onChangeText={setAddress} placeholder="Địa chỉ tại khách hàng" />
      </FormSection>
      <FormSection title="Người tiếp nhận">
        <FormField label="Họ tên người tiếp nhận" value={representative} onChangeText={setRepresentative} placeholder="Họ và tên" />
        <FormField label="Chức vụ" value={receiverPosition} onChangeText={setReceiverPosition} placeholder="Khoa/phòng, chức vụ" />
        <FormField label="Số điện thoại" value={receiverPhone} onChangeText={setReceiverPhone} keyboardType="phone-pad" placeholder="Số liên hệ" />
      </FormSection>
      <FormSection title="Thông tin bàn giao">
        <FormField label="Kỹ sư bàn giao" value={installerName} onChangeText={setInstallerName} placeholder="Họ tên kỹ sư" />
        <FormField label="Chức vụ" value={installerPosition} onChangeText={setInstallerPosition} placeholder="Chức vụ" />
        <FormField label="Phương tiện" value={vehicle} onChangeText={setVehicle} placeholder="Xe hoặc phương tiện" />
        <FormField label="Ngày xuất phát" value={departureDate} onChangeText={setDepartureDate} placeholder="YYYY-MM-DD" />
      </FormSection>
      <FormSection title="Bảo hành và tình trạng thiết bị">
        <FormField label="Ngày bắt đầu bảo hành" value={warrantyStart} onChangeText={setWarrantyStart} placeholder="YYYY-MM-DD" />
        <FormField label="Ngày kết thúc bảo hành" value={warrantyEnd} onChangeText={setWarrantyEnd} placeholder="YYYY-MM-DD" />
        <FormField label="Điều kiện / ghi chú bảo hành" value={warrantyNote} onChangeText={setWarrantyNote} placeholder="Thời hạn, phạm vi hoặc điều kiện bảo hành" multiline />
        <FormChoiceGroup label="Tình trạng thiết bị" value={deviceCondition} options={[{ value: 'NEW_100', label: 'Mới 100%' }, { value: 'OTHER', label: 'Tình trạng khác' }]} onChange={setDeviceCondition} />
        {deviceCondition === 'OTHER' ? <FormField label="Mô tả tình trạng" value={deviceConditionNote} onChangeText={setDeviceConditionNote} placeholder="Mô tả tình trạng thực tế" multiline required /> : null}
      </FormSection>
      <FormField label="Ghi chú phiếu" value={note} onChangeText={setNote} placeholder="Thông tin cần bàn giao..." multiline />
      <RepairPhotosField entityId={id || savedId || undefined} entityType="MachineInstallation" photos={photos} onChange={setPhotos} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable disabled={saving} onPress={() => void save()} style={[styles.save, saving && { opacity: 0.6 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{id ? 'Lưu cập nhật' : 'Tạo phiếu lắp đặt'}</Text>}</Pressable>
    </ScrollView>
    <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHead}><Text style={styles.modalTitle}>{picker === 'customer' ? 'Chọn khách hàng' : picker === 'model' ? 'Chọn model' : picker === 'engineer' ? 'Chọn kỹ sư nhận việc' : 'Chọn máy trong kho'}</Text><Pressable onPress={() => setPicker(null)}><Text style={styles.close}>{picker === 'engineer' ? 'Xong' : 'Đóng'}</Text></Pressable></View><ScrollView>
        {picker === 'customer' ? customers.map((item) => <Pressable key={item.id} onPress={() => { setCustomerId(item.id); setPicker(null); }} style={styles.option}><Text style={styles.optionTitle}>{item.name}</Text>{item.phone ? <Text style={styles.optionMeta}>{item.phone}</Text> : null}</Pressable>) : null}
        {picker === 'model' ? models.map((item) => <Pressable key={item.id} onPress={() => { setModelId(item.id); setMachineName(item.displayName || item.name); setManufacturer(item.manufacturer || ''); setPicker(null); }} style={styles.option}><Text style={styles.optionTitle}>{item.displayName || item.name}</Text><Text style={styles.optionMeta}>{item.code || item.productCategory || ''}</Text></Pressable>) : null}
        {picker === 'engineer' ? engineers.map((item) => <Pressable key={item.id} onPress={() => setEngineerIds((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id])} style={styles.option}><Text style={styles.optionTitle}>{engineerIds.includes(item.id) ? '✓  ' : ''}{item.fullName || item.email}</Text><Text style={styles.optionMeta}>{item.email}</Text></Pressable>) : null}
        {picker === 'machines' ? machines.map((item) => { const isSelected = selectedMachineIds.includes(item.id); return <Pressable key={item.id} onPress={() => { setSelectedMachineIds((ids) => isSelected ? ids.filter((selectedId) => selectedId !== item.id) : [...ids, item.id]); if (!isSelected && selectedMachineIds.length === 0) { const model = models.find((row) => row.id === (item.machineModel?.id || item.machineModelId)); if (model) setModelId(model.id); setAccessories(JSON.stringify((item.accessories || []).map((accessory) => ({ componentAccessoryId: accessory.componentAccessory?.id, code: accessory.code || accessory.name, name: accessory.name || accessory.code || '', quantity: accessory.quantity || 1, serialNumber: accessory.serialNumber || '' })))); } }} style={styles.option}><Text style={styles.optionTitle}>{isSelected ? '✓  ' : ''}{item.machineCode || item.name || 'Máy trong kho'}</Text><Text style={styles.optionMeta}>{item.machineModel?.name || 'Chưa rõ model'} · S/N {item.serialNumber || '—'}</Text></Pressable>; }) : null}
      </ScrollView></View></View>
    </Modal>
  </SafeAreaView>;
}

function accessoryLines(value: string) {
  return parseAccessoryRows(value).map((item) => [item.name || item.code, item.serialNumber ? `S/N ${item.serialNumber}` : '', item.quantity ? `SL ${item.quantity}` : '', item.description || ''].filter(Boolean).join(' | ')).filter(Boolean);
}
function parseAccessoryRows(value: string): { name: string; code?: string; serialNumber?: string; quantity?: number; description?: string }[] {
  try { const parsed: unknown = JSON.parse(value || '[]'); if (Array.isArray(parsed)) return parsed.filter((item): item is { name: string; code?: string; serialNumber?: string; quantity?: number; description?: string } => Boolean(item && typeof item === 'object' && typeof item.name === 'string')); } catch { /* legacy newline text */ }
  return value.split('\n').map((name) => name.trim()).filter(Boolean).map((name) => ({ name }));
}

const styles = StyleSheet.create({ safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 10, padding: 16, paddingBottom: 36 }, center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }, back: { color: FieldColors.brand, fontSize: 14, fontWeight: '700' }, headerTitle: { color: FieldColors.ink, fontSize: 15, fontWeight: '700' }, kicker: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { color: FieldColors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.7 }, subtitle: { color: FieldColors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }, label: { color: FieldColors.ink, fontSize: 13, fontWeight: '700', marginTop: 8 }, required: { color: FieldColors.red }, picker: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 13, borderWidth: 1, flexDirection: 'row', minHeight: 50, paddingHorizontal: 14 }, pickerText: { color: FieldColors.ink, flex: 1, fontSize: 14, fontWeight: '600' }, chevron: { color: FieldColors.muted, fontSize: 19 }, sectionTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }, sectionTitle: { color: FieldColors.ink, fontSize: 16, fontWeight: '800' }, sectionHint: { color: FieldColors.muted, fontSize: 11, marginTop: 4 }, addButton: { backgroundColor: FieldColors.brandSoft, borderRadius: FieldRadius.pill, paddingHorizontal: 13, paddingVertical: 9 }, addText: { color: FieldColors.brand, fontSize: 14, fontWeight: '800' }, serialList: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 16, borderWidth: 1, gap: 9, padding: 11 }, serialRow: { alignItems: 'center', flexDirection: 'row', gap: 8 }, serialNumber: { alignItems: 'center', backgroundColor: FieldColors.canvas, borderRadius: 11, flex: 1, flexDirection: 'row', minHeight: 48, paddingHorizontal: 10 }, index: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', marginRight: 9 }, serialInput: { color: FieldColors.ink, flex: 1, fontSize: 13, paddingVertical: 9 }, remove: { alignItems: 'center', backgroundColor: FieldColors.redSoft, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 }, removeText: { color: FieldColors.red, fontSize: 22 }, input: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 13, borderWidth: 1, color: FieldColors.ink, fontSize: 14, minHeight: 50, paddingHorizontal: 14 }, multiline: { minHeight: 94, paddingTop: 13 }, error: { color: FieldColors.red, fontSize: 13, lineHeight: 18, marginTop: 8 }, save: { alignItems: 'center', backgroundColor: FieldColors.brandDark, borderRadius: 15, justifyContent: 'center', marginTop: 12, minHeight: 54 }, saveText: { color: '#fff', fontSize: 14, fontWeight: '800' }, permissionNote: { color: FieldColors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' }, modalBackdrop: { backgroundColor: 'rgba(12,30,34,0.35)', flex: 1, justifyContent: 'flex-end' }, modalCard: { backgroundColor: FieldColors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '78%', paddingBottom: 24, paddingHorizontal: 18, paddingTop: 20 }, modalHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, modalTitle: { color: FieldColors.ink, fontSize: 18, fontWeight: '800' }, close: { color: FieldColors.brand, fontSize: 13, fontWeight: '700', padding: 6 }, option: { borderBottomColor: FieldColors.line, borderBottomWidth: 1, paddingVertical: 14 }, optionTitle: { color: FieldColors.ink, fontSize: 14, fontWeight: '600' }, optionMeta: { color: FieldColors.muted, fontSize: 11, marginTop: 4 } });
