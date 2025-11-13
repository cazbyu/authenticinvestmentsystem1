import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';

async function ensureUserProfileExists(userId: string) {
  try {
    const supabase = getSupabaseClient();

    const { data: existingProfile, error: checkError } = await supabase
      .from('0008-ap-users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error('[Profile Check] Error checking profile:', checkError);
      return false;
    }

    if (existingProfile) {
      console.log('[Profile Check] Profile already exists for user:', userId);
      return true;
    }

    console.log('[Profile Check] No profile found, creating fallback profile...');

    const { data: authUser } = await supabase.auth.getUser();
    const metadata = authUser?.user?.user_metadata || {};

    const { error: createError } = await supabase
      .from('0008-ap-users')
      .insert({
        user_id: userId,
        first_name: metadata.first_name || metadata.given_name || '',
        last_name: metadata.last_name || metadata.family_name || '',
        profile_image: metadata.avatar_url || metadata.picture || null,
        oauth_provider: 'email',
        profile_image_source: metadata.avatar_url || metadata.picture ? 'oauth' : 'default',
      });

    if (createError) {
      console.error('[Profile Check] Error creating fallback profile:', createError);
      return false;
    }

    console.log('[Profile Check] Fallback profile created successfully');
    return true;
  } catch (err) {
    console.error('[Profile Check] Unexpected error:', err);
    return false;
  }
}

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabaseClient();

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[Auth Callback] Session error:', sessionError);
          setError('Authentication failed. Please try again.');
          setTimeout(() => {
            router.replace('/login');
          }, 2000);
          return;
        }

        if (session) {
          console.log('[Auth Callback] Session found, user ID:', session.user.id);

          const profileExists = await ensureUserProfileExists(session.user.id);

          if (!profileExists) {
            console.warn('[Auth Callback] Profile creation failed, but proceeding...');
          }

          console.log('[Auth Callback] Redirecting to dashboard...');
          router.replace('/(tabs)/dashboard');
        } else {
          console.log('[Auth Callback] No session found, redirecting to login...');
          setTimeout(() => {
            router.replace('/login');
          }, 1000);
        }
      } catch (err) {
        console.error('[Auth Callback] Unexpected error:', err);
        setError('An unexpected error occurred.');
        setTimeout(() => {
          router.replace('/login');
        }, 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.redirectText}>Redirecting to login...</Text>
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Completing sign in...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 8,
  },
  redirectText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
