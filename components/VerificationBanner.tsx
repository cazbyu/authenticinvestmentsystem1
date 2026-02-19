import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Soft-wall verification banner.
 *
 * Shows only when:
 *  - There is an authenticated user, AND
 *  - Their email is NOT verified (and they are not a tester).
 *
 * The user can dismiss it for the session and request a resend.
 */
export function VerificationBanner() {
  const { user, emailVerified, isTester, resendVerificationEmail } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  // Don't render if: no user, already verified, tester bypass, or dismissed
  if (!user || emailVerified || isTester || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setResending(true);
    setResendStatus('idle');
    const { error } = await resendVerificationEmail();
    setResending(false);
    setResendStatus(error ? 'error' : 'sent');
  };

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Text style={styles.message}>
          {resendStatus === 'sent'
            ? 'Verification email sent! Check your inbox.'
            : resendStatus === 'error'
            ? 'Could not resend. Please try again.'
            : 'Please verify your email to unlock all features.'}
        </Text>

        {resendStatus !== 'sent' && (
          <TouchableOpacity
            onPress={handleResend}
            disabled={resending}
            style={styles.resendButton}
            accessibilityRole="button"
            accessibilityLabel="Resend verification email"
          >
            {resending ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <Text style={styles.resendText}>Resend Link</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        onPress={() => setDismissed(true)}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Dismiss verification banner"
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Ensure it sits above page content on web
    ...(Platform.OS === 'web'
      ? ({ position: 'sticky', top: 0, zIndex: 1000 } as object)
      : {}),
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  message: {
    fontSize: 14,
    color: '#1e40af',
    flexShrink: 1,
  },
  resendButton: {
    paddingHorizontal: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#1d4ed8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
  closeText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
});
