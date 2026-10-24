import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const REMEMBERED_ACCOUNT_KEY = 'vietmed.remembered-account';

export async function readRememberedAccount() {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(REMEMBERED_ACCOUNT_KEY);
}

export async function saveRememberedAccount(account: string | null) {
  if (Platform.OS === 'web') return;
  if (account) await SecureStore.setItemAsync(REMEMBERED_ACCOUNT_KEY, account);
  else await SecureStore.deleteItemAsync(REMEMBERED_ACCOUNT_KEY);
}
