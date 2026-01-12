import React, { useState, useEffect } from 'react';
import { toLocalISOString } from '@/lib/dateUtils';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, TextInput, Image, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '@/components/Header';
import { ManageRolesModal } from '@/components/settings/ManageRolesModal';
import { ArchivedTimelinesView } from '@/components/settings/ArchivedTimelinesView';
import { LinkedAccountsManager } from '@/components/settings/LinkedAccountsManager';
import { NorthStarEditor } from '@/components/northStar/NorthStarEditor';
import { ManageCustomTimelinesModal } from '@/components/timelines/ManageCustomTimelinesModal';
import { CalendarManagementModal } from '@/components/settings/CalendarManagementModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { getSupabaseClient } from '@/lib/supabase';
import { getTimezonesByRegion, getTimezoneDisplayName, detectUserTimezone } from '@/lib/timezoneUtils';
import { calculateStorageUsage, formatBytes, StorageUsage } from '@/lib/storageUtils';
import { Camera, Upload, User, HardDrive, RefreshCw, Clock } from 'lucide-react-native';
import { TimePickerDropdown } from '@/components/tasks/TimePickerDropdown';
import { getRitualSettings, updateRitualSettings, getDefaultRitualSettings, RitualSettings, RitualType } from '@/lib/ritualUtils';
import { getUserPreferences, updateUserPreferences, UserPreferences } from '@/lib/userPreferences';
import { eventBus, EVENTS } from '@/lib/eventBus';

WebBrowser.maybeCompleteAuthSession();

// Get environment variables
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET || '';

// Configure redirect URI for the environment
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'myapp',
});

