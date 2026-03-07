import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface ImageAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  created_at: string;
  public_url?: string;
}

interface ImageViewerModalProps {
  visible: boolean;
  images: ImageAttachment[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageViewerModal({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: ImageViewerModalProps) {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setImageLoading(true);
      setImageError(false);
    }
  }, [visible, initialIndex]);

  React.useEffect(() => {
    setImageLoading(true);
    setImageError(false);
  }, [currentIndex]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const currentImage = images[currentIndex];

  if (!currentImage) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} transparent>
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.imageCounter, { color: '#ffffff' }]}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {(currentImage.public_url || (currentImage as any).uri) && (
              <TouchableOpacity
                onPress={() => Linking.openURL(currentImage.public_url || (currentImage as any).uri)}
                style={styles.downloadButton}
              >
                <Download size={22} color="#ffffff" />
                <Text style={styles.downloadText}>Open / Download</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={28} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}

          {imageError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load image</Text>
            </View>
          ) : (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: currentImage.public_url || (currentImage as any).uri }}
                style={{
                  width: screenWidth,
                  height: screenHeight - 120,
                }}
                resizeMode="contain"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
            </View>
          )}
        </View>

        {images.length > 1 && (
          <View style={[styles.navigation, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]}>
            <TouchableOpacity
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              style={[
                styles.navButton,
                currentIndex === 0 && styles.navButtonDisabled,
              ]}
            >
              <ChevronLeft
                size={32}
                color={currentIndex === 0 ? '#666666' : '#ffffff'}
              />
            </TouchableOpacity>

            <View style={styles.imageInfo}>
              <Text style={[styles.imageName, { color: '#ffffff' }]} numberOfLines={1}>
                {currentImage.file_name}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleNext}
              disabled={currentIndex === images.length - 1}
              style={[
                styles.navButton,
                currentIndex === images.length - 1 && styles.navButtonDisabled,
              ]}
            >
              <ChevronRight
                size={32}
                color={currentIndex === images.length - 1 ? '#666666' : '#ffffff'}
              />
            </TouchableOpacity>
          </View>
        )}

        {images.length === 1 && (
          <View style={[styles.footer, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]}>
            <Text style={[styles.imageName, { color: '#ffffff' }]} numberOfLines={1}>
              {currentImage.file_name}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  downloadText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  imageCounter: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  imageInfo: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  imageName: {
    fontSize: 14,
    textAlign: 'center',
  },
});
