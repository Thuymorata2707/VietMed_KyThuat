import { Text, TextInput } from '@/components/text';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { ServiceTicket, ticketApi } from '@/api/ticket.api';
import { demoApi, DemoLoan } from '@/api/demo.api';
import { WorkRow, workApi } from '@/api/work.api';
import { useResource } from '@/hooks/use-resource';
import { useAuth } from '@/contexts/auth-context';
import { FieldIcon } from '@/components/field-ui';
import { FieldColors } from '@/constants/field-theme';

type Kind = 'service' | 'repair' | 'maintenance' | 'installation' | 'demo';
type TypeFilter = 'all' | Kind;
type QueueFilter = 'all' | 'action' | 'active' | 'review' | 'closed';
type TicketRow = { id: string; kind: Kind; code: string; title: string; status: string; reviewStatus?: string | null; date?: string | null; customer?: string; machine?: string; serial?: string; raw: ServiceTicket | WorkRow | DemoLoan };
const typeOptions: { id: TypeFilter; label: string }[] = [{ id: 'all', label: 'Tất cả' }, { id: 'service', label: 'Tiếp nhận' }, { id: 'repair', label: 'Sửa chữa' }, { id: 'maintenance', label: 'Bảo trì' }, { id: 'installation', label: 'Lắp đặt' }, { id: 'demo', label: 'Demo' }];
const queueOptions: { id: QueueFilter; label: string }[] = [{ id: 'all', label: 'Tất cả' }, { id: 'action', label: 'Cần xử lý' }, { id: 'active', label: 'Đang làm' }, { id: 'review', label: 'Chờ duyệt' }, { id: 'closed', label: 'Đã đóng' }];
const kindName: Record<Kind, string> = { service: 'Tiếp nhận thiết bị', repair: 'Sửa chữa', maintenance: 'Bảo trì', installation: 'Lắp đặt', demo: 'Máy demo' };
const shortKindName: Record<Kind, string> = { service: 'Tiếp nhận', repair: 'Sửa chữa', maintenance: 'Bảo trì', installation: 'Lắp đặt', demo: 'Demo' };
const closed = /COMPLETED|INSTALLED|RETURNED|CANCELLED|DONE|HOÀN TẤT|ĐÃ THU HỒI/i;
function isAction(row: TicketRow) { return row.reviewStatus === 'PENDING' || ['PENDING', 'WAITING_PARTS', 'OVERDUE'].includes(row.status); }
function queueMatches(row: TicketRow, queue: Exclude<QueueFilter, 'all'>) {
  if (queue === 'action') return isAction(row);
  if (queue === 'active') return !closed.test(row.status) && !isAction(row);
  if (queue === 'review') return row.reviewStatus === 'PENDING';
  return closed.test(row.status);
}
function getRows(service: ServiceTicket[], work: WorkRow[], demos: DemoLoan[]): TicketRow[] {
  const rows: TicketRow[] = [
    ...service.map((item) => ({ id: item.id, kind: 'service' as const, code: item.ticketCode || item.code || item.id.slice(0, 8), title: item.title || item.deviceName || 'Tiếp nhận thiết bị', status: item.status || 'RECEIVED', reviewStatus: item.reviewStatus, date: item.receivedAt, customer: item.customer?.name, machine: item.machine?.machineCode || item.deviceName, serial: item.serialNumber, raw: item })),
    ...work.map((item) => ({ id: item.id, kind: item.kind, code: item.code || item.id.slice(0, 8), title: item.title || item.machine?.machineModel?.name || kindName[item.kind], status: item.status, reviewStatus: item.reviewStatus, date: item.scheduledDate || item.installedAt || item.reportedAt, customer: item.customer?.name, machine: item.machine?.machineCode || item.machine?.modelName, serial: item.machine?.serialNumber, raw: item })),
    ...demos.map((item) => ({ id: item.id, kind: 'demo' as const, code: item.ticketCode || item.code || item.id.slice(0, 8), title: item.machine?.modelName || item.machine?.name || 'Bàn giao thiết bị demo', status: item.status, reviewStatus: item.reviewStatus, date: item.dueDate || item.handedOverAt, customer: item.customer?.name || item.customer?.hospitalName || undefined, machine: item.machine?.machineCode || item.machine?.serialNumber || undefined, serial: item.machine?.serialNumber || undefined, raw: item })),
  ];
  return rows.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
}

