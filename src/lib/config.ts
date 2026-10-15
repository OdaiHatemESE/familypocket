// Supabase project settings. The publishable (anon) key is safe to ship in the app:
// every table is protected by Row Level Security on the server.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://eypcyrthilqohmawirly.supabase.co';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_fa_TJ1Ym4n5ZxEeVIR5aiA_b9V-ID6T';

/** Usernames are mapped to an internal sign-in address; nothing is ever emailed. */
export const loginEmail = (username: string) => `${username.trim().toLowerCase()}@familypocket.local`;
