import { Text } from '@/components/text';
import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { workApi, WorkRow } from '@/api/work.api';
import { useResource } from '@/hooks/use-resource';
import { useAuth } from '@/contexts/auth-context';
import { Eyebrow, FieldIcon, StatusPill } from '@/components/field-ui';
import { FieldColors } from '@/constants/field-theme';

const todayKey = localDateKey(new Date());
const closed = new Set(['COMPLETED', 'INSTALLED', 'CANCELLED']);
const kindLabel = { repair: 'Sửa chữa', maintenance: 'Bảo trì', installation: 'Lắp đặt' } as const;
const quickLinks = [
  { label: 'Khách hàng', icon: 'user', href: '/customer-directory', tint: FieldColors.brand, background: FieldColors.brandSoft },
  { label: 'Máy demo', icon: 'machine', href: '/demo-center', tint: FieldColors.amber, background: FieldColors.amberSoft },
  { label: 'Báo cáo ngày', icon: 'document', href: '/daily-report', tint: FieldColors.blue, background: FieldColors.blueSoft },
  { label: 'Kho kiến thức', icon: 'headset', href: '/knowledge', tint: FieldColors.green, background: FieldColors.greenSoft },
] as const;

export default function HomeScreen() {
  const { user } = useAuth();
  const userId = user?.id;
  const isAdmin = /admin|quản trị/i.test(user?.role?.name || '');
  const load = useCallback(() => userId ? workApi.listAssigned(userId, isAdmin) : Promise.resolve([]), [userId, isAdmin]);
  const { data, loading, error, refresh } = useResource(load);
  const active = useMemo(() => (data || []).filter((work) => !closed.has(work.status)), [data]);
  const todays = useMemo(() => active.filter((work) => localDateKey(new Date(work.scheduledDate || work.installedAt || work.reportedAt || '')) === todayKey), [active]);
  const focus = todays.length ? todays : active.slice(0, 4);
  const greeting = user?.fullName?.trim().split(/\s+/).slice(-1)[0] || 'bạn';
  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={FieldColors.brand} />}>
    <View style={styles.top}><View style={styles.brandRow}><Image source={require('../../assets/images/vietmed-shield.png')} style={styles.logo} /><View><Text style={styles.brand}>VIETMED KỸ THUẬT</Text><Text style={styles.date}>{date}</Text></View></View><Pressable onPress={() => router.push('/profile')} style={styles.avatar}><Text style={styles.avatarText}>{(user?.fullName || user?.email || 'KT').slice(0, 1).toLocaleUpperCase('vi')}</Text></Pressable></View>
    <View style={styles.intro}><Text style={styles.hello}>Chào {greeting},</Text><Text style={styles.prompt}>Hôm nay bạn cần xử lý gì?</Text></View>
    <View style={[styles.todayCard, { backgroundColor: FieldColors.brandDark, borderRadius: 24, padding: 20 }]}><View style={styles.todayTop}><View><Eyebrow color="#E8C7CA">HÔM NAY</Eyebrow><Text style={[styles.todayCount, { color: "#FFFFFF", fontSize: 38 }]}>{loading ? '—' : todays.length}<Text style={[styles.todayCountLabel, { color: "#E8C7CA" }]}> lịch hẹn</Text></Text></View><Pressable accessibilityLabel="Mở lịch công việc" onPress={() => router.push('/tasks')} style={[styles.calendarAction, { backgroundColor: "rgba(255,255,255,0.16)", height: 46, width: 46 }]}><FieldIcon name="calendar" color="#FFFFFF" size={20} /></Pressable></View><View style={[styles.metrics, { borderTopColor: "rgba(255,255,255,0.22)" }]}><Metric label="Đang mở" value={loading ? '—' : String(active.length)} /><View style={[styles.metricDivider, { backgroundColor: "rgba(255,255,255,0.22)" }]} /><Metric label="Được giao" value={loading ? '—' : String(data?.length || 0)} /></View></View>
    <Pressable accessibilityRole="button" onPress={() => router.push('/create-ticket')} style={({ pressed }) => [styles.createAction, pressed && styles.createActionPressed]}>
      <View style={styles.createIcon}><FieldIcon name="plus" color="#FFFFFF" size={20} /></View>
      <View style={styles.createCopy}><Text style={styles.createTitle}>Tạo phiếu mới</Text><Text style={styles.createHint}>Tiếp nhận, sửa chữa, bảo trì, lắp đặt hoặc demo</Text></View>
      <FieldIcon name="chevron" color="#FFFFFF" size={17} />
    </Pressable>
    <View style={styles.quickSection}>
      <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
      <View style={styles.quickGrid}>{quickLinks.map((item) => <Pressable key={item.href} accessibilityRole="button" onPress={() => router.push(item.href)} style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}>
        <View style={[styles.quickIcon, { backgroundColor: item.background }]}><FieldIcon name={item.icon} color={item.tint} size={19} /></View>
        <Text style={styles.quickLabel}>{item.label}</Text>
        <FieldIcon name="chevron" color={FieldColors.muted} size={13} />
      </Pressable>)}</View>
    </View>
    <View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>{todays.length ? 'Lịch làm việc hôm nay' : 'Việc cần ưu tiên'}</Text></View><Pressable onPress={() => router.push('/tasks')}><Text style={styles.link}>Tất cả</Text></Pressable></View>
    {loading ? <ActivityIndicator color={FieldColors.brand} style={{ marginVertical: 24 }} /> : null}
    {error ? <Pressable onPress={() => void refresh()} style={styles.errorBox}><Text style={styles.errorText}>Không tải được lịch công việc. Chạm để thử lại.</Text></Pressable> : null}
    {!loading && !error && focus.map((work) => <WorkCard key={`${work.kind}-${work.id}`} item={work} />)}
    {!loading && !error && !focus.length ? <View style={styles.empty}><View style={styles.emptyIcon}><FieldIcon name="check" color={FieldColors.green} size={21} /></View><Text style={styles.emptyTitle}>Hôm nay chưa có công việc</Text></View> : null}
  </ScrollView></SafeAreaView>;
}

