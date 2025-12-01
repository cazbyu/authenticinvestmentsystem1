import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase';
import { signInWithGoogle } from '@/lib/googleAuth';
import type { SupabaseClient } from '@supabase/supabase-js';

export default function LoginScreen() {
  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Supabase client not available.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    console.log('[Login] Attempting sign in for:', email.trim());

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('[Login] Sign in error:', error);
        Alert.alert('Login Error', error.message);
      } else if (data.session) {
        console.log('[Login] Sign in successful, user ID:', data.user?.id);
        router.replace('/(tabs)/dashboard');
      } else {
        console.warn('[Login] No error but no session created');
        Alert.alert('Login Error', 'Failed to create session. Please try again.');
      }
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      Alert.alert('Login Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);

    console.log('[SignUp] Attempting sign up for:', email.trim());

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim()
          },
          emailRedirectTo: undefined
        }
      });

      if (authError) {
        console.error('[SignUp] Auth error:', authError);
        console.error('[SignUp] Error details:', {
          message: authError.message,
          status: authError.status,
          name: authError.name
        });

        let errorMessage = authError.message;
        if (authError.message.includes('Database error')) {
          errorMessage = 'There was a problem creating your account. Please try again or contact support if the issue persists.';
        }

        Alert.alert('Sign Up Error', errorMessage);
      } else if (authData.user) {
        console.log('[SignUp] Success! User created:', authData.user.id);

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          const { data: profile } = await supabase
            .from('0008-ap-users')
            .select('id')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (!profile) {
            console.warn('[SignUp] Profile not created by trigger, attempting manual creation...');

            const { error: profileError } = await supabase
              .from('0008-ap-users')
              .insert({
                id: authData.user.id,
                email: authData.user.email || email.trim(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                oauth_provider: 'email',
                profile_image_source: 'default'
              });

            if (profileError) {
              console.error('[SignUp] Manual profile creation failed:', profileError);
            } else {
              console.log('[SignUp] Manual profile creation succeeded');
            }
          }
        } catch (profileCheckError) {
          console.error('[SignUp] Error checking/creating profile:', profileCheckError);
        }

        if (authData.session) {
          console.log('[SignUp] Auto-signed in with session');
          Alert.alert(
            'Success!',
            'Your account has been created and you are now signed in.',
            [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }]
          );
        } else {
          console.log('[SignUp] Email confirmation may be required');
          Alert.alert(
            'Success!',
            'Your account has been created. You can now sign in.',
            [{ text: 'OK', onPress: () => setIsSignUp(false) }]
          );
        }

        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFirstName('');
        setLastName('');
      }
    } catch (err) {
      console.error('[SignUp] Unexpected error:', err);
      Alert.alert('Sign Up Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google';
      if (errorMessage !== 'Sign in was cancelled') {
        Alert.alert('Google Sign In Error', errorMessage);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formWrapper}>
          <View style={styles.content}>
            <Text style={styles.title}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp
                ? 'Sign up to start your authentic investment journey'
                : 'Sign in to continue your authentic investment journey'
              }
            </Text>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#4285F4" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  <Text style={styles.googleIcon}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          {isSignUp && (
            <>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          )}
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={isSignUp ? handleSignUp : handleLogin} 
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading 
                ? (isSignUp ? 'Creating Account...' : 'Signing In...') 
                : (isSignUp ? 'Create Account' : 'Sign In')
              }
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsSignUp(!isSignUp);
            }}
          >
            <Text style={styles.switchButtonText}>
              {isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"
              }
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing in, you agree to our{' '}
              <Text
                style={styles.footerLink}
                onPress={() => router.push('/terms')}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text
                style={styles.footerLink}
                onPress={() => router.push('/privacy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formWrapper: {
    width: '100%',
    maxWidth: 450,
    paddingHorizontal: 24,
  },
  content: {
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0078d4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchButtonText: {
    color: '#0078d4',
    fontSize: 14,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    padding: 16,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  googleButtonText: {
    color: '#3c4043',
    fontSize: 16,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
  },
  dividerText: {
    color: '#6b7280',
    fontSize: 14,
    marginHorizontal: 16,
    fontWeight: '500',
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: '#0078d4',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
