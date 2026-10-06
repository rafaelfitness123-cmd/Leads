import { supabase } from './supabase';

export const db = { provider: 'supabase' };

export const auth: any = {
  currentUser: null,
  supabase,
};
