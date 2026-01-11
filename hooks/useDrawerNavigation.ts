import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useState, useCallback } from 'react';

type DrawerNavigation = DrawerNavigationProp<any>;

interface UseDrawerNavigationReturn {
  openMenu: () => void;
  closeMenu: () => void;
  isMenuOpen: boolean;
}

export function useDrawerNavigation(): UseDrawerNavigationReturn {
  const navigation = useNavigation<DrawerNavigation>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const openMenu = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsMenuOpen(true);
    } else {
      if (typeof navigation.openDrawer === 'function') {
        navigation.openDrawer();
      }
    }
  }, [navigation]);

  const closeMenu = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsMenuOpen(false);
    } else {
      if (typeof navigation.closeDrawer === 'function') {
        navigation.closeDrawer();
      }
    }
  }, [navigation]);

  return {
    openMenu,
    closeMenu,
    isMenuOpen,
  };
}
