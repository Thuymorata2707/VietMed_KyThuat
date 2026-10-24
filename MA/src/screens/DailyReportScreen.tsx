import { Text, TextInput } from '@/components/text';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { DailyReportResponse, dailyReportApi } from '@/api/daily-report.api';
import { FormField, FormSection } from '@/components/form-controls';
import { FieldColors } from '@/constants/field-theme';

const today = new Date();
const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const template = {
  summary: '1. Lịch trình và khách hàng:\n- Thời gian đến/rời điểm làm việc:\n- Khoa/phòng sử dụng, người tiếp nhận:\n\n2. Thiết bị y tế xử lý:\n- Tên máy/model/serial:\n- Tình trạng ban đầu/cảnh báo lỗi:\n\n3. Công việc kỹ thuật:\n- Sửa chữa/bảo trì/lắp đặt/đào tạo:\n- Các bước kiểm tra, đo kiểm, hiệu chuẩn:\n- Linh kiện/vật tư sử dụng:\n\n4. Kết quả và bàn giao:\n- Test chức năng/chạy thử:\n- Hướng dẫn người dùng:',
  pending: '- Thiết bị/khách hàng còn tồn đọng:\n- Nguyên nhân chưa hoàn tất:\n- Linh kiện cần chờ:\n- Lịch hẹn xử lý tiếp:',
  proposal: '- Hỗ trợ cần từ điều phối hoặc kho:\n- Vật tư cần chuẩn bị:\n- Rủi ro cần cảnh báo:\n- Kinh nghiệm cần chia sẻ:',
};
const statusLabel: Record<string, string> = { DRAFT: 'Nháp', SUBMITTED: 'Đã chốt', APPROVED: 'Đã duyệt', NEEDS_REVISION: 'Cần chỉnh sửa' };

