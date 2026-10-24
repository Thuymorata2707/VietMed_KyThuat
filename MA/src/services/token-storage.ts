import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'vietmed.access-token';
let memoryToken: string | null = null;
const invalidationListeners = new Set<() => void>();

export function onTokenInvalidated(listener: () => void) {
  invalidationListeners.add(listener);
  return () => { invalidationListeners.delete(listener); };
}

export async function readToken() {
  if (Platform.OS === 'web') return memoryToken;
  memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return memoryToken;
}

export async function saveToken(token: string) {
  memoryToken = token;
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  memoryToken = null;
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(TOKEN_KEY);
  invalidationListeners.forEach((listener) => listener());
}
