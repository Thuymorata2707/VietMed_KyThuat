import { Text } from '@/components/text';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiErrorMessage, API_BASE_URL } from '@/api/client';
import { attachmentApi, LocalPhoto, WorkAttachment } from '@/api/attachment.api';
import { readToken } from '@/services/token-storage';
import { FieldColors } from '@/constants/field-theme';

export function RepairPhotosField({ entityId, entityType = 'Repair', photos, onChange }: { entityId?: string; entityType?: string; photos: LocalPhoto[]; onChange: (photos: LocalPhoto[]) => void }) {
  const [saved, setSaved] = useState<WorkAttachment[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function reload() {
    if (!entityId) return;
    try { setSaved(await attachmentApi.list(entityId, entityType)); setError(''); }
    catch (cause) { setError(apiErrorMessage(cause)); }
  }
  useEffect(() => { void readToken().then(setToken); }, []);
  useEffect(() => {
    if (!entityId) return;
    let active = true;
    void attachmentApi.list(entityId, entityType).then((items) => { if (active) setSaved(items); }).catch((cause) => { if (active) setError(apiErrorMessage(cause)); });
    return () => { active = false; };
  }, [entityId, entityType]);

  async function addFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 8, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible, quality: 0.82 });
    if (!result.canceled) onChange([...photos, ...result.assets.map((asset) => ({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, fileSize: asset.fileSize }))]);
  }
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert('Cần quyền camera', 'Cho phép VietMed chụp ảnh tình trạng thiết bị.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!result.canceled) onChange([...photos, ...result.assets.map((asset) => ({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, fileSize: asset.fileSize }))]);
  }
  async function upload() {
    if (!entityId || !photos.length) return;
    setBusy(true); setError('');
    let uploaded = 0;
    try {
      for (const photo of photos) { await attachmentApi.upload(entityId, photo, entityType); uploaded += 1; }
      onChange([]); await reload();
    } catch (cause) { onChange(photos.slice(uploaded)); setError(apiErrorMessage(cause)); await reload(); }
    finally { setBusy(false); }
  }
  async function removeSaved(item: WorkAttachment) {
    setBusy(true); setError('');
    try { await attachmentApi.remove(item.id); await reload(); }
    catch (cause) { setError(apiErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <View style={styles.wrap}>
    <View style={styles.heading}><Text style={styles.title}>Ảnh hiện trường</Text><Text style={styles.count}>{saved.length + photos.length}</Text></View>
    <View style={styles.actions}>
      <Pressable disabled={busy} onPress={() => void takePhoto()} style={styles.action}><Text style={styles.actionText}>Chụp ảnh</Text></Pressable>
      <Pressable disabled={busy} onPress={() => void addFromLibrary()} style={styles.action}><Text style={styles.actionText}>Chọn ảnh</Text></Pressable>
    </View>
    {photos.length ? <View style={styles.grid}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.tile}><Image source={{ uri: photo.uri }} style={styles.image} /><Pressable accessibilityLabel="Xóa ảnh đã chọn" onPress={() => onChange(photos.filter((_, itemIndex) => itemIndex !== index))} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable></View>)}</View> : null}
    {saved.length ? <View style={styles.grid}>{saved.map((item) => <View key={item.id} style={styles.tile}><Image source={{ uri: `${API_BASE_URL}${item.url}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={styles.image} /><Pressable accessibilityLabel="Xóa ảnh đã tải lên" disabled={busy} onPress={() => void removeSaved(item)} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable></View>)}</View> : null}
    {entityId && photos.length ? <Pressable disabled={busy} onPress={() => void upload()} style={styles.upload}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadText}>Tải {photos.length} ảnh lên phiếu</Text>}</Pressable> : null}
    {busy && !photos.length ? <ActivityIndicator color={FieldColors.brand} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({ wrap: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 14, borderWidth: 1, gap: 11, padding: 12 }, heading: { alignItems: 'center', flexDirection: 'row', gap: 7 }, title: { color: FieldColors.ink, flex: 1, fontSize: 13, fontWeight: '700' }, count: { color: FieldColors.muted, fontSize: 11 }, actions: { flexDirection: 'row', gap: 8 }, action: { alignItems: 'center', backgroundColor: FieldColors.brandSoft, borderRadius: 10, flex: 1, minHeight: 40, justifyContent: 'center' }, actionText: { color: FieldColors.brandDark, fontSize: 12, fontWeight: '700' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tile: { borderRadius: 11, height: 84, overflow: 'hidden', position: 'relative', width: 84 }, image: { backgroundColor: FieldColors.canvas, height: '100%', width: '100%' }, remove: { alignItems: 'center', backgroundColor: 'rgba(25,25,25,0.78)', borderRadius: 12, height: 24, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 24 }, removeText: { color: '#fff', fontSize: 19, lineHeight: 21 }, upload: { alignItems: 'center', backgroundColor: FieldColors.brand, borderRadius: 10, justifyContent: 'center', minHeight: 42 }, uploadText: { color: '#fff', fontSize: 12, fontWeight: '800' }, error: { color: FieldColors.red, fontSize: 11 } });
