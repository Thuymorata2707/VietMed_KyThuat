import { Text, TextInput } from '@/components/text';
import { MachineModel } from '@/api/device.api';
import { FieldColors } from '@/constants/field-theme';
import { isUltrasoundMachineModel, ultrasoundProbeOptions } from '@/config/ultrasoundProbes';
import { endoscopyAccessoryOptions, isEndoscopyMachineModel } from '@/config/endoscopyAccessories';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

type Accessory = { componentAccessoryId?: string; code?: string; name: string; quantity?: number; serialNumber?: string; description?: string };
type Option = { id?: string; code: string; name: string; quantity?: number; requiresSerial?: boolean };

export function MachineAccessoryEditor({ model, value, onChange, title }: { model?: MachineModel | null; value: string; onChange: (value: string) => void; title?: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  let items: Accessory[] = [];
  try { const parsed = JSON.parse(value || '[]'); if (Array.isArray(parsed)) items = parsed; } catch { items = value.split('\n').filter(Boolean).map((name) => ({ name, code: name })); }
  const templates = model?.components?.flatMap((component) => component.ComponentAccessory || component.accessories || []) || [];
  const isProbe = isUltrasoundMachineModel(model);
  const isEndoscopy = isEndoscopyMachineModel(model);
  const modelOptions: Option[] = templates.map((item) => ({ id: item.id, code: item.code || item.name, name: isProbe ? item.code || item.name : item.name, quantity: item.quantity, requiresSerial: item.requiresSerial }));
  const fallbackOptions: Option[] = isProbe ? ultrasoundProbeOptions.map((item) => ({ code: item.value, name: item.label })) : isEndoscopy ? endoscopyAccessoryOptions.map((item) => ({ code: item.value, name: item.label })) : [];
  const options = modelOptions.length ? modelOptions : fallbackOptions;
  const visibleOptions = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    return options.filter((item) => !keyword || `${item.name} ${item.code}`.toLocaleLowerCase('vi').includes(keyword));
  }, [options, query]);
  const commit = (next: Accessory[]) => onChange(next.length ? JSON.stringify(next) : '');
  const update = (index: number, patch: Partial<Accessory>) => commit(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const toggle = (option: Option) => {
    const code = option.code || option.name;
    const found = items.findIndex((item) => (item.code || item.name) === code);
    if (found >= 0) commit(items.filter((_, i) => i !== found));
    else commit([...items, { componentAccessoryId: option.id, code, name: option.name, quantity: option.quantity || 1, serialNumber: '' }]);
  };
  const addCustom = () => { commit([...items, { name: '', code: '', quantity: 1, serialNumber: '' }]); setPickerOpen(false); };
  const titleText = title || (isProbe ? 'Đầu dò đi kèm' : 'Phụ kiện đi kèm');
  return <View style={styles.wrap}>
    <View style={styles.head}>
      <View style={styles.heading}><Text style={styles.title}>{titleText}</Text><Text style={styles.count}>{items.length} món</Text></View>
      <Pressable onPress={() => { setQuery(''); setPickerOpen(true); }} style={styles.add}><Text style={styles.addText}>＋ Chọn phụ kiện</Text></Pressable>
    </View>
    {items.length ? <View style={styles.selectedList}>{items.map((item, index) => <View key={`${item.code}-${index}`} style={styles.itemCard}>
      <View style={styles.itemHead}><View style={styles.itemNameWrap}><Text style={styles.itemName}>{item.name || item.code || 'Phụ kiện mới'}</Text>{item.code && item.name !== item.code ? <Text style={styles.itemCode}>{item.code}</Text> : null}</View><Pressable accessibilityLabel="Xóa phụ kiện" onPress={() => commit(items.filter((_, i) => i !== index))} hitSlop={8}><Text style={styles.remove}>×</Text></Pressable></View>
      <View style={styles.fields}><View style={styles.serialField}><Text style={styles.fieldLabel}>Serial / S/N</Text><TextInput value={item.serialNumber || ''} onChangeText={(serialNumber) => update(index, { serialNumber })} placeholder="Nhập serial" autoCapitalize="characters" style={styles.input} /></View>{!isProbe ? <View style={styles.qtyField}><Text style={styles.fieldLabel}>Số lượng</Text><TextInput value={String(item.quantity || 1)} onChangeText={(quantity) => update(index, { quantity: Math.max(1, Number(quantity) || 1) })} keyboardType="number-pad" style={styles.input} /></View> : null}</View>
      {!item.componentAccessoryId && !options.some((option) => option.code === item.code) ? <TextInput value={item.name} onChangeText={(name) => update(index, { name, code: name })} placeholder="Tên phụ kiện" style={styles.input} /> : null}
      {!isProbe ? <TextInput value={item.description || ''} onChangeText={(description) => update(index, { description })} placeholder="Model / ghi chú (nếu có)" style={styles.input} /> : null}
    </View>)}</View> : <Pressable onPress={() => { setQuery(''); setPickerOpen(true); }} style={styles.empty}><Text style={styles.emptyText}>Chưa có phụ kiện</Text></Pressable>}
    <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
      <View style={styles.shade}><View style={styles.modal}>
        <View style={styles.modalHead}><View><Text style={styles.modalTitle}>Chọn {isProbe ? 'đầu dò' : 'phụ kiện'}</Text><Text style={styles.modalSubtitle}>{model?.displayName || model?.name || 'Danh mục thiết bị'}</Text></View><Pressable onPress={() => setPickerOpen(false)}><Text style={styles.close}>Xong</Text></Pressable></View>
        <TextInput value={query} onChangeText={setQuery} autoCorrect={false} placeholder="Tìm tên hoặc mã phụ kiện" style={styles.search} />
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.optionList}>{visibleOptions.map((option) => { const selected = items.some((item) => (item.code || item.name) === option.code); return <Pressable key={`${option.code}-${option.id || ''}`} onPress={() => toggle(option)} style={styles.option}><View style={[styles.check, selected && styles.checkSelected]}>{selected ? <Text style={styles.checkmark}>✓</Text> : null}</View><View style={styles.optionCopy}><Text style={styles.optionName}>{option.name}</Text>{option.code !== option.name ? <Text style={styles.optionCode}>{option.code}</Text> : null}</View><Text style={styles.optionAction}>{selected ? 'Đã chọn' : 'Thêm'}</Text></Pressable>; })}{!visibleOptions.length ? <Text style={styles.noResults}>Không tìm thấy phụ kiện.</Text> : null}</ScrollView>
        <Pressable onPress={addCustom} style={styles.customButton}><Text style={styles.customText}>＋ Nhập phụ kiện khác</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: FieldColors.canvas, borderRadius: 14, gap: 10, padding: 12 }, head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, heading: { alignItems: 'center', flexDirection: 'row', flex: 1, gap: 8 }, title: { color: FieldColors.ink, fontSize: 13, fontWeight: '700' }, count: { backgroundColor: FieldColors.surface, borderRadius: 99, color: FieldColors.muted, fontSize: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 }, add: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 }, addText: { color: FieldColors.brand, fontSize: 11, fontWeight: '700' }, selectedList: { gap: 8 }, itemCard: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 10 }, itemHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, itemNameWrap: { flex: 1, gap: 2 }, itemName: { color: FieldColors.ink, fontSize: 12, fontWeight: '700' }, itemCode: { color: FieldColors.muted, fontSize: 10 }, remove: { color: FieldColors.red, fontSize: 23, paddingHorizontal: 5 }, fields: { flexDirection: 'row', gap: 8 }, serialField: { flex: 1 }, qtyField: { width: 82 }, fieldLabel: { color: FieldColors.muted, fontSize: 10, marginBottom: 4 }, input: { backgroundColor: '#fff', borderColor: FieldColors.line, borderRadius: 9, borderWidth: 1, color: FieldColors.ink, flex: 1, fontSize: 12, minHeight: 40, paddingHorizontal: 10 }, empty: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 }, emptyText: { color: FieldColors.muted, fontSize: 11 }, shade: { backgroundColor: 'rgba(16,24,32,0.42)', flex: 1, justifyContent: 'flex-end' }, modal: { backgroundColor: FieldColors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '84%', paddingBottom: 26, paddingHorizontal: 16, paddingTop: 18 }, modalHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, modalTitle: { color: FieldColors.ink, fontSize: 18, fontWeight: '800' }, modalSubtitle: { color: FieldColors.muted, fontSize: 11, marginTop: 3 }, close: { color: FieldColors.brand, fontSize: 13, fontWeight: '700', padding: 8 }, search: { backgroundColor: FieldColors.canvas, borderColor: FieldColors.line, borderRadius: 11, borderWidth: 1, color: FieldColors.ink, fontSize: 13, minHeight: 46, paddingHorizontal: 12 }, optionList: { marginTop: 8 }, option: { alignItems: 'center', borderBottomColor: FieldColors.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, minHeight: 55, paddingVertical: 8 }, check: { alignItems: 'center', borderColor: FieldColors.line, borderRadius: 7, borderWidth: 1, height: 22, justifyContent: 'center', width: 22 }, checkSelected: { backgroundColor: FieldColors.brand, borderColor: FieldColors.brand }, checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' }, optionCopy: { flex: 1, gap: 2 }, optionName: { color: FieldColors.ink, fontSize: 12, fontWeight: '600' }, optionCode: { color: FieldColors.muted, fontSize: 10 }, optionAction: { color: FieldColors.brand, fontSize: 11, fontWeight: '700' }, noResults: { color: FieldColors.muted, fontSize: 12, padding: 18, textAlign: 'center' }, customButton: { alignItems: 'center', borderColor: FieldColors.brand, borderRadius: 11, borderWidth: 1, marginTop: 8, minHeight: 44, justifyContent: 'center' }, customText: { color: FieldColors.brand, fontSize: 12, fontWeight: '700' },
});
