import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  X,
  Paperclip,
  Calendar as CalendarIcon,
  Bold,
  Italic,
  AlignCenter,
  List,
  ListOrdered,
  Image as ImageIcon,
  File,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import AttachmentThumbnail from '../attachments/AttachmentThumbnail';
import { getAttachmentSignedUrl } from '@/lib/reflectionUtils';
import { Calendar } from 'react-native-calendars';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getSupabaseClient } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { formatLocalDate } from '@/lib/dateUtils';
import {
  saveReflection,
  updateReflection,
  archiveReflection,
  ReflectionWithRelations,
} from '@/lib/reflectionUtils';
import { eventBus, EVENTS } from '@/lib/eventBus';

interface Role {
  id: string;
  label: string;
  color?: string;
}

interface Domain {
  id: string;
  name: string;
  color?: string;
}

interface KeyRelationship {
  id: string;
  name: string;
  role_id: string;
}

interface JournalFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialData?: ReflectionWithRelations;
  onClose: () => void;
  onSaveSuccess?: () => void;
  onActionSelected?: (action: ActionType, data: ActionData) => void;
  openedFromJournal?: boolean;
  reflectionType?: 'rose' | 'thorn' | 'reflection';
}

type ActionType = 'task' | 'event' | 'depositIdea' | 'withdrawal' | 'followUp';

interface ActionData {
  notes: string;
  selectedRoleIds: string[];
  selectedDomainIds: string[];
  selectedKeyRelationshipIds: string[];
}

