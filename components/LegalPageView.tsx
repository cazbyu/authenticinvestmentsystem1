import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { termsHTML } from './legal/termsContent';
import { privacyHTML } from './legal/privacyContent';

interface LegalPageViewProps {
  title: string;
  htmlPath: string;
}

export function LegalPageView({ title, htmlPath }: LegalPageViewProps) {
  const router = useRouter();

  const getHTMLContent = () => {
    if (htmlPath.includes('terms')) {
      return termsHTML;
    } else if (htmlPath.includes('privacy')) {
      return privacyHTML;
    }
    return '<html><body><h1>Content not found</h1></body></html>';
  };

  const htmlContent = getHTMLContent();

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#1f2937" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <div
          style={{
            flex: 1,
            width: '100%',
            overflow: 'auto',
            backgroundColor: '#f9fafb',
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1f2937" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        startInLoadingState
        originWhitelist={['*']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
