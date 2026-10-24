import { Text } from '@/components/text';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FieldIcon, FieldIconName } from '@/components/field-ui';
import { FieldColors } from '@/constants/field-theme';

const options: { id: string; title: string; icon: FieldIconName; color: string; action: () => void }[] = [
  { id: 'service', title: 'Tiếp nhận thiết bị', icon: 'document', color: FieldColors.brand, action: () => router.push('/service-ticket-create') },
  { id: 'repair', title: 'Sửa chữa', icon: 'tool', color: FieldColors.red, action: () => router.push({ pathname: '/work-create', params: { kind: 'repair' } }) },
  { id: 'maintenance', title: 'Bảo trì', icon: 'calendar', color: FieldColors.blue, action: () => router.push({ pathname: '/work-create', params: { kind: 'maintenance' } }) },
  { id: 'installation', title: 'Lắp đặt', icon: 'machine', color: FieldColors.green, action: () => router.push('/installation-form') },
  { id: 'demo', title: 'Máy demo', icon: 'machine', color: FieldColors.amber, action: () => router.push('/demo-create') },
];

export default function TicketCreateMenuScreen() {
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()} style={styles.back}><FieldIcon name="chevron" size={17} color={FieldColors.ink} /><Text style={styles.backText}>Quay lại Phiếu</Text></Pressable>
    <View style={styles.hero}><Text style={styles.eyebrow}>VIETMED KỸ THUẬT</Text><Text style={styles.title}>Tạo phiếu</Text><View style={styles.heroMark}><FieldIcon name="plus" size={22} color="#FFFFFF" /></View></View>
    <Text style={styles.sectionTitle}>Loại phiếu</Text>
    <View style={styles.options}>{options.map((item, index) => <Pressable key={item.id} onPress={item.action} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      <View style={[styles.icon, { backgroundColor: `${item.color}16` }]}><FieldIcon name={item.icon} size={21} color={item.color} /></View>
      <View style={styles.copy}><Text style={styles.optionTitle}>{item.title}</Text></View>
      <View style={styles.trailing}><Text style={styles.number}>0{index + 1}</Text><FieldIcon name="chevron" size={16} color={FieldColors.muted} /></View>
    </Pressable>)}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: FieldColors.canvas }, content: { gap: 18, padding: 18, paddingBottom: 34 },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, minHeight: 38 }, backText: { color: FieldColors.ink, fontSize: 14, fontWeight: '600' },
  hero: { backgroundColor: FieldColors.brandDark, borderRadius: 25, minHeight: 160, justifyContent: 'center', overflow: 'hidden', padding: 22 },
  eyebrow: { color: '#E8C7CA', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }, title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 10 }, description: { color: '#F0DDE0', fontSize: 14, marginTop: 5 },
  heroMark: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, height: 48, justifyContent: 'center', position: 'absolute', right: 20, top: 20, width: 48 },
  sectionTitle: { color: FieldColors.ink, fontSize: 18, fontWeight: '700', marginTop: 2 }, options: { gap: 10 },
  option: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 18, flexDirection: 'row', gap: 13, minHeight: 82, paddingHorizontal: 14, paddingVertical: 13 }, icon: { alignItems: 'center', borderRadius: 15, height: 48, justifyContent: 'center', width: 48 }, copy: { flex: 1, gap: 5 }, optionTitle: { color: FieldColors.ink, fontSize: 16, fontWeight: '700' }, subtitle: { color: FieldColors.muted, fontSize: 12, lineHeight: 17 },
  trailing: { alignItems: 'center', flexDirection: 'row', gap: 7 }, number: { color: FieldColors.muted, fontSize: 10, fontWeight: '700' }, pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
