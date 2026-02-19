import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * Returns true if the email qualifies for the tester exemption.
 * Any email whose domain ends in ".test" (e.g. user@example.test) is
 * treated as already-verified so testers never see the banner.
 */
export function isTesterEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const domain = email.split('@')[1] ?? '';
  return domain.endsWith('.test');
}

/**
 * Returns true when the user should be considered verified.
 *
 * Rules (in priority order):
 *  1. Tester exemption  – @*.test domains are always verified.
 *  2. Supabase flag     – email_confirmed_at is set.
 *  3. OAuth users       – signed in via a provider (not "email"), verified
 *                         by definition because the provider owns the address.
 */
export function isEmailVerified(user: User | null): boolean {
  if (!user) return false;
  if (isTesterEmail(user.email)) return true;
  if (user.email_confirmed_at) return true;
  // OAuth users: identities list contains a non-email provider
  const identities = user.identities ?? [];
  const hasOAuthIdentity = identities.some((id) => id.provider !== 'email');
  return hasOAuthIdentity;
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True once the initial session check is done */
  loading: boolean;
  /** Whether the current user's email is verified (or exempt) */
  emailVerified: boolean;
  /** Whether this user qualifies for the tester bypass */
  isTester: boolean;
  /** Trigger a resend of the verification email */
  resendVerificationEmail: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  emailVerified: false,
  isTester: false,
  resendVerificationEmail: async () => ({ error: null }),
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session: initial } } = await supabase.auth.getSession();
        if (mounted) setSession(initial);
      } catch {
        // Supabase not yet configured – stay null
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = getSupabaseClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (mounted) setSession(newSession);
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch {
      // Supabase not available
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const user = session?.user ?? null;
  const emailVerified = isEmailVerified(user);
  const tester = isTesterEmail(user?.email);

  const resendVerificationEmail = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user?.email) return { error: 'No email address on file.' };
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      return { error: error?.message ?? null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to resend email.' };
    }
  }, [user?.email]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        emailVerified,
        isTester: tester,
        resendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}