function WorkCard({ item }: { item: WorkRow }) {
  const date = item.scheduledDate || item.installedAt || item.reportedAt;
  return <Pressable onPress={() => router.push({ pathname: '/work/[kind]/[id]', params: { kind: item.kind, id: item.id } })} style={styles.workCard}>
    <View style={styles.workAccent} /><View style={styles.workBody}><View style={styles.workTop}><Text style={styles.kind}>{kindLabel[item.kind]}</Text><StatusPill label={item.status.replaceAll('_', ' ')} tone={item.status === 'COMPLETED' ? 'green' : item.status === 'OVERDUE' ? 'red' : 'amber'} /></View><Text style={styles.workTitle} numberOfLines={2}>{item.title || item.machine?.machineModel?.name || kindLabel[item.kind]}</Text><Text style={styles.workCustomer} numberOfLines={1}>{item.customer?.name || 'Chưa có khách hàng'}</Text><View style={styles.workMeta}><Text style={styles.metaText}>{item.code || 'Chưa có mã phiếu'}</Text><Text style={styles.metaText}>{date ? date.slice(0, 10) : 'Chưa lên lịch'}</Text></View></View><Text style={styles.arrow}>›</Text>
  </Pressable>;
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={{ flex: 1 }}><Text style={[styles.metricValue, { color: "#FFFFFF", fontSize: 18 }]}>{value}</Text><Text style={[styles.metricLabel, { color: "#E8C7CA" }]}>{label}</Text></View>; }
function localDateKey(date: Date) { if (Number.isNaN(date.getTime())) return ''; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

const styles = StyleSheet.create({ safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 17, padding: 16, paddingBottom: 30 }, top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, brandRow: { alignItems: 'center', flexDirection: 'row', gap: 9 }, logo: { height: 31, width: 31, resizeMode: 'contain' }, brand: { color: FieldColors.ink, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 }, date: { color: FieldColors.muted, fontSize: 10, marginTop: 4, textTransform: 'capitalize' }, avatar: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 15, height: 40, justifyContent: 'center', width: 40 }, avatarText: { color: FieldColors.brand, fontSize: 14, fontWeight: '700' }, intro: { gap: 3, marginTop: 4 }, hello: { color: FieldColors.ink, fontSize: 25, fontWeight: '700', letterSpacing: -0.6 }, prompt: { color: FieldColors.muted, fontSize: 13 }, todayCard: { backgroundColor: FieldColors.surface, borderRadius: 22, gap: 15, padding: 17 }, todayTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, todayCount: { color: FieldColors.brandDark, fontSize: 32, fontWeight: '800', letterSpacing: -0.7, marginTop: 4 }, todayCountLabel: { color: FieldColors.muted, fontSize: 13, fontWeight: '500' }, calendarAction: { alignItems: 'center', backgroundColor: FieldColors.brandSoft, borderRadius: 14, height: 40, justifyContent: 'center', width: 40 }, metrics: { borderTopColor: FieldColors.line, borderTopWidth: 1, flexDirection: 'row', paddingTop: 12 }, metricDivider: { backgroundColor: FieldColors.line, marginHorizontal: 14, width: 1 }, metricValue: { color: FieldColors.ink, fontSize: 15, fontWeight: '700' }, metricLabel: { color: FieldColors.muted, fontSize: 12, marginTop: 2 }, createAction: { alignItems: 'center', backgroundColor: FieldColors.brand, borderRadius: 17, flexDirection: 'row', gap: 12, minHeight: 74, paddingHorizontal: 14, paddingVertical: 12 }, createActionPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] }, createIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 13, height: 42, justifyContent: 'center', width: 42 }, createCopy: { flex: 1, gap: 4 }, createTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, createHint: { color: '#F8E9EA', fontSize: 11, lineHeight: 15 }, quickSection: { gap: 10 }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, quickLink: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 54, paddingHorizontal: 10, width: '48%' }, quickLinkPressed: { opacity: 0.75 }, quickIcon: { alignItems: 'center', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 }, quickLabel: { color: FieldColors.ink, flex: 1, fontSize: 12, fontWeight: '600' }, sectionHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }, sectionTitle: { color: FieldColors.ink, fontSize: 16, fontWeight: '700' }, sectionHint: { color: FieldColors.muted, fontSize: 10, marginTop: 3 }, link: { color: FieldColors.brand, fontSize: 12, fontWeight: '700' }, workCard: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 17, flexDirection: 'row', gap: 10, padding: 13 }, workAccent: { alignSelf: 'stretch', backgroundColor: FieldColors.brand, borderRadius: 2, width: 2 }, workBody: { flex: 1, gap: 6 }, workTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, kind: { color: FieldColors.brand, fontSize: 12, fontWeight: '700' }, workTitle: { color: FieldColors.ink, fontSize: 14, fontWeight: '700' }, workCustomer: { color: FieldColors.muted, fontSize: 11 }, workMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 }, metaText: { color: FieldColors.muted, fontSize: 9 }, arrow: { color: FieldColors.muted, fontSize: 20 }, empty: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 18, gap: 8, padding: 22 }, emptyIcon: { alignItems: 'center', backgroundColor: FieldColors.greenSoft, borderRadius: 15, height: 38, justifyContent: 'center', width: 38 }, emptyTitle: { color: FieldColors.ink, fontSize: 13, fontWeight: '700' }, emptyHint: { color: FieldColors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' }, errorBox: { backgroundColor: FieldColors.redSoft, borderRadius: 13, padding: 13 }, errorText: { color: FieldColors.red, fontSize: 11 } });
