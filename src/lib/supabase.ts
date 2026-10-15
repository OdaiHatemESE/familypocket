import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh the session only while the app is in the foreground
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'اسم المستخدم أو كلمة المرور غير صحيحة',
  USERNAME_INVALID: 'اسم المستخدم من 3 إلى 24 حرف إنجليزي صغير أو رقم',
  USERNAME_TAKEN: 'اسم المستخدم مستخدم، جرّب اسم ثاني',
  PASSWORD_SHORT: 'كلمة المرور لازم تكون 6 خانات أو أكثر',
  NAME_REQUIRED: 'اكتب الاسم',
  OWNER_ONLY: 'هذا الإجراء لصاحب الحساب فقط',
  CANNOT_REMOVE_SELF: 'ما بتقدر تحذف حسابك',
};

/** Turns a Supabase / Postgres error into a sentence the user can act on */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; hint?: string; code?: string } | null;
  if (!e) return 'صار خطأ، جرّب مرة ثانية';
  if (e.message && MESSAGES[e.message]) return MESSAGES[e.message];
  if (e.hint) return e.hint;
  if (e.code === '23505') return 'هذا العنصر مسجّل من قبل';
  if (e.message?.includes('Failed to fetch') || e.message?.includes('Network')) return 'ما في اتصال بالإنترنت، تأكد من الشبكة وجرّب مرة ثانية';
  return 'صار خطأ، جرّب مرة ثانية';
}
