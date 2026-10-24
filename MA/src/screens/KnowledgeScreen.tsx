import { Text, TextInput } from '@/components/text';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiErrorMessage } from '@/api/client';
import { KnowledgeArticle, knowledgeApi } from '@/api/knowledge.api';
import { FieldColors } from '@/constants/field-theme';

const categories: Record<string, string> = { COMMON_FAULT: 'Lỗi thường gặp', PACKING: 'Đóng hàng', REPAIR: 'Sửa chữa', INSTALLATION: 'Lắp đặt', MAINTENANCE: 'Bảo trì', SAFETY: 'An toàn', OTHER: 'Kinh nghiệm khác' };
export default function KnowledgeScreen() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]); const [query, setQuery] = useState(''); const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async (search: string) => { setLoading(true); setError(''); try { const rows = await knowledgeApi.list(search); setArticles(rows); setSelected((current) => rows.some((item) => item.id === current) ? current : ''); } catch (cause) { setError(apiErrorMessage(cause)); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = setTimeout(() => { void load(query.trim()); }, query ? 300 : 0); return () => clearTimeout(timer); }, [load, query]);
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <Text onPress={() => router.back()} style={styles.back}>‹  Hôm nay</Text><Text style={styles.eyebrow}>THƯ VIỆN KỸ THUẬT</Text><Text style={styles.title}>Chia sẻ kinh nghiệm</Text>
    <TextInput value={query} onChangeText={setQuery} placeholder="Tìm lỗi, model hoặc quy trình..." style={styles.search} />
    {error ? <Text style={styles.error}>{error}</Text> : null}{loading ? <ActivityIndicator color={FieldColors.brand} /> : <Text style={styles.count}>{articles.length} bài đã xuất bản</Text>}
    {articles.map((article) => <View key={article.id} style={styles.card}>
      <Pressable onPress={() => setSelected((current) => current === article.id ? '' : article.id)} style={styles.cardHead}>
        <View style={{ flex: 1, gap: 5 }}><Text style={styles.category}>{categories[article.category] || article.category}</Text><Text style={styles.articleTitle}>{article.title}</Text>{article.modelHint ? <Text style={styles.model}>{article.modelHint}</Text> : null}<Text style={styles.summary}>{article.summary || ''}</Text></View><Text style={styles.expand}>{selected === article.id ? '−' : '+'}</Text>
      </Pressable>
      {selected === article.id ? <View style={styles.details}>
        {article.symptoms?.length ? <ListBlock title="Dấu hiệu" rows={article.symptoms} /> : null}
        {article.steps?.length ? <ListBlock title="Các bước xử lý" rows={article.steps} numbered /> : null}
        {article.checklist?.length ? <ListBlock title="Checklist" rows={article.checklist} /> : null}
        {article.content ? <Text style={styles.body}>{article.content}</Text> : null}
        {article.tags?.length ? <Text style={styles.tags}>{article.tags.map((tag) => `#${tag}`).join('  ')}</Text> : null}
        <Text style={styles.byline}>{article.createdBy?.fullName || 'Nhóm kỹ thuật'}</Text>
      </View> : null}
    </View>)}
    {!loading && !error && articles.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Chưa tìm thấy bài phù hợp</Text><Text style={styles.summary}>Thử từ khóa khác hoặc tải lại danh sách sau.</Text></View> : null}
  </ScrollView></SafeAreaView>;
}
function ListBlock({ title, rows, numbered = false }: { title: string; rows: string[]; numbered?: boolean }) { return <View style={styles.block}><Text style={styles.blockTitle}>{title}</Text>{rows.map((row, index) => <Text key={`${index}-${row}`} style={styles.body}>{numbered ? `${index + 1}. ` : '• '}{row}</Text>)}</View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: FieldColors.canvas }, content: { padding: 19, paddingBottom: 35, gap: 12 }, back: { color: FieldColors.brand, fontSize: 12, fontWeight: '700' }, eyebrow: { color: FieldColors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 4 }, title: { color: FieldColors.ink, fontSize: 29, fontWeight: '800' }, search: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderWidth: 1, borderRadius: 12, minHeight: 45, paddingHorizontal: 12, fontSize: 12, color: FieldColors.ink }, count: { color: FieldColors.muted, fontSize: 13, fontWeight: '700' }, card: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderWidth: 1, borderRadius: 15, padding: 13 }, cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, category: { color: FieldColors.brand, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }, articleTitle: { color: FieldColors.ink, fontSize: 14, fontWeight: '800', lineHeight: 19 }, model: { color: FieldColors.blue, fontSize: 10, fontWeight: '700' }, summary: { color: FieldColors.muted, fontSize: 11, lineHeight: 16 }, expand: { color: FieldColors.brand, fontSize: 21, fontWeight: '500', paddingHorizontal: 5 }, details: { borderTopColor: FieldColors.line, borderTopWidth: 1, gap: 11, marginTop: 11, paddingTop: 11 }, block: { gap: 5 }, blockTitle: { color: FieldColors.ink, fontSize: 11, fontWeight: '800' }, body: { color: '#20272B', fontSize: 11, lineHeight: 17 }, tags: { color: FieldColors.blue, fontSize: 10 }, byline: { color: FieldColors.muted, fontSize: 9, textAlign: 'right' }, empty: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 15, padding: 22, gap: 6 }, emptyTitle: { color: FieldColors.ink, fontSize: 13, fontWeight: '800' }, error: { color: FieldColors.red, fontSize: 11 } });
