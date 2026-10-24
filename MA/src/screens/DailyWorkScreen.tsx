import { Text, TextInput } from '@/components/text';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { DailyWorkNote, dailyWorkApi } from '@/api/daily-work.api';
import { FieldColors } from '@/constants/field-theme';
import { useResource } from '@/hooks/use-resource';

const types = [{ id: 'WORK', name: 'Văn phòng' }, { id: 'BUSINESS_TRIP', name: 'Công tác' }, { id: 'LEAVE', name: 'Nghỉ phép' }, { id: 'OTHER', name: 'Khác' }];
const today = new Date(); const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const fromValue = `${today.getFullYear()}-01-01`; const toValue = `${today.getFullYear()}-12-31`;
const statusLabel = (status?: string) => ({ DRAFT: 'Nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Bị từ chối', CANCELLED: 'Đã hủy' })[status || ''] || 'Đã ghi';

export default function DailyWorkScreen() {
  const load = useCallback(() => dailyWorkApi.list(fromValue, toValue), []);
  const { data, loading, error, refresh } = useResource(load);
  const [title, setTitle] = useState(''); const [workDate, setWorkDate] = useState(dateValue); const [type, setType] = useState('WORK'); const [note, setNote] = useState('');
  const [editing, setEditing] = useState<DailyWorkNote | null>(null);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  async function submit() {
    if (!title.trim()) { setMessage('Vui lòng nhập nội dung công việc.'); return; }
    setSaving(true); setMessage('');
    try {
      const payload = { title: title.trim(), workDate: `${workDate}T00:00:00.000Z`, type, note: note.trim() || null };
      if (editing) await dailyWorkApi.update(editing.id, payload); else await dailyWorkApi.create(payload);
      setTitle(''); setNote(''); setEditing(null); setMessage(editing ? 'Đã cập nhật lịch công việc.' : 'Đã lưu lịch công việc.'); await refresh();
    }
    catch (cause) { setMessage(apiErrorMessage(cause)); }
    finally { setSaving(false); }
  }
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text onPress={() => router.back()} style={styles.back}>‹  Hôm nay</Text><Text style={styles.eyebrow}>LỊCH CÁ NHÂN</Text><Text style={styles.title}>Lịch công việc</Text>
    <Pressable onPress={() => router.push('/daily-report')} style={styles.reportLink}><Text style={styles.reportLinkText}>Mở báo cáo ngày  ›</Text></Pressable>
    <View style={styles.form}><Text style={styles.section}>{editing ? 'Sửa lịch' : 'Thêm lịch'}</Text><Text style={styles.label}>Nội dung</Text><TextInput value={title} onChangeText={setTitle} placeholder="Ví dụ: Khảo sát tại bệnh viện..." style={styles.input} /><Text style={styles.label}>Ngày</Text><TextInput value={workDate} onChangeText={setWorkDate} placeholder="YYYY-MM-DD" style={styles.input} /><Text style={styles.label}>Loại công việc</Text><View style={styles.types}>{types.map((item) => <Text key={item.id} onPress={() => setType(item.id)} style={[styles.type, type === item.id && styles.typeSelected, type === item.id && styles.typeSelectedText]}>{item.name}</Text>)}</View><Text style={styles.label}>Ghi chú</Text><TextInput value={note} onChangeText={setNote} placeholder="Địa điểm hoặc thông tin thêm" multiline style={[styles.input, styles.multi]} /><Pressable disabled={saving} onPress={() => void submit()} style={styles.save}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editing ? 'Cập nhật lịch' : 'Lưu lịch'}</Text>}</Pressable>{editing ? <Pressable onPress={() => { setEditing(null); setTitle(''); setNote(''); }}><Text style={styles.refresh}>Hủy sửa</Text></Pressable> : null}{!!message && <Text style={message.startsWith('Đã lưu') || message.startsWith('Đã cập nhật') ? styles.success : styles.error}>{message}</Text>}</View>
    <View style={styles.listHeader}><Text style={styles.section}>Lịch trong năm</Text><Text onPress={refresh} style={styles.refresh}>Làm mới</Text></View>
    {loading ? <ActivityIndicator color={FieldColors.brand} /> : null}{error ? <Text style={styles.error}>{apiErrorMessage(new Error(error))}</Text> : null}
    {(data || []).map((item: DailyWorkNote) => <View key={item.id} style={styles.row}><View style={{ flex: 1, gap: 5 }}><Text style={styles.noteTitle}>{item.title}</Text><Text style={styles.meta}>{item.workDate.slice(0, 10)} · {types.find((typeOption) => typeOption.id === item.type)?.name || item.type}</Text>{item.note ? <Text style={styles.meta}>{item.note}</Text> : null}<View style={styles.types}><Text style={styles.refresh} onPress={() => { setEditing(item); setTitle(item.title); setWorkDate(item.workDate.slice(0, 10)); setType(item.type || 'WORK'); setNote(item.note || ''); }}>Sửa</Text><Text style={styles.delete} onPress={() => Alert.alert('Xóa lịch công việc?', item.title, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => { void dailyWorkApi.remove(item.id).then(() => refresh()).catch((cause) => setMessage(apiErrorMessage(cause))); } }])}>Xóa</Text></View></View><Text style={styles.status}>{statusLabel(item.status)}</Text></View>)}
    {!loading && !error && !data?.length ? <Text style={styles.empty}>Chưa có lịch công việc.</Text> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 14, padding: 16, paddingBottom: 30 }, back: { color: FieldColors.brand, fontSize: 13, fontWeight: '700', marginBottom: 5 }, eyebrow: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 }, title: { color: FieldColors.ink, fontSize: 29, fontWeight: '800' }, reportLink: { backgroundColor: FieldColors.blueSoft, borderRadius: 11, padding: 12 }, reportLinkText: { color: FieldColors.blue, fontSize: 11, fontWeight: '800' }, form: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 16, borderWidth: 1, gap: 9, padding: 14 }, section: { color: FieldColors.ink, fontSize: 15, fontWeight: '800' }, label: { color: FieldColors.ink, fontSize: 12, fontWeight: '700', marginTop: 4 }, input: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 11, borderWidth: 1, color: FieldColors.ink, fontSize: 14, minHeight: 44, paddingHorizontal: 12 }, multi: { minHeight: 70, paddingTop: 10 }, types: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, type: { backgroundColor: FieldColors.canvas, borderRadius: 99, color: FieldColors.muted, fontSize: 10, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 8 }, typeSelected: { backgroundColor: FieldColors.brandDark }, typeSelectedText: { color: '#fff' }, save: { alignItems: 'center', backgroundColor: FieldColors.brandDark, borderRadius: 12, justifyContent: 'center', minHeight: 46 }, saveText: { color: '#fff', fontSize: 14, fontWeight: '800' }, success: { color: FieldColors.green, fontSize: 11 }, error: { color: FieldColors.red, fontSize: 11 }, listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }, refresh: { color: FieldColors.brand, fontSize: 11, fontWeight: '700' }, delete: { color: FieldColors.red, fontSize: 11, fontWeight: '700' }, row: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 13 }, noteTitle: { color: FieldColors.ink, fontSize: 12, fontWeight: '800' }, meta: { color: FieldColors.muted, fontSize: 13, lineHeight: 15 }, status: { color: FieldColors.brand, fontSize: 12, fontWeight: '800' }, empty: { color: FieldColors.muted, padding: 20, textAlign: 'center' } });
