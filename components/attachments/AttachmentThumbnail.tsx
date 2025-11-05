import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { File, FileText, FileSpreadsheet, FileImage } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface AttachmentThumbnailProps {
  uri: string;
  fileType: string;
  fileName: string;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export default function AttachmentThumbnail({
  uri,
  fileType,
  fileName,
  size = 'medium',
  onPress,
}: AttachmentThumbnailProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isImage = fileType?.startsWith('image/');

  React.useEffect(() => {
    console.log('[AttachmentThumbnail] Props:', { uri, fileType, fileName, isImage });
  }, [uri, fileType, fileName]);

  const sizeStyles = {
    small: { width: 48, height: 48 },
    medium: { width: 60, height: 60 },
    large: { width: 80, height: 80 },
  };

  const iconSizes = {
    small: 20,
    medium: 24,
    large: 32,
  };

  const getFileTypeIcon = () => {
    if (fileType.includes('pdf')) {
      return <FileText size={iconSizes[size]} color={colors.error} />;
    }
    if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <FileSpreadsheet size={iconSizes[size]} color="#10b981" />;
    }
    if (fileType.includes('document') || fileType.includes('word')) {
      return <FileText size={iconSizes[size]} color="#3b82f6" />;
    }
    if (isImage) {
      return <FileImage size={iconSizes[size]} color={colors.primary} />;
    }
    return <File size={iconSizes[size]} color={colors.textSecondary} />;
  };

  const content = (
    <View
      style={[
        styles.container,
        sizeStyles[size],
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {isImage && !error ? (
        <>
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="cover"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </>
      ) : (
        <View style={styles.iconContainer}>{getFileTypeIcon()}</View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
