import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image as ImageIcon, File } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ReflectionAttachment } from '@/lib/reflectionUtils';
import AttachmentThumbnail from './AttachmentThumbnail';
import ImageViewerModal from '../reflections/ImageViewerModal';

interface AttachmentGalleryViewProps {
  attachments: ReflectionAttachment[];
  onAttachmentPress?: (attachment: ReflectionAttachment, index: number) => void;
}

export default function AttachmentGalleryView({
  attachments,
  onAttachmentPress,
}: AttachmentGalleryViewProps) {
  const { colors } = useTheme();
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const { width: screenWidth } = Dimensions.get('window');
  const numColumns = screenWidth > 600 ? 4 : 3;

  const imageAttachments = attachments.filter((att) =>
    att.file_type.startsWith('image/')
  );
  const documentAttachments = attachments.filter(
    (att) => !att.file_type.startsWith('image/')
  );

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setImageViewerVisible(true);
  };

  const handleDocumentPress = (attachment: ReflectionAttachment, index: number) => {
    onAttachmentPress?.(attachment, index);
  };

  const renderImageItem = ({ item, index }: { item: ReflectionAttachment; index: number }) => {
    const itemWidth = (screenWidth - 48 - (numColumns - 1) * 8) / numColumns;

    return (
      <TouchableOpacity
        style={[styles.gridItem, { width: itemWidth, height: itemWidth }]}
        onPress={() => handleImagePress(index)}
        activeOpacity={0.7}
      >
        <AttachmentThumbnail
          uri={item.public_url || ''}
          fileType={item.file_type}
          fileName={item.file_name}
          size="large"
        />
      </TouchableOpacity>
    );
  };

  const renderDocumentItem = ({ item, index }: { item: ReflectionAttachment; index: number }) => (
    <TouchableOpacity
      style={[
        styles.documentItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => handleDocumentPress(item, index)}
      activeOpacity={0.7}
    >
      <View style={styles.documentIcon}>
        <AttachmentThumbnail
          uri={item.public_url || ''}
          fileType={item.file_type}
          fileName={item.file_name}
          size="medium"
        />
      </View>
      <View style={styles.documentInfo}>
        <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={2}>
          {item.file_name}
        </Text>
        <Text style={[styles.documentSize, { color: colors.textSecondary }]}>
          {formatFileSize(item.file_size)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (attachments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ImageIcon size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No attachments yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {imageAttachments.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ImageIcon size={20} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Images ({imageAttachments.length})
            </Text>
          </View>
          <FlatList
            data={imageAttachments}
            renderItem={renderImageItem}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
          />
        </View>
      )}

      {documentAttachments.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <File size={20} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Documents ({documentAttachments.length})
            </Text>
          </View>
          <FlatList
            data={documentAttachments}
            renderItem={renderDocumentItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.documentList}
          />
        </View>
      )}

      <ImageViewerModal
        visible={imageViewerVisible}
        images={imageAttachments}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  gridContent: {
    paddingBottom: 8,
  },
  gridRow: {
    gap: 8,
    marginBottom: 8,
  },
  gridItem: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  documentList: {
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  documentIcon: {
    width: 60,
    height: 60,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  documentSize: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