export default function TicketsScreen() {
  const router = useRouter(); const { user } = useAuth(); const userId = user?.id; const isAdmin = /admin|quản trị/i.test(user?.role?.name || ''); const [type, setType] = useState<TypeFilter>('all'); const [queue, setQueue] = useState<QueueFilter>('all'); const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    const [service, work, demos] = await Promise.all([ticketApi.list(), userId ? workApi.listAssigned(userId, isAdmin) : Promise.resolve([]), demoApi.list()]);
    return getRows(service, work, demos);
  }, [userId, isAdmin]);
  const { data, loading, error, refresh } = useResource(load);
  const baseRows = useMemo(() => (data || []).filter((item) => {
    if (type !== 'all' && item.kind !== type) return false;
    return `${item.code} ${item.title} ${item.customer || ''} ${item.machine || ''} ${item.serial || ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
  }), [data, type, query]);
  const rows = useMemo(() => queue === 'all' ? baseRows : baseRows.filter((item) => queueMatches(item, queue)), [baseRows, queue]);
  const queueCounts = useMemo(() => Object.fromEntries(queueOptions.map(({ id }) => [id, id === 'all' ? baseRows.length : baseRows.filter((item) => queueMatches(item, id)).length])) as Record<QueueFilter, number>, [baseRows]);
  const typeCounts = useMemo(() => Object.fromEntries(typeOptions.map(({ id }) => [id, id === 'all' ? (data || []).length : (data || []).filter((item) => item.kind === id).length])) as Record<TypeFilter, number>, [data]);
  function open(item: TicketRow) {
    if (item.kind === 'service') router.push({ pathname: '/ticket/[id]', params: { id: item.id } });
    else if (item.kind === 'demo') router.push({ pathname: '/demo-center', params: { id: item.id } });
    else router.push({ pathname: '/work/[kind]/[id]', params: { kind: item.kind, id: item.id } });
  }

  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={FieldColors.brand} />}>
    <View style={styles.header}><Text style={styles.title}>Phiếu</Text><View style={styles.headerActions}><Pressable accessibilityLabel="Làm mới danh sách phiếu" onPress={() => void refresh()} style={styles.refresh}><FieldIcon name="wifi" color={FieldColors.muted} size={18} /></Pressable><Pressable accessibilityRole="button" onPress={() => router.push('/create-ticket')} style={styles.create}><Text style={styles.plus}>＋</Text><Text style={styles.createTitle}>Tạo phiếu</Text></Pressable></View></View>
    <View style={styles.typeHeading}><Text style={styles.sectionTitle}>Loại phiếu</Text><Text style={styles.count}>{loading ? '…' : `${rows.length} phiếu`}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.types}>{typeOptions.map((item) => <Pressable key={item.id} onPress={() => setType(item.id)} style={[styles.type, type === item.id && [styles.typeActive, { backgroundColor: FieldColors.brandDark, borderColor: FieldColors.brandDark }] ]}><Text style={[styles.typeText, type === item.id && [styles.typeTextActive, { color: "#FFFFFF" }] ]}>{item.label}</Text><Text style={[styles.typeCount, type === item.id && [styles.typeCountActive, { color: "#F4DADD" }] ]}>{loading ? '…' : typeCounts[item.id]}</Text></Pressable>)}</ScrollView>
    <View style={styles.filters}><View style={styles.search}><FieldIcon name="search" size={19} color={FieldColors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Tìm mã phiếu, khách, máy hoặc serial" placeholderTextColor={FieldColors.muted} style={styles.searchInput} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statuses}>{queueOptions.map((item) => <Pressable key={item.id} onPress={() => setQueue(item.id)} style={[styles.statusChip, queue === item.id && [styles.statusActive, { backgroundColor: FieldColors.brandDark }] ]}><Text style={[styles.statusText, queue === item.id && [styles.statusTextActive, { color: "#FFFFFF" }] ]}>{item.label}</Text><Text style={[styles.queueCount, queue === item.id && [styles.queueCountActive, { color: "#F4DADD" }] ]}>{loading ? '…' : queueCounts[item.id]}</Text></Pressable>)}</ScrollView></View>
    <View style={styles.listHead}><View><Text style={styles.sectionTitle}>{type === 'all' ? 'Tất cả phiếu' : kindName[type]}</Text></View></View>
    {loading && !data?.length ? <ActivityIndicator color={FieldColors.brand} style={{ marginVertical: 30 }} /> : null}
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{apiErrorMessage(new Error(error))}</Text><Pressable onPress={() => void refresh()}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : null}
    {!loading && !error && rows.map((item) => <Pressable key={`${item.kind}-${item.id}`} onPress={() => open(item)} style={({ pressed }) => [styles.card, { borderLeftWidth: 4, borderLeftColor: item.kind === 'repair' ? FieldColors.red : item.kind === 'maintenance' ? FieldColors.blue : item.kind === 'installation' ? FieldColors.green : item.kind === 'demo' ? FieldColors.amber : FieldColors.brand }, pressed && styles.cardPressed]}><View style={styles.cardTop}><View style={styles.kindLine}><View style={[styles.dot, { backgroundColor: item.kind === 'repair' ? FieldColors.red : item.kind === 'maintenance' ? FieldColors.blue : item.kind === 'installation' ? FieldColors.green : item.kind === 'demo' ? FieldColors.amber : FieldColors.brand }]} /><Text numberOfLines={1} style={styles.kindLabel}>{shortKindName[item.kind]}</Text><Text numberOfLines={1} style={styles.code}>{item.code}</Text></View><TicketBadge label={item.reviewStatus === 'PENDING' ? reviewLabel(item.reviewStatus) : statusLabel(item.status)} tone={item.reviewStatus === 'PENDING' ? 'amber' : statusTone(item.status)} /></View><View style={styles.cardMain}><View style={styles.cardBody}><Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.customer} numberOfLines={1}>{item.customer || 'Chưa có khách hàng'}</Text><Text style={styles.meta} numberOfLines={1}>{item.machine || item.serial ? `${item.machine || 'Thiết bị'}${item.serial ? ` · S/N ${item.serial}` : ''}` : 'Chưa gắn thiết bị'}</Text></View><View style={styles.cardDate}><Text style={styles.date}>{item.date?.slice(0, 10) || '—'}</Text><Text style={styles.arrow}>›</Text></View></View></Pressable>)}
    {!loading && !error && rows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Không có phiếu phù hợp</Text></View> : null}
  </ScrollView></SafeAreaView>;
}
function statusLabel(status: string) { const map: Record<string, string> = { RECEIVED: 'Đã tiếp nhận', RETURNED: 'Đã trả thiết bị', PENDING: 'Chờ xử lý', ASSIGNED: 'Đã phân công', SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang xử lý', WAITING_PARTS: 'Chờ linh kiện', OVERDUE: 'Quá hạn', COMPLETED: 'Hoàn tất', INSTALLED: 'Đã lắp đặt', CANCELLED: 'Đã hủy', PLANNED: 'Chờ bàn giao', HANDED_OVER: 'Đang demo' }; return map[status] || status.replaceAll('_', ' '); }
function reviewLabel(status: string) { return ({ PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', NEEDS_REVISION: 'Cần bổ sung' } as Record<string, string>)[status] || status.replaceAll('_', ' '); }
function statusTone(status: string): 'blue' | 'green' | 'amber' | 'red' | 'neutral' { if (/COMPLETED|INSTALLED|RETURNED|DONE/i.test(status)) return 'green'; if (/OVERDUE|CANCELLED/i.test(status)) return 'red'; if (/IN_PROGRESS|WAITING|HANDED_OVER/i.test(status)) return 'amber'; return 'blue'; }
function TicketBadge({ label, tone }: { label: string; tone: ReturnType<typeof statusTone> }) {
  const palette = { blue: [FieldColors.blueSoft, FieldColors.blue], green: [FieldColors.greenSoft, FieldColors.green], amber: [FieldColors.amberSoft, '#875A12'], red: [FieldColors.redSoft, FieldColors.red], neutral: ['#F5F4F1', FieldColors.muted] } as const;
  const [backgroundColor, color] = palette[tone];
  return <View style={[styles.ticketBadge, { backgroundColor }]}><Text numberOfLines={1} style={[styles.ticketBadgeText, { color }]}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 13, padding: 16, paddingBottom: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }, headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 }, title: { color: FieldColors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  refresh: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 12, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  typeHeading: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }, sectionTitle: { color: FieldColors.ink, fontSize: 16, fontWeight: '700' }, count: { color: FieldColors.muted, fontSize: 13, fontWeight: '600' },
  types: { gap: 8, paddingVertical: 1 }, type: { alignItems: 'center', backgroundColor: '#E9E8E5', borderRadius: 12, flexDirection: 'row', gap: 7, minHeight: 42, paddingHorizontal: 13 }, typeActive: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderWidth: 1 }, typeText: { color: FieldColors.muted, fontSize: 12, fontWeight: '600' }, typeTextActive: { color: FieldColors.brandDark, fontWeight: '700' }, typeCount: { color: FieldColors.muted, fontSize: 12, fontWeight: '600' }, typeCountActive: { color: FieldColors.brand },
  filters: { gap: 9 }, search: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 48, paddingHorizontal: 13 }, searchInput: { color: FieldColors.ink, flex: 1, fontSize: 14 }, statuses: { gap: 5 }, statusChip: { alignItems: 'center', borderRadius: 10, flexDirection: 'row', gap: 7, minHeight: 38, paddingHorizontal: 10 }, statusActive: { backgroundColor: FieldColors.brandSoft }, statusText: { color: FieldColors.muted, fontSize: 13, fontWeight: '600' }, statusTextActive: { color: FieldColors.brandDark }, queueCount: { color: FieldColors.muted, fontSize: 12, fontWeight: '700' }, queueCountActive: { color: FieldColors.brandDark },
  modalShade: { backgroundColor: 'rgba(20,25,27,0.38)', flex: 1, justifyContent: 'flex-end' }, modalBackdrop: { ...StyleSheet.absoluteFill }, createSheet: { backgroundColor: FieldColors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8, paddingBottom: 30, paddingHorizontal: 18, paddingTop: 10 }, sheetHandle: { alignSelf: 'center', backgroundColor: '#D5D2CD', borderRadius: 3, height: 5, marginBottom: 5, width: 38 }, sheetHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, sheetTitle: { color: FieldColors.ink, fontSize: 20, fontWeight: '800' }, closeButton: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 20, height: 38, justifyContent: 'center', width: 38 }, closeText: { color: FieldColors.muted, fontSize: 24, lineHeight: 27 }, createOption: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 58, paddingHorizontal: 13 }, createOptionPressed: { opacity: 0.72 }, createDot: { borderRadius: 7, height: 12, width: 12 }, createOptionBody: { flex: 1 }, createOptionTitle: { color: FieldColors.ink, fontSize: 15, fontWeight: '700' },
  create: { alignItems: 'center', backgroundColor: FieldColors.brandDark, borderRadius: 12, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 14 }, plus: { color: '#fff', fontSize: 20, marginTop: -2 }, createTitle: { color: '#fff', fontSize: 13, fontWeight: '700' }, arrow: { color: FieldColors.muted, fontSize: 22 }, listHead: { marginTop: 1 },
  card: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 14, borderWidth: 1, gap: 8, paddingHorizontal: 13, paddingVertical: 11 }, ticketBadge: { borderRadius: 8, maxWidth: 122, paddingHorizontal: 9, paddingVertical: 6 }, ticketBadgeText: { fontSize: 11, fontWeight: '700' }, cardPressed: { opacity: 0.78 }, cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, kindLine: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 6 }, dot: { borderRadius: 4, height: 8, width: 8 }, kindLabel: { color: FieldColors.ink, fontSize: 12, fontWeight: '600' }, code: { color: FieldColors.muted, flexShrink: 1, fontSize: 12, fontWeight: '600', letterSpacing: 0.1 }, date: { color: FieldColors.muted, fontSize: 11, fontWeight: '500' }, cardMain: { alignItems: 'center', flexDirection: 'row', gap: 8 }, cardBody: { flex: 1, gap: 3 }, cardDate: { alignItems: 'flex-end', alignSelf: 'stretch', justifyContent: 'space-between' }, cardTitle: { color: FieldColors.ink, fontSize: 15, fontWeight: '700' }, customer: { color: FieldColors.ink, fontSize: 13, fontWeight: '500' }, meta: { color: FieldColors.muted, flex: 1, fontSize: 12 },
  empty: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 16, padding: 22 }, emptyTitle: { color: FieldColors.ink, fontSize: 15, fontWeight: '700' }, emptyHint: { color: FieldColors.muted, fontSize: 12, marginTop: 5 }, errorBox: { backgroundColor: FieldColors.redSoft, borderRadius: 13, padding: 14 }, errorText: { color: FieldColors.red, fontSize: 13 }, retry: { color: FieldColors.brand, fontSize: 13, fontWeight: '700', marginTop: 8 },
});
