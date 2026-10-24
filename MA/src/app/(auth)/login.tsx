import { Text, TextInput } from '@/components/text';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FieldColors } from '@/constants/field-theme';
import { useAuth } from '@/contexts/auth-context';
import { apiErrorMessage } from '@/api/client';
import { FieldIcon } from '@/components/field-ui';
import { readRememberedAccount, saveRememberedAccount } from '@/services/account-preferences';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  useEffect(() => { void readRememberedAccount().then((account) => { if (account) { setEmail(account); setRememberAccount(true); } }); }, []);
  async function submit() {
    setBusy(true); setError('');
    try { await saveRememberedAccount(rememberAccount ? email.trim() : null); await signIn(email.trim(), password); } catch (cause) { setError(apiErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}><View style={styles.logoBox}><Image source={require('../../../assets/images/vietmed-shield.png')} style={styles.logo} resizeMode="contain" /></View><Text style={styles.brandName}>VIETMED</Text><Text style={styles.brandSub}>ĐỐI TÁC CHUYÊN NGHIỆP</Text><Text style={styles.title}>Chào mừng trở lại</Text><Text style={styles.subtitle}>Đăng nhập VietMed Kỹ Thuật</Text></View>
        <View style={styles.form}><Text style={styles.label}>Tài khoản</Text><View style={styles.inputRow}><FieldIcon name="user" size={17} color="#737A7D" /><TextInput accessibilityLabel="Email hoặc tên đăng nhập" autoCapitalize="none" autoComplete="username" autoCorrect={false} value={email} onChangeText={setEmail} placeholder="Email hoặc tên đăng nhập" placeholderTextColor="#9AA6B5" style={styles.input} returnKeyType="next" /></View><Text style={styles.label}>Mật khẩu</Text><View style={styles.inputRow}><FieldIcon name="lock" size={16} color="#737A7D" /><TextInput accessibilityLabel="Mật khẩu" autoComplete="password" autoCapitalize="none" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} placeholder="Mật khẩu" placeholderTextColor="#9AA6B5" style={styles.input} returnKeyType="go" /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShowPassword((value) => !value)}><Text style={styles.show}>{showPassword ? 'Ẩn' : 'Hiện'}</Text></Pressable></View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rememberAccount }} onPress={() => setRememberAccount((value) => !value)} style={styles.remember}><View style={[styles.checkBox, rememberAccount && styles.checked]}><Text style={styles.checkMark}>{rememberAccount ? '✓' : ''}</Text></View><Text style={styles.rememberText}>Lưu tài khoản trên thiết bị này</Text></Pressable>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <Pressable disabled={busy || !email.trim() || !password} onPress={() => void submit()} style={({ pressed }) => [styles.button, (busy || !email.trim() || !password) && styles.disabled, pressed && styles.pressed]}>
            {busy ? <ActivityIndicator color="#fff" /> : <><Text style={styles.buttonText}>Đăng nhập</Text><Text style={styles.buttonArrow}>→</Text></>}
          </Pressable>
        </View>
        <Text style={styles.footnote}>Tài khoản được xác thực bởi hệ thống VietMed.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { backgroundColor: '#F5F4F1', flex: 1 }, wrap: { flex: 1 }, scroll: { flexGrow: 1, justifyContent: 'center', maxWidth: 500, padding: 26, paddingBottom: 30, width: '100%', alignSelf: 'center' }, hero: { alignItems: 'center', paddingBottom: 26 }, logoBox: { alignItems: 'center', alignSelf: 'center', backgroundColor: FieldColors.surface, borderColor: '#E4E1DC', borderRadius: 50, borderWidth: 1, height: 70, justifyContent: 'center', marginBottom: 11, width: 70 }, logo: { alignSelf: 'center', height: 50, transform: [{ translateX: 0 }], width: 50 }, brandName: { color: '#20272B', fontSize: 15, fontWeight: '900', letterSpacing: 1.8, textAlign: 'center', width: '100%' }, brandSub: { color: '#737A7D', fontSize: 7, fontWeight: '700', letterSpacing: 1.1, marginTop: 2, textAlign: 'center', width: '100%' }, title: { color: '#17151D', fontSize: 29, fontWeight: '800', letterSpacing: -0.6, marginTop: 25, textAlign: 'center' }, subtitle: { color: '#737A7D', fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: 'center' }, form: { gap: 9, paddingTop: 8 }, label: { color: '#20272B', fontSize: 12, fontWeight: '700', marginBottom: -5, marginLeft: 5, marginTop: 4 }, inputRow: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: '#E4E1DC', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 15 }, input: { color: FieldColors.ink, flex: 1, fontSize: 14, minHeight: 52, paddingVertical: 8 }, remember: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 30, paddingHorizontal: 3 }, checkBox: { alignItems: 'center', backgroundColor: FieldColors.surface, borderColor: FieldColors.line, borderRadius: 5, borderWidth: 1, height: 18, justifyContent: 'center', width: 18 }, checked: { backgroundColor: FieldColors.brand, borderColor: FieldColors.brand }, checkMark: { color: '#fff', fontSize: 11, fontWeight: '900' }, rememberText: { color: FieldColors.muted, fontSize: 11 }, show: { color: '#737A7D', fontSize: 10, fontWeight: '700', paddingVertical: 10 }, error: { color: FieldColors.red, fontSize: 12, lineHeight: 18, marginTop: 3 }, button: { alignItems: 'center', backgroundColor: '#8D1825', borderRadius: 18, flexDirection: 'row', justifyContent: 'center', marginTop: 15, minHeight: 54, paddingHorizontal: 18 }, disabled: { opacity: 0.52 }, pressed: { opacity: 0.84 }, buttonText: { color: '#fff', flex: 1, fontSize: 14, fontWeight: '800', textAlign: 'center' }, buttonArrow: { color: '#fff', fontSize: 19, fontWeight: '600' }, footnote: { color: '#737A7D', fontSize: 10, lineHeight: 16, marginTop: 18, textAlign: 'center' } });
