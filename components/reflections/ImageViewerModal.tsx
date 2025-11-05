import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ReflectionAttachment } from '@/lib/reflectionUtils';

interface ImageViewerModalProps {
  visible: boolean;
  images: ReflectionAttachment[];
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

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const lastTapTime = useRef(0);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setImageLoading(true);
      setImageError(false);
      resetZoomAndPosition();
    }
  }, [visible, initialIndex]);

  React.useEffect(() => {
    resetZoomAndPosition();
  }, [currentIndex]);

  const resetZoomAndPosition = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setImageLoading(true);
      setImageError(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setImageLoading(true);
      setImageError(false);
    }
  };

  const handleDoubleTap = () => {
    if (scale.value > 1) {
      scale.value = withSpring(1);
      savedScale.value = 1;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    } else {
      scale.value = withSpring(2);
      savedScale.value = 2;
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 4) {
        scale.value = withSpring(4);
        savedScale.value = 4;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime.current;

      if (timeSinceLastTap < 300) {
        runOnJS(handleDoubleTap)();
      }

      lastTapTime.current = now;
    });

  const swipeGesture = Gesture.Pan()
    .onEnd((e) => {
      if (scale.value <= 1) {
        if (e.velocityX > 500 && e.translationX > 50) {
          runOnJS(handlePrevious)();
        } else if (e.velocityX < -500 && e.translationX < -50) {
          runOnJS(handleNext)();
        }
      }
    });

  const composedGestures = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    swipeGesture,
    tapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={28} color="#ffffff" />
          </TouchableOpacity>
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
            <GestureDetector gesture={composedGestures}>
              <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                <Image
                  source={{ uri: currentImage.public_url }}
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
              </Animated.View>
            </GestureDetector>
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
