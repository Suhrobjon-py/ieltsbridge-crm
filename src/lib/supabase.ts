import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key && !url.includes('SIZNING-LOYIHA'));

export const supabase: SupabaseClient = configured
  ? createClient(url!, key!)
  : (null as unknown as SupabaseClient);

// Yangi xodim akkauntini yaratish uchun ALOHIDA klient:
// signUp joriy sessiyani buzmasligi uchun sessiya saqlamaydi.
let _signupClient: SupabaseClient | null = null;
export function signupClient(): SupabaseClient {
  if (!_signupClient) {
    _signupClient = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _signupClient;
}

export const LOGIN_DOMEN = 'ieltsbridge.uz';
export function loginToEmail(login: string): string {
  const l = login.trim().toLowerCase();
  return l.includes('@') ? l : `${l}@${LOGIN_DOMEN}`;
}
