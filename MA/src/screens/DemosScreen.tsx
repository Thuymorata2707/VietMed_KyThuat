import { Text, TextInput } from '@/components/text';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { DemoLoan, demoApi } from '@/api/demo.api';
import { FieldColors } from '@/constants/field-theme';
import { RepairPhotosField } from '@/components/RepairPhotosField';
import { LocalPhoto } from '@/api/attachment.api';

type ReturnDraft = { condition: string; accessories: string; note: string; requiresRepair: boolean };
const statusLabel: Record<string, string> = { PLANNED: 'Chờ bàn giao', HANDED_OVER: 'Đã bàn giao', OVERDUE: 'Quá hạn', RETURNED: 'Đã thu hồi', CANCELLED: 'Đã hủy' };
const emptyDraft = (): ReturnDraft => ({ condition: 'Máy nhận đủ và hoạt động bình thường.', accessories: '', note: '', requiresRepair: false });

export default function DemosScreen({ onBack }: { onBack?: () => void }) {
  const router = useRouter(); const { id: selectedId } = useLocalSearchParams<{ id?: string }>();
  const [loans, setLoans] = useState<DemoLoan[]>([]); const [drafts, setDrafts] = useState<Record<string, ReturnDraft>>({});
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, LocalPhoto[]>>({});
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = useCallback(async (refresh = false) => { if (refresh) setRefreshing(true); else setLoading(true); setError(''); try { setLoans(await demoApi.list()); } catch (cause) { setError(apiErrorMessage(cause)); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { const task = setTimeout(() => { void load(); }, 0); return () => clearTimeout(task); }, [load]);
  const groups = useMemo(() => {
    const map = new Map<string, DemoLoan[]>();
    loans.forEach((loan) => { const key = loan.ticketCode || loan.code || loan.id; map.set(key, [...(map.get(key) || []), loan]); });
    return [...map.entries()];
  }, [loans]);
  const visibleGroups = useMemo(() => selectedId ? groups.filter(([, group]) => group.some((loan) => loan.id === selectedId)) : groups, [groups, selectedId]);
  async function run(key: string, action: (loan: DemoLoan) => Promise<unknown>, selected: DemoLoan[]) {
    setBusy(key); setError(''); setNotice('');
    try { for (const loan of selected) await action(loan); setNotice('Đã cập nhật phiếu demo.'); await load(true); }
    catch (cause) { setError(apiErrorMessage(cause)); await load(true); }
    finally { setBusy(''); }
  }
  async function returnGroup(key: string, selected: DemoLoan[]) {
    setBusy(key); setError(''); setNotice('');
    try {
      for (const loan of selected) {
        const draft = drafts[loan.id] || { ...emptyDraft(), accessories: (loan.handoverAccessories || []).join('\n') };
        await demoApi.returnLoan(loan.id, { occurredAt: new Date().toISOString(), condition: draft.condition, accessories: draft.accessories.split('\n').map((x) => x.trim()).filter(Boolean), note: draft.note, requiresRepair: draft.requiresRepair });
      }
      setNotice('Đã ghi nhận thu hồi riêng cho từng máy.'); setDrafts((current) => { const next = { ...current }; selected.forEach((loan) => delete next[loan.id]); return next; }); await load(true);
    } catch (cause) { setError(apiErrorMessage(cause)); await load(true); }
    finally { setBusy(''); }
  }
  const setDraft = (id: string, field: keyof ReturnDraft, value: string | boolean) => setDrafts((current) => ({ ...current, [id]: { ...(current[id] || emptyDraft()), [field]: value } }));
  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={FieldColors.brand} /></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
    {onBack || selectedId ? <Pressable onPress={() => onBack ? onBack() : router.back()} style={styles.back}><Text style={styles.backText}>‹  Phiếu kỹ thuật</Text></Pressable> : null}<Text style={styles.eyebrow}>PHÂN LOẠI PHIẾU</Text><Text style={styles.title}>Phiếu demo</Text><Text style={styles.caption}>{loans.length} máy · {groups.length} phiếu</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.notice}>{notice}</Text> : null}
    {!visibleGroups.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>{selectedId ? 'Không tìm thấy phiếu demo' : 'Chưa có phiếu demo'}</Text></View> : visibleGroups.map(([code, group]) => {
      const waiting = group.filter((loan) => loan.status === 'PLANNED'); const returning = group.filter((loan) => ['HANDED_OVER', 'OVERDUE'].includes(loan.status)); const preparing = group.filter((loan) => loan.status === 'RETURNED'); const working = busy === code;
      return <View key={code} style={styles.group}><View style={styles.groupHead}><View style={{ flex: 1 }}><Text style={styles.code}>{code}</Text><Text style={styles.caption}>{group[0].customer?.name || group[0].customer?.hospitalName || 'Khách hàng'}</Text></View><Text style={styles.count}>{group.length} máy</Text></View>
        {group.map((loan) => { const draft = drafts[loan.id] || { ...emptyDraft(), accessories: (loan.handoverAccessories || []).join('\n') }; return <View key={loan.id} style={styles.machine}><View style={styles.machineHead}><View style={{ flex: 1 }}><Text style={styles.machineName}>{loan.machine?.machineCode || loan.machine?.serialNumber || loan.machine?.modelName || 'Thiết bị demo'}</Text><Text style={styles.caption}>{loan.machine?.modelName || loan.machine?.name || loan.code || '—'}</Text></View><Text style={[styles.badge, loan.status === 'OVERDUE' && styles.badgeLate]}>{statusLabel[loan.status] || loan.status}</Text></View>
          <RepairPhotosField entityId={loan.id} entityType="DemoLoan" photos={photoDrafts[loan.id] || []} onChange={(photos) => setPhotoDrafts((current) => ({ ...current, [loan.id]: photos }))} />
          {returning.includes(loan) ? <View style={styles.form}><Text style={styles.label}>Tình trạng khi thu hồi</Text><TextInput value={draft.condition} onChangeText={(value) => setDraft(loan.id, 'condition', value)} style={styles.input} placeholder="Tình trạng thiết bị"/><Text style={styles.label}>Phụ kiện (mỗi dòng một món)</Text><TextInput value={draft.accessories} onChangeText={(value) => setDraft(loan.id, 'accessories', value)} style={[styles.input, styles.multiline]} multiline/><Text style={styles.label}>Ghi chú</Text><TextInput value={draft.note} onChangeText={(value) => setDraft(loan.id, 'note', value)} style={styles.input} placeholder="Ghi chú thu hồi"/><View style={styles.switchRow}><Text style={styles.label}>Cần sửa chữa</Text><Switch value={draft.requiresRepair} onValueChange={(value) => setDraft(loan.id, 'requiresRepair', value)} trackColor={{ true: FieldColors.brand }}/></View></View> : null}
        </View>; })}
        {waiting.length ? <Button label="Xác nhận bàn giao" disabled={working} onPress={() => void run(code, (loan) => demoApi.handover(loan.id), waiting)} /> : null}
        {returning.length ? <Button label="Ghi nhận thu hồi" disabled={working} onPress={() => void returnGroup(code, returning)} /> : null}
        {preparing.length ? <Button label="Xác nhận chuẩn bị lại" disabled={working} secondary onPress={() => void run(code, (loan) => demoApi.prepare(loan.id), preparing)} /> : null}
        {!waiting.length && !returning.length && !preparing.length ? <Text style={styles.caption}>Không có thao tác cần xử lý.</Text> : null}
      </View>;
    })}
  </ScrollView></SafeAreaView>;
}
function Button({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled: boolean; secondary?: boolean }) { return <Pressable onPress={onPress} disabled={disabled} style={[styles.button, secondary && styles.secondary, disabled && { opacity: 0.5 }]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{disabled ? 'Đang lưu…' : label}</Text></Pressable>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: FieldColors.canvas }, content: { padding: 18, paddingBottom: 36, gap: 12 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, back: { alignSelf: 'flex-start', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 }, backText: { color: FieldColors.brand, fontSize: 11, fontWeight: '800' }, eyebrow: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 8 }, title: { color: FieldColors.ink, fontSize: 23, fontWeight: '800' }, caption: { color: FieldColors.muted, fontSize: 11, marginTop: 4 }, group: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderWidth: 1, borderRadius: 17, padding: 13, gap: 10, marginTop: 5 }, groupHead: { alignItems: 'center', flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: FieldColors.line, paddingBottom: 10 }, code: { color: FieldColors.ink, fontSize: 15, fontWeight: '800' }, count: { color: FieldColors.muted, fontSize: 13, fontWeight: '700' }, machine: { backgroundColor: '#F5F4F1', borderRadius: 12, padding: 11, gap: 9 }, machineHead: { alignItems: 'center', flexDirection: 'row', gap: 8 }, machineName: { color: FieldColors.ink, fontSize: 12, fontWeight: '800' }, badge: { backgroundColor: FieldColors.blueSoft, color: FieldColors.blue, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, fontSize: 9, fontWeight: '800' }, badgeLate: { backgroundColor: FieldColors.amberSoft, color: FieldColors.amber }, form: { gap: 7, borderTopColor: FieldColors.line, borderTopWidth: 1, paddingTop: 9 }, label: { color: FieldColors.ink, fontSize: 12, fontWeight: '700' }, input: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, minHeight: 40, color: FieldColors.ink, fontSize: 12 }, multiline: { minHeight: 62, textAlignVertical: 'top' }, switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, button: { backgroundColor: FieldColors.brandDark, minHeight: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 2 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 }, secondary: { backgroundColor: FieldColors.blueSoft }, secondaryText: { color: FieldColors.blue }, empty: { backgroundColor: FieldColors.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginTop: 16 }, emptyTitle: { color: FieldColors.ink, fontSize: 14, fontWeight: '800' }, error: { color: FieldColors.red, fontSize: 12 }, notice: { color: FieldColors.green, fontSize: 12, fontWeight: '700' } });
