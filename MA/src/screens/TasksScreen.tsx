import { Text, TextInput } from '@/components/text';
import { Link } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { WorkKind, workApi } from '@/api/work.api';
import { Eyebrow, StatusPill } from '@/components/field-ui';
import { FieldColors } from '@/constants/field-theme';
import { useAuth } from '@/contexts/auth-context';
import { useResource } from '@/hooks/use-resource';

const kinds: { id: 'all' | WorkKind; label: string }[] = [{ id: 'all', label: 'Tất cả' }, { id: 'repair', label: 'Sửa chữa' }, { id: 'maintenance', label: 'Bảo trì' }, { id: 'installation', label: 'Lắp đặt' }];
const kindName: Record<WorkKind, string> = { repair: 'Sửa chữa', maintenance: 'Bảo trì', installation: 'Lắp đặt' };
const statusTone = (status: string): 'blue' | 'green' | 'amber' | 'red' | 'neutral' => /COMPLETED|INSTALLED/i.test(status) ? 'green' : /OVERDUE|WAITING_PARTS/i.test(status) ? 'red' : /IN_PROGRESS/i.test(status) ? 'amber' : 'blue';
const statusName = (status: string) => ({ PENDING: 'Chờ nhận', ASSIGNED: 'Đã giao', SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang xử lý', WAITING_PARTS: 'Chờ linh kiện', OVERDUE: 'Quá hạn', COMPLETED: 'Hoàn tất', INSTALLED: 'Đã lắp đặt', CANCELLED: 'Đã hủy' })[status] || status;

export default function EngineerTasksScreen() {
  const { user } = useAuth(); const [kind, setKind] = useState<'all' | WorkKind>('all'); const [query, setQuery] = useState('');
  const userId = user?.id;
  const isAdmin = /admin|quản trị/i.test(user?.role?.name || '');
  const load = useCallback(() => userId ? workApi.listAssigned(userId, isAdmin) : Promise.resolve([]), [userId, isAdmin]);
  const { data, loading, error, refresh } = useResource(load);
  const rows = useMemo(() => (data || []).filter((task) => (kind === 'all' || task.kind === kind) && `${task.code || ''} ${task.title || ''} ${task.customer?.name || ''} ${task.machine?.serialNumber || ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))), [data, kind, query]);
  const activeCount = rows.filter((item) => !['COMPLETED', 'INSTALLED', 'CANCELLED'].includes(item.status)).length;
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Eyebrow>CÔNG VIỆC ĐƯỢC GIAO</Eyebrow><Text style={styles.title}>Việc của tôi</Text></View><Pressable onPress={refresh} style={styles.refresh}><Text style={styles.refreshText}>Làm mới</Text></Pressable></View>
    <View style={[styles.summary, { backgroundColor: FieldColors.brandDark, borderRadius: 22, paddingVertical: 18 }]}><Text style={[styles.summaryNumber, { color: "#FFFFFF", fontSize: 38 }]}>{loading ? '—' : activeCount}</Text><View><Text style={[styles.summaryTitle, { color: "#FFFFFF", fontSize: 15 }]}>việc cần theo dõi</Text><Text style={[styles.summaryCaption, { color: "#E8C7CA" }]}>{data?.length || 0} phiếu sửa chữa, bảo trì, lắp đặt</Text></View></View>
    <View style={styles.search}><Text style={{ color: FieldColors.muted }}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Tìm mã phiếu, khách hàng, serial..." style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{kinds.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === kind }} onPress={() => setKind(item.id)} style={[styles.filter, item.id === kind && styles.selected]}><Text style={[styles.filterText, item.id === kind && styles.selectedText]}>{item.label}</Text></Pressable>)}</ScrollView>
    {loading ? <ActivityIndicator color={FieldColors.brand} style={{ marginTop: 30 }} /> : null}
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{apiErrorMessage(new Error(error))}</Text><Text onPress={refresh} style={styles.retry}>Thử lại</Text></View> : null}
    {!loading && !error && rows.map((task) => <Link key={`${task.kind}-${task.id}`} href={{ pathname: '/work/[kind]/[id]', params: { kind: task.kind, id: task.id } }} asChild><Pressable style={styles.card}>
      <View style={[styles.cardTop, { paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: "#F0EFED" }]}><View style={styles.kindLine}><View style={[styles.kindDot, task.kind === 'repair' ? styles.repair : task.kind === 'maintenance' ? styles.maintenance : styles.installation]} /><Text style={styles.kindText}>{kindName[task.kind]}</Text></View><StatusPill label={statusName(task.status)} tone={statusTone(task.status)} /></View>
      <Text style={[styles.code, { color: FieldColors.brand, letterSpacing: 0.5 }]}>{task.code || 'Chưa có mã phiếu'}</Text><Text style={styles.cardTitle}>{task.title || task.machine?.modelName || kindName[task.kind]}</Text>
      <Text style={styles.customer}>{task.customer?.name || 'Chưa có khách hàng'}</Text>
      <View style={styles.cardFoot}><Text style={styles.meta}>S/N {task.machine?.serialNumber || 'Chưa nhập'}</Text><Text style={styles.meta}>{task.scheduledDate?.slice(0, 10) || task.installedAt?.slice(0, 10) || ''}</Text></View>
      {task.reviewStatus === 'NEEDS_REVISION' ? <Text style={styles.revision}>Cần bổ sung: {task.reviewNote || 'Xem yêu cầu duyệt'}</Text> : null}
    </Pressable></Link>)}
    {!loading && !error && rows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Không có công việc phù hợp</Text></View> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 15, padding: 16, paddingBottom: 30 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, title: { color: FieldColors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.6, marginTop: 4 }, refresh: { backgroundColor: FieldColors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, refreshText: { color: FieldColors.brand, fontSize: 14, fontWeight: '600' }, summary: { alignItems: 'center', backgroundColor: FieldColors.brandSoft, borderRadius: 18, flexDirection: 'row', gap: 13, paddingHorizontal: 16, paddingVertical: 14 }, summaryNumber: { color: FieldColors.brandDark, fontSize: 30, fontWeight: '700', letterSpacing: -0.8 }, summaryTitle: { color: FieldColors.ink, fontSize: 13, fontWeight: '700' }, summaryCaption: { color: FieldColors.muted, fontSize: 10, marginTop: 4 }, search: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 14, flexDirection: 'row', gap: 9, minHeight: 47, paddingHorizontal: 14 }, searchInput: { color: FieldColors.ink, flex: 1, fontSize: 12 }, filters: { gap: 7 }, filter: { backgroundColor: '#E9E8E5', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 9 }, filterText: { color: FieldColors.muted, fontSize: 13, fontWeight: '600' }, selected: { backgroundColor: FieldColors.surface }, selectedText: { color: FieldColors.brandDark, fontWeight: '700' }, card: { backgroundColor: FieldColors.surface, borderRadius: 17, gap: 7, padding: 14, shadowColor: '#24262A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 }, cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, kindLine: { alignItems: 'center', flexDirection: 'row', gap: 6 }, kindDot: { borderRadius: 5, height: 7, width: 7 }, repair: { backgroundColor: FieldColors.red }, maintenance: { backgroundColor: FieldColors.blue }, installation: { backgroundColor: FieldColors.green }, kindText: { color: FieldColors.muted, fontSize: 13, fontWeight: '600' }, code: { color: FieldColors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.35 }, cardTitle: { color: FieldColors.ink, fontSize: 14, fontWeight: '700' }, customer: { color: FieldColors.ink, fontSize: 13, fontWeight: '500' }, cardFoot: { borderTopColor: '#F0EFED', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 3, paddingTop: 8 }, meta: { color: FieldColors.muted, fontSize: 10 }, revision: { color: FieldColors.amber, fontSize: 11 }, empty: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 17, padding: 25 }, emptyTitle: { color: FieldColors.ink, fontSize: 14, fontWeight: '700' }, emptyNote: { color: FieldColors.muted, fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: 'center' }, errorBox: { backgroundColor: FieldColors.redSoft, borderRadius: 14, padding: 13 }, errorText: { color: FieldColors.red, fontSize: 12 }, retry: { color: FieldColors.brand, fontWeight: '600', marginTop: 7 } });
