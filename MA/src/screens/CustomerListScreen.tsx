import { Text, TextInput } from '@/components/text';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { customerApi } from '@/api/customer.api';
import { FieldColors } from '@/constants/field-theme';
import { Eyebrow } from '@/components/field-ui';
import { useResource } from '@/hooks/use-resource';

export default function CustomersScreen() {
  const [query, setQuery] = useState(''); const { data, loading, error } = useResource(customerApi.list);
  const rows = useMemo(() => (data || []).filter((item) => `${item.name} ${item.phone || ''} ${item.address || ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))), [data, query]);
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><View><Eyebrow>HỒ SƠ KHÁCH HÀNG</Eyebrow><Text style={styles.title}>Khách hàng</Text></View><Link href="/customer-create" asChild><Pressable style={styles.add}><Text style={styles.addText}>＋ Thêm</Text></Pressable></Link></View>
    <TextInput value={query} onChangeText={setQuery} placeholder="Tìm tên, số điện thoại..." style={styles.search} />
    {loading ? <ActivityIndicator color={FieldColors.brand} style={{ marginTop: 30 }} /> : null}{error ? <Text style={styles.error}>{error}</Text> : null}
    {rows.map((item) => <Link key={item.id} href={{ pathname: '/customer/[id]', params: { id: item.id } }} asChild><Pressable style={styles.card}><View style={styles.initial}><Text style={styles.initialText}>{item.name.slice(0, 1).toLocaleUpperCase('vi')}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.phone || item.contactPhone || 'Chưa có số điện thoại'}</Text><Text numberOfLines={1} style={styles.address}>{item.fullAddress || item.address || 'Chưa có địa chỉ'}</Text></View><Text style={styles.arrow}>›</Text></Pressable></Link>)}
    {!loading && !error && rows.length === 0 ? <Text style={styles.empty}>Không tìm thấy khách hàng.</Text> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { backgroundColor: FieldColors.canvas, flex: 1 }, content: { gap: 14, padding: 16, paddingBottom: 30 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, title: { color: FieldColors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.55, marginTop: 4 }, subtitle: { color: FieldColors.muted, fontSize: 12, marginTop: 5 }, add: { backgroundColor: FieldColors.brandDark, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 }, addText: { color: '#fff', fontSize: 14, fontWeight: '700' }, search: { backgroundColor: FieldColors.surface, borderRadius: 14, color: FieldColors.ink, fontSize: 13, minHeight: 48, paddingHorizontal: 14 }, card: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 17, flexDirection: 'row', gap: 11, padding: 14, shadowColor: '#24262A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 }, initial: { alignItems: 'center', backgroundColor: FieldColors.brandSoft, borderRadius: 14, height: 41, justifyContent: 'center', width: 41 }, initialText: { color: FieldColors.brand, fontSize: 14, fontWeight: '700' }, name: { color: FieldColors.ink, fontSize: 14, fontWeight: '700' }, meta: { color: FieldColors.muted, fontSize: 11 }, address: { color: FieldColors.muted, fontSize: 12, lineHeight: 15 }, arrow: { color: FieldColors.muted, fontSize: 21 }, error: { color: FieldColors.red }, empty: { color: FieldColors.muted, paddingVertical: 25, textAlign: 'center' } });
