import AsyncStorage from '@react-native-async-storage/async-storage';

// Shape of what we save after a successful login.
// Adjust the fields to match whatever your login.php actually returns.
export interface AuthData {
  token?: string;
  admin_id?: number;
  email: string;
  role: string; // e.g. "Admin"
  department_id: number; // e.g. CCIS = 1
  department_code?: string; // e.g. "CCIS"
}

const AUTH_KEY = 'auth_data';

export async function saveAuthData(data: AuthData): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save auth data:', err);
  }
}

export async function getAuthData(): Promise<AuthData | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthData) : null;
  } catch (err) {
    console.error('Failed to read auth data:', err);
    return null;
  }
}

export async function clearAuthData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_KEY);
  } catch (err) {
    console.error('Failed to clear auth data:', err);
  }
}