import { supabase } from './supabase';
import { auth } from './firebase';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: null;
  providerData: Array<{
    providerId: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  }>;
}

function normalizeUser(user: any): User | null {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: meta.full_name ?? meta.name ?? user.email ?? null,
    photoURL: meta.avatar_url ?? meta.picture ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    isAnonymous: Boolean(user.is_anonymous),
    tenantId: null,
    providerData: [{
      providerId: user.app_metadata?.provider ?? 'supabase',
      displayName: meta.full_name ?? meta.name ?? null,
      email: user.email ?? null,
      photoURL: meta.avatar_url ?? meta.picture ?? null,
    }],
  };
}

export class GoogleAuthProvider {}

export async function signInWithPopup(_auth: typeof auth, _provider: GoogleAuthProvider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

export async function signOut(_auth: typeof auth) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  auth.currentUser = null;
}

export function onAuthStateChanged(_auth: typeof auth, callback: (user: User | null) => void | Promise<void>) {
  let active = true;

  const deliver = (rawUser: any) => {
    if (!active) return;
    const normalized = normalizeUser(rawUser);
    auth.currentUser = normalized;
    Promise.resolve(callback(normalized)).catch((error) => {
      console.error('Auth state callback failed:', error);
    });
  };

  // Restore from the locally persisted Supabase session first. This avoids
  // waiting on an extra /user request after returning from Google OAuth.
  supabase.auth.getSession()
    .then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('Failed to restore Supabase session:', error);
        deliver(null);
        return;
      }
      deliver(data.session?.user ?? null);
    })
    .catch((error) => {
      console.error('Failed to restore Supabase session:', error);
      deliver(null);
    });

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    // Avoid running application Supabase queries while the auth event is
    // holding its internal lock.
    setTimeout(() => deliver(session?.user ?? null), 0);
  });

  return () => {
    active = false;
    subscription.subscription.unsubscribe();
  };
}