export default function JournalForm({
  visible,
  mode,
  initialData,
  onClose,
  onSaveSuccess,
  onActionSelected,
  openedFromJournal = false,
  reflectionType = 'reflection',
}: JournalFormProps) {
  const { colors, isDarkMode } = useTheme();

  const [content, setContent] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedKeyRelationshipIds, setSelectedKeyRelationshipIds] = useState<string[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [keyRelationships, setKeyRelationships] = useState<KeyRelationship[]>([]);
  const [filteredKeyRelationships, setFilteredKeyRelationships] = useState<KeyRelationship[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [showFollowUpCalendar, setShowFollowUpCalendar] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [textFormat, setTextFormat] = useState({
    bold: false,
    italic: false,
    center: false,
    bullet: false,
    number: false,
  });

  useEffect(() => {
    if (visible) {
      fetchData();
      if (mode === 'edit' && initialData) {
        populateFormWithInitialData();
      } else {
        resetForm();
      }
    }
  }, [visible, mode, initialData]);

  // Auto-expand Advanced section when editing with existing tags
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const hasAdvancedData =
        (initialData.roles && initialData.roles.length > 0) ||
        (initialData.domains && initialData.domains.length > 0) ||
        (initialData.keyRelationships && initialData.keyRelationships.length > 0);
      if (hasAdvancedData) {
        setShowAdvanced(true);
      }
    } else {
      setShowAdvanced(false);
    }
  }, [mode, initialData]);

  useEffect(() => {
    // Filter key relationships based on selected roles
    if (selectedRoleIds.length > 0) {
      const filtered = keyRelationships.filter((kr) =>
        selectedRoleIds.includes(kr.role_id)
      );
      setFilteredKeyRelationships(filtered);
    } else {
      setFilteredKeyRelationships([]);
    }
  }, [selectedRoleIds, keyRelationships]);

  const populateFormWithInitialData = async () => {
    if (!initialData) return;

    setContent(initialData.content || '');
    setSelectedRoleIds(initialData.roles?.map((r) => r.id) || []);
    setSelectedDomainIds(initialData.domains?.map((d) => d.id) || []);
    setSelectedKeyRelationshipIds(
      initialData.keyRelationships?.map((kr) => kr.id) || []
    );
    setFollowUpDate(initialData.follow_up_date || null);

    // Load existing attachments
    if (initialData.id) {
      await loadExistingAttachments(initialData.id);
    }
  };

  const loadExistingAttachments = async (reflectionId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('0008-ap-reflection-attachments')
        .select('*')
        .eq('reflection_id', reflectionId);

      if (error) throw error;

      if (data && data.length > 0) {
        const attachmentsPromises = data.map(async (att: any) => {
          let fileType = att.file_type;
          if (!fileType || !fileType.includes('/')) {
            const fileName = att.file_name.toLowerCase();
            if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) fileType = 'image/jpeg';
            else if (fileName.endsWith('.png')) fileType = 'image/png';
            else if (fileName.endsWith('.gif')) fileType = 'image/gif';
            else if (fileName.endsWith('.webp')) fileType = 'image/webp';
            else if (fileName.endsWith('.heic')) fileType = 'image/heic';
            else if (fileName.endsWith('.pdf')) fileType = 'application/pdf';
            else if (fileName.endsWith('.txt')) fileType = 'text/plain';
            else fileType = 'application/octet-stream';
          }

          const signedUrl = await getAttachmentSignedUrl(att.file_path);

          return {
            id: att.id,
            uri: signedUrl,
            filePath: att.file_path,
            name: att.file_name,
            type: fileType,
            size: att.file_size,
            isExisting: true,
          };
        });

        const attachments = await Promise.all(attachmentsPromises);
        setAttachedFiles(attachments);
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  };

  const resetForm = () => {
    setContent('');
    setSelectedRoleIds([]);
    setSelectedDomainIds([]);
    setSelectedKeyRelationshipIds([]);
    setFollowUpDate(null);
    setAttachedFiles([]);
  };

  const uploadFileToStorage = async (file: any, userId: string): Promise<string | null> => {
    try {
      const supabase = getSupabaseClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Read file as blob for web, or use URI for native
      let fileData: any;
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        fileData = await response.blob();
      } else {
        // For native, we need to read the file
        const response = await fetch(file.uri);
        fileData = await response.blob();
      }

      const { data, error } = await supabase.storage
        .from('0008-reflection-attachments')
        .upload(filePath, fileData, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      return filePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
        const validFiles: any[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.fileSize || 0;
          const fileName = asset.fileName || 'image.jpg';

          // Determine MIME type from URI or filename
          let mimeType = 'image/jpeg';
          if (asset.uri) {
            const lowerUri = asset.uri.toLowerCase();
            if (lowerUri.endsWith('.png')) mimeType = 'image/png';
            else if (lowerUri.endsWith('.gif')) mimeType = 'image/gif';
            else if (lowerUri.endsWith('.webp')) mimeType = 'image/webp';
            else if (lowerUri.endsWith('.heic')) mimeType = 'image/heic';
          }

          if (fileSize > MAX_FILE_SIZE) {
            oversizedFiles.push(`${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: fileName,
              type: mimeType,
              size: fileSize,
            });
          }
        });

        if (oversizedFiles.length > 0) {
          Alert.alert(
            'File Size Limit Exceeded',
            `The following files exceed the 10 MB limit and cannot be attached:\n\n${oversizedFiles.join('\n')}\n\nPlease choose smaller files.`
          );
        }

        if (validFiles.length > 0) {
          setAttachedFiles([...attachedFiles, ...validFiles]);
        }

        setShowAttachmentPicker(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
        const validFiles: any[] = [];
        const oversizedFiles: string[] = [];

        result.assets.forEach(asset => {
          const fileSize = asset.size || 0;
          const fileName = asset.name;

          if (fileSize > MAX_FILE_SIZE) {
            oversizedFiles.push(`${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
          } else {
            validFiles.push({
              uri: asset.uri,
              name: fileName,
              type: asset.mimeType || 'application/octet-stream',
              size: fileSize,
            });
          }
        });

        if (oversizedFiles.length > 0) {
          Alert.alert(
            'File Size Limit Exceeded',
            `The following files exceed the 10 MB limit and cannot be attached:\n\n${oversizedFiles.join('\n')}\n\nPlease choose smaller files.`
          );
        }

        if (validFiles.length > 0) {
          setAttachedFiles([...attachedFiles, ...validFiles]);
        }

        setShowAttachmentPicker(false);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleRemoveAttachment = async (index: number) => {
    const fileToRemove = attachedFiles[index];

    if (fileToRemove.isExisting && fileToRemove.id) {
      try {
        const supabase = getSupabaseClient();

        if (fileToRemove.filePath) {
          await supabase.storage
            .from('0008-reflection-attachments')
            .remove([fileToRemove.filePath]);
        }

        await supabase
          .from('0008-ap-reflection-attachments')
          .delete()
          .eq('id', fileToRemove.id);
      } catch (error) {
        console.error('Error deleting attachment:', error);
        Alert.alert('Error', 'Failed to delete attachment');
        return;
      }
    }

    const newFiles = attachedFiles.filter((_, i) => i !== index);
    setAttachedFiles(newFiles);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [rolesData, domainsData, keyRelsData] = await Promise.all([
        supabase
          .from('0008-ap-roles')
          .select('*')
          .eq('user_id', user.id)
          .order('label', { ascending: true }),
        supabase
          .from('0008-ap-domains')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('0008-ap-key-relationships')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ]);

      if (rolesData.data) setRoles(rolesData.data);
      if (domainsData.data) setDomains(domainsData.data);
      if (keyRelsData.data) setKeyRelationships(keyRelsData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Required', 'Please write your reflection before saving.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let reflectionId: string;

      if (mode === 'edit' && initialData) {
        const success = await updateReflection(
          initialData.id,
          user.id,
          content,
          selectedRoleIds,
          selectedDomainIds,
          selectedKeyRelationshipIds,
          !!followUpDate,
          followUpDate || undefined,
          undefined, // imagePaths
          reflectionType === 'rose',
          reflectionType === 'thorn'
        );

        if (!success) {
          throw new Error('Failed to update reflection');
        }
        reflectionId = initialData.id;
      } else {
        const newReflectionId = await saveReflection(
          user.id,
          content,
          selectedRoleIds,
          selectedDomainIds,
          selectedKeyRelationshipIds,
          'daily',
          !!followUpDate,
          followUpDate || undefined,
          undefined, // imagePaths
          reflectionType === 'rose',
          reflectionType === 'thorn'
        );

        if (!newReflectionId) {
          throw new Error('Failed to save reflection');
        }
        reflectionId = newReflectionId;
      }

      // Upload only new attachments (not existing ones)
      const newAttachments = attachedFiles.filter(file => !file.isExisting);
      if (newAttachments.length > 0) {
        const uploadPromises = newAttachments.map(async (file) => {
          const filePath = await uploadFileToStorage(file, user.id);
          if (filePath) {
            // Save attachment metadata to database
            const { error } = await supabase
              .from('0008-ap-reflection-attachments')
              .insert({
                reflection_id: reflectionId,
                user_id: user.id,
                file_name: file.name,
                file_path: filePath,
                file_type: file.type,
                file_size: file.size,
              });

            if (error) {
              console.error('Error saving attachment metadata:', error);
            }
          }
        });

        await Promise.all(uploadPromises);
      }

      Alert.alert('Success', mode === 'edit' ? 'Reflection updated successfully' : 'Reflection saved successfully');
      eventBus.emit(mode === 'edit' ? EVENTS.REFLECTION_UPDATED : EVENTS.REFLECTION_CREATED);
      onSaveSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving reflection:', error);
      Alert.alert('Error', 'Failed to save reflection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;

    Alert.alert(
      'Delete Reflection',
      'Are you sure you want to delete this reflection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const supabase = getSupabaseClient();
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) throw new Error('User not authenticated');

              const success = await archiveReflection(initialData.id, user.id);

              if (success) {
                Alert.alert('Success', 'Reflection deleted successfully');
                eventBus.emit(EVENTS.REFLECTION_DELETED);
                onSaveSuccess?.();
                onClose();
              } else {
                throw new Error('Failed to delete reflection');
              }
            } catch (error) {
              console.error('Error deleting reflection:', error);
              Alert.alert('Error', 'Failed to delete reflection. Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleActionButton = (action: ActionType) => {
    if (!content.trim()) {
      Alert.alert('Required', 'Please write your reflection before proceeding.');
      return;
    }

    if (action === 'followUp') {
      setShowFollowUpCalendar(true);
    } else {
      const actionData: ActionData = {
        notes: content,
        selectedRoleIds,
        selectedDomainIds,
        selectedKeyRelationshipIds,
      };
      onActionSelected?.(action, actionData);
      onClose();
    }
  };

  const handleFollowUpDateSelect = async (dateString: string) => {
    setFollowUpDate(dateString);
    setShowFollowUpCalendar(false);

    // Save reflection with follow-up date
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const reflectionId = await saveReflection(
        user.id,
        content,
        selectedRoleIds,
        selectedDomainIds,
        selectedKeyRelationshipIds,
        'daily',
        true,
        dateString,
        undefined, // imagePaths
        reflectionType === 'rose',
        reflectionType === 'thorn'
      );

      if (reflectionId) {
        Alert.alert('Success', 'Reflection saved with follow-up date');
        eventBus.emit(EVENTS.REFLECTION_CREATED);
        onSaveSuccess?.();
        onClose();
      } else {
        throw new Error('Failed to save reflection');
      }
    } catch (error) {
      console.error('Error saving reflection with follow-up:', error);
      Alert.alert('Error', 'Failed to save reflection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleDomain = (domainId: string) => {
    setSelectedDomainIds((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId]
    );
  };

  const toggleKeyRelationship = (krId: string) => {
    setSelectedKeyRelationshipIds((prev) =>
      prev.includes(krId) ? prev.filter((id) => id !== krId) : [...prev, krId]
    );
  };

  const styles = getStyles(colors, isDarkMode);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === 'edit'
              ? initialData?.daily_rose
                ? 'Edit Rose'
                : initialData?.daily_thorn
                  ? 'Edit Thorn'
                  : 'Edit Deposit Idea'
              : reflectionType === 'rose'
                ? 'New Rose'
                : reflectionType === 'thorn'
                  ? 'New Thorn'
                  : 'New Reflection'}
          </Text>
          <View style={styles.headerRight}>
            {mode === 'edit' && (
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.deleteButton}
                disabled={saving}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.6}
              >
                <Text style={[styles.deleteText, saving && styles.deleteTextDisabled]}>Delete</Text>
              </TouchableOpacity>
            )}
            {mode === 'create' && <View style={{ width: 60 }} />}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Journal Tab Message */}
            {openedFromJournal && mode === 'edit' && (
              <View style={styles.journalMessage}>
                <Text style={styles.journalMessageText}>
                  You are updating a reflection. Your changes will be saved and it will remain in your Journal with the updated information.
                </Text>
              </View>
            )}

            {/* Reflection Content */}
            <View style={styles.section}>
              <Text style={styles.label}>Reflection</Text>

              {/* Rich Text Toolbar */}
              <View style={styles.toolbarContainer}>
                <TouchableOpacity
                  style={[styles.toolbarButton, textFormat.bold && styles.toolbarButtonActive]}
                  onPress={() => setTextFormat({ ...textFormat, bold: !textFormat.bold })}
                >
                  <Bold size={20} color={textFormat.bold ? colors.primary : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, textFormat.italic && styles.toolbarButtonActive]}
                  onPress={() => setTextFormat({ ...textFormat, italic: !textFormat.italic })}
                >
                  <Italic size={20} color={textFormat.italic ? colors.primary : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, textFormat.center && styles.toolbarButtonActive]}
                  onPress={() => setTextFormat({ ...textFormat, center: !textFormat.center })}
                >
                  <AlignCenter size={20} color={textFormat.center ? colors.primary : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, textFormat.bullet && styles.toolbarButtonActive]}
                  onPress={() => setTextFormat({ ...textFormat, bullet: !textFormat.bullet })}
                >
                  <List size={20} color={textFormat.bullet ? colors.primary : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolbarButton, textFormat.number && styles.toolbarButtonActive]}
                  onPress={() => setTextFormat({ ...textFormat, number: !textFormat.number })}
                >
                  <ListOrdered size={20} color={textFormat.number ? colors.primary : colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={() => setShowAttachmentPicker(true)}
                >
                  <Paperclip size={20} color={colors.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.textArea,
                  textFormat.bold && { fontWeight: 'bold' },
                  textFormat.italic && { fontStyle: 'italic' },
                  textFormat.center && { textAlign: 'center' },
                ]}
                placeholder="Write your reflection..."
                placeholderTextColor={colors.textSecondary}
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Attached Files Display */}
              {attachedFiles.length > 0 && (
                <View style={styles.attachmentsContainer}>
                  <Text style={[styles.attachmentsLabel, { color: colors.textSecondary }]}>
                    Attachments ({attachedFiles.length})
                  </Text>
                  <View style={styles.attachmentsGrid}>
                    {attachedFiles.map((file, index) => (
                      <View key={index} style={styles.attachmentThumbnailWrapper}>
                        <AttachmentThumbnail
                          uri={file.uri}
                          fileType={file.type}
                          fileName={file.name}
                          size="medium"
                        />
                        <TouchableOpacity
                          style={[styles.removeButton, { backgroundColor: colors.error }]}
                          onPress={() => handleRemoveAttachment(index)}
                        >
                          <X size={14} color="#ffffff" />
                        </TouchableOpacity>
                        <Text
                          style={[styles.thumbnailFileName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {file.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Advanced Options Toggle */}
            <TouchableOpacity
              style={[styles.advancedToggle, { borderColor: colors.border }]}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Text style={[styles.advancedToggleText, { color: colors.primary }]}>
                {showAdvanced ? 'Hide Advanced Options' : 'Advanced Options'}
              </Text>
              {showAdvanced ? (
                <ChevronUp size={18} color={colors.primary} />
              ) : (
                <ChevronDown size={18} color={colors.primary} />
              )}
            </TouchableOpacity>

            {/* Advanced Options Content */}
            {showAdvanced && (
              <>
                {(roles.length > 0 || domains.length > 0 || filteredKeyRelationships.length > 0) && (
                  <View style={styles.section}>
                    <Text style={[styles.helperText, { fontStyle: 'italic' }]}>
                      Is this reflection associated with any of the following roles or domains? If so, check those that are applicable.
                    </Text>
                  </View>
                )}

                {/* Roles */}
                {roles.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.checkboxContainer}>
                      <Text style={styles.label}>Roles</Text>
                      <View style={styles.checkboxList}>
                        {roles.map((role) => (
                          <TouchableOpacity
                            key={role.id}
                            style={styles.checkboxRow}
                            onPress={() => toggleRole(role.id)}
                          >
                            <View
                              style={[
                                styles.checkboxSquare,
                                { borderColor: colors.border },
                                selectedRoleIds.includes(role.id) && {
                                  backgroundColor: colors.primary,
                                  borderColor: colors.primary,
                                },
                              ]}
                            >
                              {selectedRoleIds.includes(role.id) && (
                                <Text style={styles.checkmark}>✓</Text>
                              )}
                            </View>
                            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                              {role.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Domains */}
                {domains.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.checkboxContainer}>
                      <Text style={styles.label}>Domains</Text>
                      <View style={styles.checkboxList}>
                        {domains.map((domain) => (
                          <TouchableOpacity
                            key={domain.id}
                            style={styles.checkboxRow}
                            onPress={() => toggleDomain(domain.id)}
                          >
                            <View
                              style={[
                                styles.checkboxSquare,
                                { borderColor: colors.border },
                                selectedDomainIds.includes(domain.id) && {
                                  backgroundColor: colors.primary,
                                  borderColor: colors.primary,
                                },
                              ]}
                            >
                              {selectedDomainIds.includes(domain.id) && (
                                <Text style={styles.checkmark}>✓</Text>
                              )}
                            </View>
                            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                              {domain.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Key Relationships */}
                {filteredKeyRelationships.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.checkboxContainer}>
                      <Text style={styles.label}>Key Relationships</Text>
                      <View style={styles.checkboxList}>
                        {filteredKeyRelationships.map((kr) => (
                          <TouchableOpacity
                            key={kr.id}
                            style={styles.checkboxRow}
                            onPress={() => toggleKeyRelationship(kr.id)}
                          >
                            <View
                              style={[
                                styles.checkboxSquare,
                                { borderColor: colors.border },
                                selectedKeyRelationshipIds.includes(kr.id) && {
                                  backgroundColor: colors.primary,
                                  borderColor: colors.primary,
                                },
                              ]}
                            >
                              {selectedKeyRelationshipIds.includes(kr.id) && (
                                <Text style={styles.checkmark}>✓</Text>
                              )}
                            </View>
                            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                              {kr.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Actions */}
            <View style={styles.section}>
              <Text style={styles.label}>Actions</Text>
              <Text style={styles.helperText}>
                Do you want to take any of the following actions on this reflection?
              </Text>
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleActionButton('task')}
                >
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Create a Task</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleActionButton('event')}
                >
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Create an Event</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleActionButton('depositIdea')}
                >
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Create a Deposit Idea</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleActionButton('followUp')}
                >
                  <Text style={[styles.actionButtonText, { color: colors.text }]}>Follow Up</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {mode === 'edit' ? 'Update' : 'Save'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Follow-Up Calendar Modal */}
        <Modal
          visible={showFollowUpCalendar}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFollowUpCalendar(false)}
        >
          <View style={styles.calendarModalOverlay}>
            <View style={styles.calendarModalContent}>
              <View style={styles.calendarModalHeader}>
                <Text style={styles.calendarModalTitle}>Select Follow-Up Date</Text>
                <TouchableOpacity onPress={() => setShowFollowUpCalendar(false)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Calendar
                current={formatLocalDate(new Date())}
                minDate={formatLocalDate(new Date())}
                onDayPress={(day) => handleFollowUpDateSelect(day.dateString)}
                theme={{
                  backgroundColor: colors.surface,
                  calendarBackground: colors.surface,
                  textSectionTitleColor: colors.text,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: colors.primary,
                  dayTextColor: colors.text,
                  textDisabledColor: colors.textSecondary,
                  monthTextColor: colors.text,
                  arrowColor: colors.primary,
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Attachment Picker Modal */}
        <Modal
          visible={showAttachmentPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAttachmentPicker(false)}
        >
          <View style={styles.calendarModalOverlay}>
            <View style={styles.attachmentPickerContent}>
              <View style={styles.calendarModalHeader}>
                <Text style={styles.calendarModalTitle}>Add Attachment</Text>
                <TouchableOpacity onPress={() => setShowAttachmentPicker(false)}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.attachmentOption, { borderColor: colors.border }]}
                onPress={handlePickImage}
              >
                <ImageIcon size={24} color={colors.primary} />
                <Text style={[styles.attachmentOptionText, { color: colors.text }]}>
                  Choose Image
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachmentOption, { borderColor: colors.border }]}
                onPress={handlePickDocument}
              >
                <File size={24} color={colors.primary} />
                <Text style={[styles.attachmentOptionText, { color: colors.text }]}>
                  Choose Document
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    closeButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    deleteButton: {
      padding: 8,
      minWidth: 60,
      alignItems: 'center',
    },
    deleteText: {
      color: colors.error || '#ef4444',
      fontSize: 16,
      fontWeight: '600',
    },
    deleteTextDisabled: {
      opacity: 0.4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
    },
    journalMessage: {
      backgroundColor: '#ede9fe',
      borderLeftWidth: 4,
      borderLeftColor: '#8b5cf6',
      padding: 12,
      marginBottom: 16,
      borderRadius: 8,
    },
    journalMessageText: {
      fontSize: 14,
      color: '#5b21b6',
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    textArea: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      minHeight: 150,
      fontSize: 16,
      color: colors.text,
    },
    checkboxGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    checkbox: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    checkboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxText: {
      fontSize: 14,
      color: colors.text,
    },
    checkboxTextSelected: {
      color: '#ffffff',
      fontWeight: '600',
    },
    actionButtonsContainer: {
      gap: 12,
    },
    actionButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    actionButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 32,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    calendarModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    calendarModalContent: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      width: '90%',
      maxWidth: 400,
    },
    calendarModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    calendarModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    checkboxList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '48%',
      marginBottom: 8,
    },
    checkboxSquare: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderRadius: 4,
      marginRight: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#ffffff',
    },
    checkmark: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    checkboxLabel: {
      fontSize: 14,
      flex: 1,
    },
    checkboxContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toolbarContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 8,
      marginBottom: 8,
      gap: 8,
    },
    toolbarButton: {
      padding: 8,
      borderRadius: 4,
    },
    toolbarButtonActive: {
      backgroundColor: colors.primaryLight || `${colors.primary}20`,
    },
    actionButtonsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    actionButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      minWidth: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    attachmentsContainer: {
      marginTop: 12,
    },
    attachmentsLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
    },
    attachmentsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    attachmentThumbnailWrapper: {
      width: 80,
      alignItems: 'center',
      gap: 4,
    },
    removeButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 4,
    },
    thumbnailFileName: {
      fontSize: 10,
      textAlign: 'center',
      width: '100%',
    },
    attachmentPickerContent: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      width: '90%',
      maxWidth: 400,
    },
    attachmentOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      marginVertical: 8,
      gap: 12,
    },
    attachmentOptionText: {
      fontSize: 16,
      fontWeight: '500',
    },
    advancedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      marginHorizontal: 0,
      marginTop: 4,
      marginBottom: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      gap: 6,
    },
    advancedToggleText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
