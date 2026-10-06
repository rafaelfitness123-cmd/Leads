import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://thaqpgmhltngdxvaqoyf.supabase.co';
const supabasePublishableKey = 'sb_publishable_YFlK9Wx00DNar1XB6rRPzQ_i8AKXoDt';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