export default function DailyReportScreen() {
  const [date, setDate] = useState(dateString); const [data, setData] = useState<DailyReportResponse | null>(null);
  const [summary, setSummary] = useState(''); const [pending, setPending] = useState(''); const [proposal, setProposal] = useState('');
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async (targetDate: string) => {
    setLoading(true); setError(''); setMessage('');
    try { const result = await dailyReportApi.get(targetDate); setData(result); setSummary(result.report?.summary ?? result.suggested?.summary ?? ''); setPending(result.report?.pending ?? result.suggested?.pending ?? ''); setProposal(result.report?.proposal ?? result.suggested?.proposal ?? ''); }
    catch (cause) { setError(apiErrorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => { void load(dateString); }, 0); return () => clearTimeout(timer); }, [load]);
  const status = data?.report?.status || 'DRAFT'; const canEdit = status === 'DRAFT' || status === 'NEEDS_REVISION';
  async function save(submit: boolean) {
    if (!summary.trim() && !pending.trim() && !proposal.trim()) { setError('Nhập ít nhất một nội dung trước khi lưu.'); return; }
    setSaving(true); setError(''); setMessage('');
    try { const report = await dailyReportApi.save({ reportDate: date, summary, pending, proposal }); if (submit) { await dailyReportApi.submit(report.id); } await load(date); setMessage(submit ? 'Đã chốt báo cáo ngày.' : 'Đã lưu nháp báo cáo.'); }
    catch (cause) { setError(apiErrorMessage(cause)); }
    finally { setSaving(false); }
  }
  function useSuggested() { setSummary(data?.suggested?.summary || ''); setPending(data?.suggested?.pending || ''); setProposal(data?.suggested?.proposal || ''); }
  function useTemplate() { setSummary((value) => value || template.summary); setPending((value) => value || template.pending); setProposal((value) => value || template.proposal); }
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text onPress={() => router.back()} style={styles.back}>‹  Lịch công việc</Text><Text style={styles.eyebrow}>BÁO CÁO KỸ SƯ</Text><Text style={styles.title}>Báo cáo ngày</Text>
    <View style={styles.top}><TextInput value={date} onChangeText={setDate} onSubmitEditing={() => void load(date)} placeholder="YYYY-MM-DD" style={styles.dateInput} /><Pressable onPress={() => void load(date)} style={styles.refresh}><Text style={styles.refreshText}>Mở ngày</Text></Pressable><Text style={styles.status}>{statusLabel[status] || status}</Text></View>
    {loading ? <ActivityIndicator color={FieldColors.brand} /> : null}
    {data?.suggested ? <View style={styles.summary}><Text style={styles.section}>Dữ liệu hệ thống gợi ý</Text><Text style={styles.meta}>Lịch {data.suggested.counts.dailyNotes} · Sửa chữa {data.suggested.counts.repairs} · Bảo trì {data.suggested.counts.maintenances} · Lắp đặt {data.suggested.counts.installations}</Text><View style={styles.actions}><Pressable onPress={useSuggested} style={styles.smallButton}><Text style={styles.smallText}>Dùng nội dung gợi ý</Text></Pressable><Pressable onPress={useTemplate} style={styles.smallButton}><Text style={styles.smallText}>Dùng mẫu báo cáo</Text></Pressable></View></View> : null}
    <FormSection title="Nội dung báo cáo">
      <FormField label="Kết quả công việc" value={summary} onChangeText={setSummary} editable={canEdit} placeholder="Công việc đã thực hiện, thiết bị và kết quả bàn giao..." multiline />
      <FormField label="Việc còn tồn đọng" value={pending} onChangeText={setPending} editable={canEdit} placeholder="Việc cần theo dõi, lịch hẹn xử lý tiếp..." multiline />
      <FormField label="Đề xuất / hỗ trợ" value={proposal} onChangeText={setProposal} editable={canEdit} placeholder="Vật tư, hỗ trợ điều phối hoặc đề xuất..." multiline />
    </FormSection>
    {data?.report?.reviewNote ? <View style={styles.review}><Text style={styles.section}>Góp ý duyệt</Text><Text style={styles.meta}>{data.report.reviewNote}</Text></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}{message ? <Text style={styles.success}>{message}</Text> : null}
    {canEdit ? <><Pressable disabled={saving || loading} onPress={() => void save(false)} style={styles.secondary}>{saving ? <ActivityIndicator color={FieldColors.brand} /> : <Text style={styles.secondaryText}>Lưu nháp</Text>}</Pressable><Pressable disabled={saving || loading} onPress={() => void save(true)} style={styles.primary}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Lưu và chốt báo cáo</Text>}</Pressable></> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: FieldColors.canvas }, content: { padding: 19, paddingBottom: 35, gap: 12 }, back: { color: FieldColors.brand, fontSize: 12, fontWeight: '700', marginBottom: 5 }, eyebrow: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 }, title: { color: FieldColors.ink, fontSize: 29, fontWeight: '800' }, top: { alignItems: 'center', flexDirection: 'row', gap: 8 }, dateInput: { flex: 1, minHeight: 43, backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, color: FieldColors.ink, fontSize: 12 }, refresh: { backgroundColor: FieldColors.blueSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 }, refreshText: { color: FieldColors.blue, fontSize: 14, fontWeight: '800' }, status: { color: FieldColors.brand, fontSize: 12, fontWeight: '800' }, summary: { backgroundColor: FieldColors.blueSoft, borderRadius: 14, padding: 13, gap: 8 }, section: { color: FieldColors.ink, fontSize: 13, fontWeight: '800' }, meta: { color: FieldColors.muted, fontSize: 13, lineHeight: 16 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, smallButton: { backgroundColor: FieldColors.surface, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, smallText: { color: FieldColors.blue, fontSize: 14, fontWeight: '700' }, review: { backgroundColor: FieldColors.amberSoft, borderRadius: 12, padding: 12, gap: 5 }, secondary: { alignItems: 'center', justifyContent: 'center', minHeight: 45, backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderWidth: 1, borderRadius: 12 }, secondaryText: { color: FieldColors.brand, fontSize: 12, fontWeight: '800' }, primary: { alignItems: 'center', justifyContent: 'center', minHeight: 48, backgroundColor: FieldColors.brandDark, borderRadius: 12 }, primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' }, error: { color: FieldColors.red, fontSize: 11 }, success: { color: FieldColors.green, fontSize: 11, fontWeight: '700' } });