// OAuth discovery endpoints
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export default function SettingsScreen() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode, colors, setThemeColorImmediate } = useTheme();
  const { authenticScore, refreshScore } = useAuthenticScore();
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [isRolesModalVisible, setIsRolesModalVisible] = useState(false);
  const [showNorthStarEditor, setShowNorthStarEditor] = useState(false);
  const [showTimelineArchive, setShowTimelineArchive] = useState(false);
  const [showCalendarManagement, setShowCalendarManagement] = useState(false);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    profile_image: '',
    theme_color: '#0078d4',
    week_start_day: 'sunday',
    timezone: 'UTC',
    auto_detect_timezone: true
  });
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [ritualSettings, setRitualSettings] = useState<{
    morning_spark: RitualSettings | null;
    evening_review: RitualSettings | null;
    weekly_alignment: RitualSettings | null;
  }>({
    morning_spark: null,
    evening_review: null,
    weekly_alignment: null,
  });
  const [savingRituals, setSavingRituals] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Configure OAuth request with authorization code flow
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  // Handle OAuth response
  useEffect(() => {
    const handleOAuthResponse = async () => {
      if (response?.type === 'success') {
        try {
          setIsConnectingGoogle(true);
          const { code } = response.params;
          
          // Exchange authorization code for tokens
          const tokenResponse = await AuthSession.exchangeCodeAsync(
            {
              clientId: GOOGLE_CLIENT_ID,
              code,
              redirectUri,
              extraParams: {
                client_secret: GOOGLE_CLIENT_SECRET,
              },
            },
            discovery
          );
          
          const { accessToken, refreshToken, expiresIn } = tokenResponse;
          
          const supabase = getSupabaseClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('No user found');

          // Get user's email from Google and save connection
          const { getGoogleUserEmail, saveGoogleCalendarConnection, syncGoogleCalendarEvents } = 
            await import('@/lib/googleCalendarSync');
          
          const userEmail = await getGoogleUserEmail(accessToken);
          if (!userEmail) throw new Error('Could not retrieve Google account email');

          // Save connection to database
          const saveResult = await saveGoogleCalendarConnection(
            user.id,
            accessToken,
            refreshToken || '',
            expiresIn || 3600,
            userEmail
          );

          if (!saveResult.success) {
            throw new Error(saveResult.error);
          }

          // Immediately sync events
          const syncResult = await syncGoogleCalendarEvents(user.id);
          
          if (syncResult.success) {
            setGoogleAccessToken(accessToken);
            setSyncEnabled(true);
            Alert.alert(
              'Sync Complete!',
              `Connected to ${userEmail}\n\nImported ${syncResult.eventsCreated} new events from Google Calendar.`
            );
            // Refresh calendar view
            eventBus.emit(EVENTS.REFRESH_ALL_TASKS);
          } else {
            Alert.alert('Sync Warning', syncResult.error || 'Could not sync events');
          }
        } catch (error) {
          console.error('[Settings] OAuth error:', error);
          Alert.alert('Error', (error as Error).message);
        } finally {
          setIsConnectingGoogle(false);
        }
      } else if (response?.type === 'error') {
        setIsConnectingGoogle(false);
        Alert.alert('Error', 'Failed to connect to Google Calendar');
      }
    };

    handleOAuthResponse();
  }, [response]);

  const themeColorOptions = [
    { name: 'Blue', value: '#0078d4' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Purple', value: '#7c3aed' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Teal', value: '#0891b2' },
    { name: 'Brown', value: '#92400e' }
  ];

  const fetchProfile = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('0008-ap-users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error && (error as any).code !== 'PGRST116') throw error;

      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          profile_image: data.profile_image || '',
          theme_color: data.theme_color || '#0078d4',
          week_start_day: data.week_start_day || 'sunday',
          timezone: data.timezone || 'UTC',
          auto_detect_timezone: data.settings?.auto_detect_timezone !== false
        });

        if (data.profile_image) {
          try {
            const { data: publicUrlData } = supabase
              .storage
              .from('0008-ap-profile-images')
              .getPublicUrl(data.profile_image);

            if (publicUrlData?.publicUrl) {
              setProfileImageUrl(`${publicUrlData.publicUrl}?cb=${Date.now()}`);
            } else {
              console.error('No public URL returned for profile image');
              setProfileImageUrl(null);
            }
          } catch (imageError) {
            console.error('Error loading profile image:', imageError);
            setProfileImageUrl(null);
          }
        } else {
          setProfileImageUrl(null);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
    refreshScore();
    loadStorageUsage();
    loadRitualSettings();
    loadUserPreferences();
  }, []);

  useEffect(() => {
    return () => { if (saveTimeout) clearTimeout(saveTimeout); };
  }, [saveTimeout]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let fileExt = 'jpg';
      let contentType = 'image/jpeg';

      if (uri.startsWith('data:')) {
        const mimeMatch = uri.match(/data:([^;]+)/);
        if (mimeMatch) {
          contentType = mimeMatch[1];
          fileExt = contentType.split('/')[1] || 'jpg';
        }
      } else {
        const uriExt = uri.split('.').pop()?.toLowerCase();
        if (uriExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(uriExt)) {
          fileExt = uriExt === 'jpeg' ? 'jpg' : uriExt;
          contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
        }
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
      if (blob.size > MAX_PROFILE_IMAGE_SIZE) {
        Alert.alert(
          'File Size Limit Exceeded',
          `Profile images must be under 5 MB. This image is ${(blob.size / (1024 * 1024)).toFixed(2)} MB.`
        );
        return;
      }

      const fileName = `${user.id}/profile_${Date.now()}.${fileExt}`;

      if (profile.profile_image) {
        await supabase.storage.from('0008-ap-profile-images').remove([profile.profile_image]);
      }

      const { error: uploadError } = await supabase.storage
        .from('0008-ap-profile-images')
        .upload(fileName, blob, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      await updateProfile({ profile_image: fileName, profile_image_source: 'manual' });

      const { data: publicUrlData } = supabase.storage
        .from('0008-ap-profile-images')
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        setProfileImageUrl(`${publicUrlData.publicUrl}?cb=${Date.now()}`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const loadStorageUsage = async () => {
    try {
      setLoadingStorage(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const usage = await calculateStorageUsage(user.id);
      setStorageUsage(usage);
    } catch (error) {
      console.error('Error loading storage usage:', error);
    } finally {
      setLoadingStorage(false);
    }
  };

  const loadRitualSettings = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ritualTypes: RitualType[] = ['morning_spark', 'evening_review', 'weekly_alignment'];
      const settingsPromises = ritualTypes.map(type => getRitualSettings(user.id, type));
      const settingsResults = await Promise.all(settingsPromises);

      const newSettings: any = {};
      ritualTypes.forEach((type, index) => {
        newSettings[type] = settingsResults[index] || {
          ...getDefaultRitualSettings(type),
          id: '',
          user_id: user.id,
          ritual_type: type,
          created_at: '',
          updated_at: '',
        };
      });

      setRitualSettings(newSettings);
    } catch (error) {
      console.error('Error loading ritual settings:', error);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const prefs = await getUserPreferences(user.id);
      if (prefs) {
        setUserPreferences(prefs);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const saveUserPreferences = async () => {
    try {
      if (!userPreferences) return;

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const success = await updateUserPreferences(user.id, userPreferences);
      if (success) {
        Alert.alert('Success', 'Preferences saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving user preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    }
  };

  const saveRitualSettings = async () => {
    try {
      setSavingRituals(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ritualTypes: RitualType[] = ['morning_spark', 'evening_review', 'weekly_alignment'];
      const updatePromises = ritualTypes.map(type => {
        const settings = ritualSettings[type];
        if (settings) {
          return updateRitualSettings(user.id, type, {
            is_enabled: settings.is_enabled,
            available_from: settings.available_from,
            available_until: settings.available_until,
          });
        }
        return Promise.resolve(false);
      });

      await Promise.all(updatePromises);
      Alert.alert('Success', 'Ritual settings saved successfully!');
    } catch (error) {
      console.error('Error saving ritual settings:', error);
      Alert.alert('Error', 'Failed to save ritual settings');
    } finally {
      setSavingRituals(false);
    }
  };

  const updateProfile = async (updates: Partial<typeof profile>) => {
    try {
      setSaving(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const payload: any = {
        id: user.id,
        email: user.email || '',
        updated_at: toLocalISOString(new Date()),
      };

      if (profile.first_name !== undefined) payload.first_name = profile.first_name;
      if (profile.last_name !== undefined) payload.last_name = profile.last_name;
      if (profile.profile_image !== undefined) payload.profile_image = profile.profile_image;
      if (profile.theme_color !== undefined) payload.theme_color = profile.theme_color;
      if (profile.week_start_day !== undefined) payload.week_start_day = profile.week_start_day;
      if (profile.timezone !== undefined) payload.timezone = profile.timezone;

      if (profile.auto_detect_timezone !== undefined) {
        payload.settings = {
          ...payload.settings,
          auto_detect_timezone: profile.auto_detect_timezone
        };
      }

      Object.keys(updates).forEach(key => {
        payload[key] = updates[key as keyof typeof profile];
      });

      const { error, data } = await supabase
        .from('0008-ap-users')
        .upsert(payload, { onConflict: 'id' })
        .select();

      if (error) throw error;

      setProfile(prev => ({ ...prev, ...updates }));

      if (updates.profile_image) {
        try {
          const { data: publicUrlData } = supabase.storage
            .from('0008-ap-profile-images')
            .getPublicUrl(updates.profile_image);

          if (publicUrlData?.publicUrl) {
            setProfileImageUrl(`${publicUrlData.publicUrl}?cb=${Date.now()}`);
          } else {
            setProfileImageUrl(null);
          }
        } catch (imageError) {
          console.error('Error loading updated profile image:', imageError);
          setProfileImageUrl(null);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const debouncedUpdateProfile = (updates: Partial<typeof profile>) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(() => { updateProfile(updates); }, 1000);
    setSaveTimeout(timeout);
  };

  const handleProfileChange = (field: keyof typeof profile, value: string) => {
    const updatedProfile = { ...profile, [field]: value };
    setProfile(updatedProfile);
    debouncedUpdateProfile({ [field]: value } as any);
  };

  const handleThemeColorChange = async (color: string) => {
    setProfile(prev => ({ ...prev, theme_color: color }));
    await setThemeColorImmediate(color);
  };

  const connectToGoogle = async () => {
    setIsConnectingGoogle(true);
    await promptAsync();
  };

  const disconnectGoogle = async () => {
    Alert.alert(
      'Disconnect Google Calendar?',
      'This will remove all synced events from your calendar.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Delete all Google Calendar events
              await supabase
                .from('0008-ap-tasks')
                .delete()
                .eq('user_id', user.id)
                .eq('external_source', 'google');

              // Disconnect the calendar connection
              const { disconnectGoogleCalendar } = await import('@/lib/googleCalendarSync');
              const result = await disconnectGoogleCalendar(user.id);
              
              if (result.success) {
                setGoogleAccessToken(null);
                setSyncEnabled(false);
                Alert.alert('Success', 'Disconnected from Google Calendar');
                eventBus.emit(EVENTS.REFRESH_ALL_TASKS);
              } else {
                Alert.alert('Error', result.error || 'Failed to disconnect');
              }
            } catch (error) {
              Alert.alert('Error', (error as Error).message);
            }
          },
        },
      ]
    );
  };

  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const isPM = hours >= 12;
    const displayHour = hours % 12 || 12;
    const displayMinute = minutes.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${isPM ? 'pm' : 'am'}`;
  };

  const convertTo24Hour = (time12: string): string => {
    const timeLower = time12.toLowerCase().trim();
    const isPM = timeLower.includes('pm');
    const timeOnly = timeLower.replace(/am|pm/g, '').trim();
    const [h, m] = timeOnly.split(':').map(s => parseInt(s.trim(), 10));
    let hours = h === 12 ? (isPM ? 12 : 0) : (isPM ? h + 12 : h);
    const minutes = m || 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Settings" authenticScore={authenticScore} />

      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Profile Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>

          <View style={styles.profilePhotoSection}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Profile Photo</Text>

            <View style={styles.profilePhotoContainer}>
              {profileImageUrl ? 
                <Image
                  key={profileImageUrl}
                  source={{ uri: profileImageUrl }}
                  style={styles.profileImage}
                />
               : 
                <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <User size={32} color={colors.textSecondary} />
                </View>
              }

              <View style={styles.profilePhotoButtons}>
                <TouchableOpacity
                  style={[styles.photoButton, { borderColor: colors.primary }]}
                  onPress={takePhoto}
                  disabled={uploading}
                >
                  <Camera size={16} color={colors.primary} />
                  <Text style={[styles.photoButtonText, { color: colors.primary }]}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoButton, { borderColor: colors.primary }]}
                  onPress={pickImage}
                  disabled={uploading}
                >
                  <Upload size={16} color={colors.primary} />
                  <Text style={[styles.photoButtonText, { color: colors.primary }]}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              {uploading && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>Uploading...</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.profileField}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>First Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={profile.first_name}
              onChangeText={(text) => handleProfileChange('first_name', text)}
              placeholder="Enter first name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.profileField}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Last Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={profile.last_name}
              onChangeText={(text) => handleProfileChange('last_name', text)}
              placeholder="Enter last name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={[styles.colorField, { marginTop: 24 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personalization</Text>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Theme Color</Text>
            <Text style={[styles.fieldDescription, { color: colors.textSecondary }]}>Choose the primary color for headers and buttons throughout the app</Text>
            <View style={styles.colorGrid}>
              {themeColorOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.colorOption,
                    { backgroundColor: option.value },
                    profile.theme_color === option.value && styles.selectedColorOption
                  ]}
                  onPress={() => handleThemeColorChange(option.value)}
                >
                  {profile.theme_color === option.value && (
                    <View style={styles.colorCheckmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setIsRolesModalVisible(true)}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Manage Roles</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingButton}>
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Export Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={async () => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const supabase = getSupabaseClient();
                        const { error } = await supabase.auth.signOut();
                        if (error) {
                          Alert.alert('Error', error.message);
                        } else {
                          router.replace('/login');
                        }
                      } catch (error) {
                        console.error('Error signing out:', error);
                        Alert.alert('Error', 'Failed to sign out');
                      }
                    },
                  },
                ],
              );
            }}
          >
            <Text style={[styles.settingButtonText, { color: '#dc2626' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Storage Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Storage</Text>
            <TouchableOpacity
              onPress={loadStorageUsage}
              disabled={loadingStorage}
              style={styles.refreshButton}
            >
              {loadingStorage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <RefreshCw size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {storageUsage ? (
            <>
              <View style={styles.storageInfoRow}>
                <HardDrive size={20} color={colors.textSecondary} />
                <Text style={[styles.storageTotalText, { color: colors.text }]}>
                  Total Used: {formatBytes(storageUsage.totalSize)}
                </Text>
              </View>

              <View style={styles.storageBreakdown}>
                {storageUsage.breakdown.map((item, index) => (
                  <View key={index} style={styles.storageItem}>
                    <View style={styles.storageItemHeader}>
                      <Text style={[styles.storageCategory, { color: colors.text }]}>{item.category}</Text>
                      <Text style={[styles.storageSize, { color: colors.textSecondary }]}>
                        {formatBytes(item.size)}
                      </Text>
                    </View>
                    <Text style={[styles.storageFileCount, { color: colors.textSecondary }]}>
                      {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.storageLastUpdated, { color: colors.textSecondary }]}>
                Last updated: {new Date(storageUsage.lastUpdated).toLocaleString()}
              </Text>
            </>
          ) : (
            <View style={styles.storageLoadingContainer}>
              {loadingStorage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.storageEmptyText, { color: colors.textSecondary }]}>
                  Tap refresh to load storage usage
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Linked Accounts Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <LinkedAccountsManager />
        </View>

        {/* North Star Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>North Star</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowNorthStarEditor(true)}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Mission & Vision Statements</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowNorthStarEditor(true)}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>1-Year Goals</Text>
          </TouchableOpacity>
        </View>

        {/* Goal Bank Settings Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Goal Bank Settings</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowTimelineArchive(true)}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Timeline Archive</Text>
          </TouchableOpacity>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Week Start Day</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>{
                profile.week_start_day === 'sunday' ? 'Weeks start on Sunday' : 'Weeks start on Monday'
              }</Text>
            </View>
            <View style={styles.weekStartButtonGroup}>
              <TouchableOpacity
                style={[
                  styles.weekStartButton,
                  profile.week_start_day === 'sunday' && styles.weekStartButtonActive,
                  { borderColor: colors.border }
                ]}
                onPress={async () => {
                  const updatedProfile = { ...profile, week_start_day: 'sunday' };
                  setProfile(updatedProfile);
                  await updateProfile({ week_start_day: 'sunday' });
                }}
              >
                <Text style={[
                  styles.weekStartButtonText,
                  profile.week_start_day === 'sunday' && [styles.weekStartButtonTextActive, { color: colors.primary }],
                  { color: colors.textSecondary }
                ]}>Sun</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.weekStartButton,
                  profile.week_start_day === 'monday' && styles.weekStartButtonActive,
                  { borderColor: colors.border }
                ]}
                onPress={async () => {
                  const updatedProfile = { ...profile, week_start_day: 'monday' };
                  setProfile(updatedProfile);
                  await updateProfile({ week_start_day: 'monday' });
                }}
              >
                <Text style={[
                  styles.weekStartButtonText,
                  profile.week_start_day === 'monday' && [styles.weekStartButtonTextActive, { color: colors.primary }],
                  { color: colors.textSecondary }
                ]}>Mon</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Timezone</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {getTimezoneDisplayName(profile.timezone)}
              </Text>
            </View>
            <View style={styles.timezoneControls}>
              <TouchableOpacity
                style={[styles.timezoneButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setShowTimezonePicker(true)}
              >
                <Text style={[styles.timezoneButtonText, { color: colors.primary }]}>
                  Change
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Auto-detect Timezone</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Automatically update timezone based on your location
              </Text>
            </View>
            <Switch
              value={profile.auto_detect_timezone}
              onValueChange={async (value) => {
                const updatedProfile = { ...profile, auto_detect_timezone: value };
                setProfile(updatedProfile);
                if (value) {
                  const detectedTimezone = detectUserTimezone();
                  updatedProfile.timezone = detectedTimezone;
                  setProfile({ ...updatedProfile, timezone: detectedTimezone });
                  await updateProfile({ timezone: detectedTimezone, auto_detect_timezone: value });
                } else {
                  await updateProfile({ auto_detect_timezone: value });
                }
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Default 12-Week Global Cycle</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Automatically sync with community cycles
              </Text>
            </View>
            <Switch
              value={true}
              onValueChange={() => {
                Alert.alert('Coming Soon', 'Global cycle preferences will be available in a future update');
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => Alert.alert('Info', 'Custom timelines can be managed from the Goal Bank screen')}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Manage Custom Timelines</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Rituals Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Rituals</Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            Configure when your daily rituals are available
          </Text>

          {/* Morning Spark */}
          <View style={[styles.ritualCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.ritualHeader}>
              <View style={styles.ritualTitleRow}>
                <Text style={[styles.ritualTitle, { color: colors.text }]}>🔥 Morning Spark</Text>
                <Switch
                  value={ritualSettings.morning_spark?.is_enabled ?? true}
                  onValueChange={(value) => {
                    setRitualSettings(prev => ({
                      ...prev,
                      morning_spark: prev.morning_spark ? { ...prev.morning_spark, is_enabled: value } : null,
                    }));
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
              <Text style={[styles.ritualDescription, { color: colors.textSecondary }]}>
                Set your daily intention and energy level
              </Text>
            </View>

            {ritualSettings.morning_spark?.is_enabled && (
              <View style={styles.ritualTimeSettings}>
                <View style={styles.timePickerRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.timeLabel, { color: colors.text }]}>Available From:</Text>
                  <TimePickerDropdown
                    value={convertTo12Hour(ritualSettings.morning_spark?.available_from || '00:00:00')}
                    onChange={(time) => {
                      const time24 = convertTo24Hour(time);
                      setRitualSettings(prev => ({
                        ...prev,
                        morning_spark: prev.morning_spark ? { ...prev.morning_spark, available_from: time24 } : null,
                      }));
                    }}
                    isDark={isDarkMode}
                  />
                </View>
                <View style={styles.timePickerRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.timeLabel, { color: colors.text }]}>Available Until:</Text>
                  <TimePickerDropdown
                    value={convertTo12Hour(ritualSettings.morning_spark?.available_until || '12:00:00')}
                    onChange={(time) => {
                      const time24 = convertTo24Hour(time);
                      setRitualSettings(prev => ({
                        ...prev,
                        morning_spark: prev.morning_spark ? { ...prev.morning_spark, available_until: time24 } : null,
                      }));
                    }}
                    isDark={isDarkMode}
                  />
                </View>
                <Text style={[styles.timeSummary, { color: colors.textSecondary }]}>
                  Available: {convertTo12Hour(ritualSettings.morning_spark?.available_from || '00:00:00')} - {convertTo12Hour(ritualSettings.morning_spark?.available_until || '12:00:00')}
                </Text>
              </View>
            )}
          </View>

          {/* Evening Review */}
          <View style={[styles.ritualCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.ritualHeader}>
              <View style={styles.ritualTitleRow}>
                <Text style={[styles.ritualTitle, { color: colors.text }]}>🌙 Evening Review</Text>
                <Switch
                  value={ritualSettings.evening_review?.is_enabled ?? true}
                  onValueChange={(value) => {
                    setRitualSettings(prev => ({
                      ...prev,
                      evening_review: prev.evening_review ? { ...prev.evening_review, is_enabled: value } : null,
                    }));
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
              <Text style={[styles.ritualDescription, { color: colors.textSecondary }]}>
                Reflect on your day and plan for tomorrow
              </Text>
            </View>

            {ritualSettings.evening_review?.is_enabled && (
              <View style={styles.ritualTimeSettings}>
                <View style={styles.timePickerRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.timeLabel, { color: colors.text }]}>Available From:</Text>
                  <TimePickerDropdown
                    value={convertTo12Hour(ritualSettings.evening_review?.available_from || '17:00:00')}
                    onChange={(time) => {
                      const time24 = convertTo24Hour(time);
                      setRitualSettings(prev => ({
                        ...prev,
                        evening_review: prev.evening_review ? { ...prev.evening_review, available_from: time24 } : null,
                      }));
                    }}
                    isDark={isDarkMode}
                  />
                </View>
                <View style={styles.timePickerRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.timeLabel, { color: colors.text }]}>Available Until:</Text>
                  <TimePickerDropdown
                    value={convertTo12Hour(ritualSettings.evening_review?.available_until || '23:59:59')}
                    onChange={(time) => {
                      const time24 = convertTo24Hour(time);
                      setRitualSettings(prev => ({
                        ...prev,
                        evening_review: prev.evening_review ? { ...prev.evening_review, available_until: time24 } : null,
                      }));
                    }}
                    isDark={isDarkMode}
                  />
                </View>
                <Text style={[styles.timeSummary, { color: colors.textSecondary }]}>
                  Available: {convertTo12Hour(ritualSettings.evening_review?.available_from || '17:00:00')} - {convertTo12Hour(ritualSettings.evening_review?.available_until || '23:59:59')}
                </Text>
              </View>
            )}
          </View>

          {/* Weekly Alignment */}
          <View style={[styles.ritualCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.ritualHeader}>
              <View style={styles.ritualTitleRow}>
                <Text style={[styles.ritualTitle, { color: colors.text }]}>📅 Weekly Alignment</Text>
                <Switch
                  value={ritualSettings.weekly_alignment?.is_enabled ?? true}
                  onValueChange={(value) => {
                    setRitualSettings(prev => ({
                      ...prev,
                      weekly_alignment: prev.weekly_alignment ? { ...prev.weekly_alignment, is_enabled: value } : null,
                    }));
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
              <Text style={[styles.ritualDescription, { color: colors.textSecondary }]}>
                Align your week with your bigger goals (Weekends only)
              </Text>
            </View>

            {ritualSettings.weekly_alignment?.is_enabled && (
              <View style={styles.ritualTimeSettings}>
                <View style={styles.timePickerRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.timeLabel, { color: colors.text }]}>Available From:</Text>
                  <TimePickerDropdown
                    value={convertTo12Hour(ritualSettings.weekly_alignment?.available_from || '00:00:00')}
                    onChange={(time) => {
                      const time24 = convertTo24Hour(time);
                      setRitualSettings(prev => ({
                        ...prev,
                        weekly_alignment: prev.weekly_alignment ? { ...prev.weekly_alignment, available_from: time24 } : null,
                      }));
                    }}
                    isDark={isDarkMode}
                  />
                </View>
                <View style={styles.timePickerRow}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={[styles.timeLabel, { color: colors.text }]}>Available Until:</Text>
                  <TimePickerDropdown
                    value={convertTo12Hour(ritualSettings.weekly_alignment?.available_until || '23:59:59')}
                    onChange={(time) => {
                      const time24 = convertTo24Hour(time);
                      setRitualSettings(prev => ({
                        ...prev,
                        weekly_alignment: prev.weekly_alignment ? { ...prev.weekly_alignment, available_until: time24 } : null,
                      }));
                    }}
                    isDark={isDarkMode}
                  />
                </View>
                <Text style={[styles.timeSummary, { color: colors.textSecondary }]}>
                  Available: {convertTo12Hour(ritualSettings.weekly_alignment?.available_from || '00:00:00')} - {convertTo12Hour(ritualSettings.weekly_alignment?.available_until || '23:59:59')}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={saveRitualSettings}
            disabled={savingRituals}
          >
            <Text style={styles.saveButtonText}>
              {savingRituals ? 'Saving...' : 'Save Ritual Settings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isDarkMode ? colors.surface : colors.surface}
            />
          </View>
        </View>

        {/* Calendar Management Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Calendar Management</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowCalendarManagement(true)}
          >
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Holidays & Special Days</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Manage which holidays and special days appear on your calendar
                </Text>
              </View>
              <Text style={[styles.settingButtonText, { color: colors.primary }]}>Manage</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Google Calendar Integration Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Google Calendar Integration</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Google Calendar</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {googleAccessToken ? 'Connected' : 'Not connected'}
              </Text>
            </View>
            {googleAccessToken ? (
              <TouchableOpacity
                style={[styles.connectButton, styles.disconnectButton]}
                onPress={disconnectGoogle}
              >
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.connectButton, { backgroundColor: colors.primary }]}
                onPress={connectToGoogle}
                disabled={isConnectingGoogle}
              >
                <Text style={styles.connectButtonText}>
                  {isConnectingGoogle ? 'Connecting...' : 'Connect'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {googleAccessToken && (
            <>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Sync Events</Text>
                <Switch
                  value={syncEnabled}
                  onValueChange={setSyncEnabled}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={syncEnabled ? colors.surface : colors.surface}
                />
              </View>

              {syncEnabled && (
                <TouchableOpacity
                  style={[styles.settingButton, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }]}
                  onPress={async () => {
                    try {
                      const supabase = getSupabaseClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;

                      Alert.alert('Syncing...', 'Fetching events from Google Calendar');
                      
                      const { syncGoogleCalendarEvents } = await import('@/lib/googleCalendarSync');
                      const result = await syncGoogleCalendarEvents(user.id);
                      
                      if (result.success) {
                        Alert.alert(
                          'Sync Complete',
                          `Fetched: ${result.eventsFetched} events\nCreated: ${result.eventsCreated}\nUpdated: ${result.eventsUpdated}\nSkipped: ${result.eventsSkipped}`
                        );
                        eventBus.emit(EVENTS.REFRESH_ALL_TASKS);
                      } else {
                        Alert.alert('Sync Failed', result.error || 'Unknown error');
                      }
                    } catch (error) {
                      Alert.alert('Error', (error as Error).message);
                    }
                  }}
                >
                  <Text style={[styles.settingButtonText, { color: colors.primary }]}>
                    🔄 Sync Now
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Notifications Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Push Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={notificationsEnabled ? colors.surface : colors.surface}
            />
          </View>
        </View>

        {/* Legal & Support Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Legal & Support</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => router.push('/privacy')}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => router.push('/terms')}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Terms of Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => router.push('/about')}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>About Authentic Intelligence Labs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => router.push('/contact')}
          >
            <Text style={[styles.settingButtonText, { color: colors.primary }]}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ManageRolesModal
        visible={isRolesModalVisible}
        onClose={() => setIsRolesModalVisible(false)}
      />

      <Modal visible={showNorthStarEditor} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>North Star</Text>
            <TouchableOpacity onPress={() => setShowNorthStarEditor(false)}>
              <Text style={[styles.closeModalButton, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <NorthStarEditor onUpdate={() => {
            console.log('[Settings] North Star data updated');
          }} />
        </SafeAreaView>
      </Modal>

      <Modal visible={showTimelineArchive} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Timeline Archive</Text>
            <TouchableOpacity onPress={() => setShowTimelineArchive(false)}>
              <Text style={[styles.closeModalButton, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <ArchivedTimelinesView onUpdate={() => {}} />
        </SafeAreaView>
      </Modal>

      <CalendarManagementModal
        visible={showCalendarManagement}
        onClose={() => setShowCalendarManagement(false)}
      />

      <Modal visible={showTimezonePicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Timezone</Text>
            <TouchableOpacity onPress={() => setShowTimezonePicker(false)}>
              <Text style={[styles.closeModalButton, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.timezonePickerScroll}>
            {Object.entries(getTimezonesByRegion()).map(([region, timezones]) => (
              <View key={region} style={styles.timezoneRegion}>
                <Text style={[styles.timezoneRegionTitle, { color: colors.textSecondary }]}>{region}</Text>
                {timezones.map((tz) => (
                  <TouchableOpacity
                    key={tz}
                    style={[
                      styles.timezoneOption,
                      profile.timezone === tz && styles.timezoneOptionSelected,
                      { borderBottomColor: colors.border }
                    ]}
                    onPress={async () => {
                      const updatedProfile = { ...profile, timezone: tz, auto_detect_timezone: false };
                      setProfile(updatedProfile);
                      await updateProfile({ timezone: tz, auto_detect_timezone: false });
                      setShowTimezonePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.timezoneOptionText,
                      { color: colors.text },
                      profile.timezone === tz && { color: colors.primary, fontWeight: '600' }
                    ]}>
                      {getTimezoneDisplayName(tz)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flex: 1 },
  content: { padding: 16 },
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  settingButton: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  settingButtonText: { fontSize: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  profilePhotoSection: { marginBottom: 24 },
  fieldLabel: { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  profilePhotoContainer: { alignItems: 'center' },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  profilePhotoButtons: { flexDirection: 'row', gap: 12 },
  photoButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  photoButtonText: { fontSize: 14, fontWeight: '500' },
  uploadingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  uploadingText: { fontSize: 14 },
  profileField: { marginBottom: 16 },
  textInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  colorField: { marginBottom: 24 },
  fieldDescription: { fontSize: 14, marginBottom: 12, marginTop: 4 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorOption: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  selectedColorOption: { borderColor: '#1f2937', borderWidth: 3 },
  colorCheckmark: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  checkmarkText: { color: '#1f2937', fontSize: 12, fontWeight: 'bold' },
  settingInfo: { flex: 1 },
  settingDescription: { fontSize: 14, marginTop: 2 },
  weekStartButtonGroup: { flexDirection: 'row', gap: 8 },
  weekStartButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, backgroundColor: 'transparent', minWidth: 50, alignItems: 'center' },
  weekStartButtonActive: { backgroundColor: '#f0f9ff', borderColor: '#0078d4', borderWidth: 2 },
  weekStartButtonText: { fontSize: 14, fontWeight: '500' },
  weekStartButtonTextActive: { fontWeight: '700' },
  connectButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  connectButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  disconnectButton: { backgroundColor: '#dc2626' },
  disconnectButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937' },
  closeModalButton: { fontSize: 16, fontWeight: '600' },
  timezoneControls: { flexDirection: 'row', gap: 8 },
  timezoneButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1 },
  timezoneButtonText: { fontSize: 14, fontWeight: '600' },
  timezonePickerScroll: { flex: 1 },
  timezoneRegion: { marginBottom: 24, paddingHorizontal: 16 },
  timezoneRegionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  timezoneOption: { paddingVertical: 12, borderBottomWidth: 1 },
  timezoneOptionSelected: { backgroundColor: 'rgba(0, 120, 212, 0.1)' },
  timezoneOptionText: { fontSize: 16 },
  refreshButton: { padding: 8 },
  storageInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  storageTotalText: { fontSize: 16, fontWeight: '600' },
  storageBreakdown: { marginTop: 8 },
  storageItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  storageItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  storageCategory: { fontSize: 15, fontWeight: '500' },
  storageSize: { fontSize: 14 },
  storageFileCount: { fontSize: 13, marginTop: 2 },
  storageLastUpdated: { fontSize: 12, marginTop: 16, fontStyle: 'italic' },
  storageLoadingContainer: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  storageEmptyText: { fontSize: 14 },
  ritualCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ritualHeader: {
    marginBottom: 12,
  },
  ritualTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ritualTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  ritualDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  ritualTimeSettings: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 110,
  },
  timeSummary: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});