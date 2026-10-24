import { Text } from '@/components/text';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { apiErrorMessage, API_BASE_URL } from '@/api/client';
import { AppUser, authApi } from '@/api/auth.api';
import { Eyebrow, FieldIcon, StatusPill } from '@/components/field-ui';
import { FieldColors } from '@/constants/field-theme';
import { useAuth } from '@/contexts/auth-context';
import { readToken } from '@/services/token-storage';

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : '';
const expertiseLabel: Record<string, string> = { IMAGING: 'Chẩn đoán hình ảnh', LAB_TESTING: 'Xét nghiệm' };

function roleLabel(value?: string) {
  const role = value?.trim().toLocaleLowerCase('vi');
  if (role === 'admin' || role === 'administrator') return 'Quản trị viên';
  if (role === 'engineer' || role === 'kỹ sư') return 'Kỹ sư';
  if (role === 'manager' || role === 'quản lý') return 'Quản lý';
  return value || 'Tài khoản VietMed';
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user: sessionUser, signOut } = useAuth();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const current = await authApi.me();
      setUser(current);
      setError('');
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); return undefined; }, [load]));
  useEffect(() => { void readToken().then(setToken); }, []);

  const currentUser = user || sessionUser;
  const profile = currentUser?.engineerProfile;
  const displayName = currentUser?.fullName || currentUser?.email || 'Tài khoản VietMed';
  const initials = displayName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi') || 'VM';
  const photo = profile?.photoUrl
    ? (/^https?:\/\//i.test(profile.photoUrl) ? profile.photoUrl : `${API_BASE_URL}${profile.photoUrl.startsWith('/') ? '' : '/'}${profile.photoUrl}`)
    : '';
  const expertise = (profile?.expertiseGroups?.length ? profile.expertiseGroups : profile?.expertiseGroup ? [profile.expertiseGroup] : [])
    .map((item) => expertiseLabel[item] || item)
    .join(' · ');
  const workRows = [
    ['Mã nhân viên', profile?.employeeCode],
    ['Chức vụ', profile?.position],
    ['Phòng ban', profile?.department],
    ['Nhóm chuyên môn', expertise],
    ['Chuyên môn', profile?.specialties?.join(' · ')],
    ['Chứng chỉ', profile?.certificateNo],
    ['Ngày vào làm', formatDate(profile?.workStartDate)],
    ['Ngày sinh', formatDate(profile?.dateOfBirth)],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  async function choosePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Cho phép VietMed chọn ảnh đại diện từ thư viện.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.82 });
    if (result.canceled || !result.assets[0] || !currentUser) return;
    setPhotoBusy(true);
    setPhotoFailed(false);
    setError('');
    try {
      const uploaded = await authApi.uploadProfilePhoto(currentUser.id, result.assets[0]);
      await authApi.updateMe({ engineerProfile: { photoUrl: uploaded.url } });
      await load();
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setPhotoBusy(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Đăng xuất tài khoản?', 'Bạn sẽ cần đăng nhập lại để tiếp tục.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && Boolean(currentUser)} onRefresh={() => void load()} tintColor={FieldColors.brand} />}
      >
        <View style={styles.topline}>
          <View><Eyebrow>TÀI KHOẢN</Eyebrow><Text style={styles.title}>Cá nhân</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Làm mới hồ sơ" onPress={() => void load()} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
            <FieldIcon name="wifi" size={17} color={FieldColors.brand} />
          </Pressable>
        </View>

        {loading && !currentUser ? <ActivityIndicator color={FieldColors.brand} style={styles.loader} /> : null}
        {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : null}

        <View style={styles.hero}>
          <Pressable accessibilityRole="button" accessibilityLabel="Đổi ảnh đại diện" disabled={photoBusy} onPress={() => void choosePhoto()} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
            {photo && !photoFailed ? <Image onError={() => setPhotoFailed(true)} source={{ uri: photo, headers: token ? { Authorization: `Bearer ${token}` } : undefined }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}
            <View style={styles.cameraBadge}>{photoBusy ? <ActivityIndicator color="#fff" size="small" /> : <FieldIcon name="tool" size={13} color="#fff" />}</View>
          </Pressable>
          <View style={styles.identity}>
            <Text numberOfLines={2} style={styles.name}>{displayName}</Text>
            <Text numberOfLines={1} style={styles.email}>{currentUser?.email || 'Chưa có email đăng nhập'}</Text>
            <View style={styles.badges}>
              <StatusPill label={roleLabel(currentUser?.role?.name)} tone="blue" />
              <StatusPill label={currentUser?.status === 'ACTIVE' ? 'Đang hoạt động' : currentUser?.status || 'Chưa rõ trạng thái'} tone={currentUser?.status === 'ACTIVE' ? 'green' : 'neutral'} />
            </View>
            {currentUser?.region?.name ? <View style={styles.region}><FieldIcon name="location" size={14} color={FieldColors.muted} /><Text style={styles.regionText}>{currentUser.region.name}</Text></View> : null}
          </View>
        </View>

        <View style={styles.accountPanel}>
          <View style={styles.sectionTitleRow}><FieldIcon name="user" size={18} color={FieldColors.brand} /><Text style={styles.sectionTitle}>Thông tin tài khoản</Text></View>
          <InfoRow label="Điện thoại" value={currentUser?.phone || 'Chưa cập nhật'} />
          <InfoRow label="Tên đăng nhập" value={currentUser?.username || 'Chưa thiết lập'} last />
        </View>

        {profile || workRows.length ? (
          <View style={styles.workPanel}>
            <View style={styles.sectionTitleRow}><FieldIcon name="tool" size={18} color={FieldColors.brand} /><Text style={styles.sectionTitle}>Hồ sơ công tác</Text></View>
            {workRows.length ? workRows.map(([label, value], index) => <InfoRow key={label} label={label} value={value} last={index === workRows.length - 1 && !profile?.note} />) : <Text style={styles.empty}>Chưa có thông tin công tác.</Text>}
            {profile?.note ? <InfoRow label="Ghi chú" value={profile.note} last /> : null}
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => router.push('/profile-edit')} style={({ pressed }) => [styles.editRow, pressed && styles.pressed]}>
          <View style={styles.editIcon}><FieldIcon name="user" size={18} color={FieldColors.brand} /></View>
          <View style={styles.editCopy}><Text style={styles.editTitle}>Chỉnh sửa hồ sơ</Text><Text style={styles.editSubtitle}>Thông tin liên hệ, công tác và mật khẩu</Text></View>
          <FieldIcon name="chevron" size={15} color={FieldColors.muted} />
        </Pressable>

        <Pressable accessibilityRole="button" onPress={confirmSignOut} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
          <Text style={styles.logout}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.infoRow, last && styles.infoRowLast]}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: FieldColors.canvas, flex: 1 },
  content: { gap: 14, padding: 16, paddingBottom: 35 },
  topline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: FieldColors.ink, fontSize: 29, fontWeight: '800', marginTop: 4 },
  refresh: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  loader: { marginTop: 30 },
  hero: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 15, padding: 16 },
  avatarButton: { alignItems: 'center', backgroundColor: FieldColors.brandSoft, borderColor: '#fff', borderRadius: 22, borderWidth: 3, height: 82, justifyContent: 'center', position: 'relative', width: 82 },
  avatarImage: { borderRadius: 18, height: 76, width: 76 },
  avatarText: { color: FieldColors.brandDark, fontSize: 23, fontWeight: '900' },
  cameraBadge: { alignItems: 'center', backgroundColor: FieldColors.brand, borderColor: FieldColors.surface, borderRadius: 12, borderWidth: 2, bottom: -3, height: 25, justifyContent: 'center', position: 'absolute', right: -3, width: 25 },
  identity: { flex: 1, gap: 5, minWidth: 0 },
  name: { color: FieldColors.ink, fontSize: 18, fontWeight: '800', lineHeight: 23 },
  email: { color: FieldColors.muted, fontSize: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  region: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2 },
  regionText: { color: FieldColors.muted, flexShrink: 1, fontSize: 11 },
  accountPanel: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 17, borderWidth: 1, paddingHorizontal: 14, paddingTop: 13 },
  workPanel: { backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 17, borderWidth: 1, paddingHorizontal: 14, paddingTop: 13 },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 5 },
  sectionTitle: { color: FieldColors.ink, fontSize: 14, fontWeight: '800' },
  infoRow: { borderBottomColor: '#E9E6E1', borderBottomWidth: StyleSheet.hairlineWidth, gap: 4, paddingVertical: 10 },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: FieldColors.muted, fontSize: 10, fontWeight: '700' },
  infoValue: { color: FieldColors.ink, fontSize: 13, lineHeight: 18 },
  empty: { color: FieldColors.muted, fontSize: 12, paddingVertical: 12 },
  editRow: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 66, paddingHorizontal: 12, paddingVertical: 10 },
  editIcon: { alignItems: 'center', backgroundColor: FieldColors.canvas, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  editCopy: { flex: 1, gap: 3 },
  editTitle: { color: FieldColors.ink, fontSize: 13, fontWeight: '700' },
  editSubtitle: { color: FieldColors.muted, fontSize: 10 },
  logoutButton: { alignItems: 'center', backgroundColor: FieldColors.surface, borderRadius: 14, justifyContent: 'center', minHeight: 46 },
  logout: { color: FieldColors.red, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.76 },
  errorBox: { backgroundColor: FieldColors.redSoft, borderRadius: 12, padding: 12 },
  error: { color: FieldColors.red, fontSize: 11 },
  retry: { color: FieldColors.brand, fontSize: 11, fontWeight: '800', marginTop: 8 },
});
