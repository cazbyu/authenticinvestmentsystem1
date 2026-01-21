import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Menu, ArrowUpDown, ChevronLeft, CreditCard as Edit } from 'lucide-react-native';
import { useAuthenticScore } from '@/contexts/AuthenticScoreContext';
import { useTheme } from '@/contexts/ThemeContext';
import { WebNavigationMenu } from './WebNavigationMenu';

type DashboardView = 'deposits' | 'ideas' | 'journal' | 'analytics';
type CalendarView = 'daily' | 'weekly' | 'monthly';
type ReflectionView = 'daily' | 'weekly' | 'reflectionHistory';
type ViewType = DashboardView | CalendarView | ReflectionView;

interface HeaderProps {
  title?: string;
  activeView?: ViewType;
  onViewChange?: (view: ViewType) => void;
  onSortPress?: () => void;
  authenticScore?: number;
  onBackPress?: () => void;
  backgroundColor?: string;
  onEditPress?: () => void;
  daysRemaining?: number;
  cycleProgressPercentage?: number;
  cycleTitle?: string;
  forceShowMenu?: boolean;
}

export function Header({
  title,
  activeView,
  onViewChange,
  onSortPress,
  authenticScore: propAuthenticScore,
  onBackPress,
  backgroundColor,
  onEditPress,
  daysRemaining,
  cycleProgressPercentage,
  cycleTitle,
  forceShowMenu = false
}: HeaderProps) {
  const router = useRouter();
  const canGoBack = router.canGoBack();
  const { authenticScore: contextAuthenticScore } = useAuthenticScore();
  const { colors } = useTheme();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const displayScore = propAuthenticScore ?? contextAuthenticScore;

  const handleLeftButtonPress = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (forceShowMenu) {
      setIsMenuVisible(true);
      return;
    }
    if (canGoBack) {
      router.back();
    } else {
      setIsMenuVisible(true);
    }
  };

  const headerBackgroundColor = backgroundColor || colors.primary;

  return (
    <>
      <View style={[styles.container, { backgroundColor: headerBackgroundColor }]}>
        <View style={styles.topSection}>
          <TouchableOpacity style={styles.menuButton} onPress={handleLeftButtonPress}>
            {(forceShowMenu || !canGoBack) ? <Menu size={24} color="#ffffff" /> : <ChevronLeft size={24} color="#ffffff" />}
          </TouchableOpacity>

          <View style={styles.titleSection}>
            <Text style={styles.title}>{title || 'Authentic'}</Text>
            {!title && <Text style={styles.subtitle}>Investments</Text>}
            {onEditPress && (
              <TouchableOpacity style={styles.editButton} onPress={onEditPress}>
                <Edit size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>Authentic Total Score</Text>
            <Text style={styles.scoreValue}>{displayScore}</Text>
          </View>

          {daysRemaining !== undefined && cycleProgressPercentage !== undefined && (
            <View style={styles.cycleContainer}>
              <Text style={styles.cycleLabel}>
                {cycleTitle ? cycleTitle.substring(0, 12) + (cycleTitle.length > 12 ? '...' : '') : 'Cycle'}
              </Text>
              <Text style={styles.cycleValue}>{daysRemaining}d</Text>
              <View style={styles.cycleProgressBar}>
                <View
                  style={[
                    styles.cycleProgressFill,
                    { width: `${Math.min(100, Math.max(0, cycleProgressPercentage))}%` }
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {(activeView && onViewChange) && (
          <View style={styles.bottomSection}>
            <View style={styles.toggleContainer}>
              {(['deposits', 'ideas', 'journal', 'analytics'] as const).includes(activeView as any) ? (
                <>
                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'deposits' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('deposits')}
                  >
                    <Text style={[styles.toggleText, activeView === 'deposits' && { color: headerBackgroundColor }]}>
                      Act
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'ideas' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('ideas')}
                  >
                    <Text style={[styles.toggleText, activeView === 'ideas' && { color: headerBackgroundColor }]}>
                      Ideas
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'journal' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('journal')}
                  >
                    <Text style={[styles.toggleText, activeView === 'journal' && { color: headerBackgroundColor }]}>
                      Journal
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'analytics' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('analytics')}
                  >
                    <Text style={[styles.toggleText, activeView === 'analytics' && { color: headerBackgroundColor }]}>
                      Analytics
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (title === 'Reflections' || activeView === 'reflectionHistory') ? (
                <>
                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'daily' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('daily')}
                  >
                    <Text style={[styles.toggleText, activeView === 'daily' && { color: headerBackgroundColor }]}>
                      Daily
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'weekly' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('weekly')}
                  >
                    <Text style={[styles.toggleText, activeView === 'weekly' && { color: headerBackgroundColor }]}>
                      Weekly
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'reflectionHistory' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('reflectionHistory')}
                  >
                    <Text style={[styles.toggleText, activeView === 'reflectionHistory' && { color: headerBackgroundColor }]}>
                      History
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'daily' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('daily')}
                  >
                    <Text style={[styles.toggleText, activeView === 'daily' && { color: headerBackgroundColor }]}>
                      Daily
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'weekly' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('weekly')}
                  >
                    <Text style={[styles.toggleText, activeView === 'weekly' && { color: headerBackgroundColor }]}>
                      Weekly
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, activeView === 'monthly' && styles.activeToggle]}
                    onPress={() => onViewChange && onViewChange('monthly')}
                  >
                    <Text style={[styles.toggleText, activeView === 'monthly' && { color: headerBackgroundColor }]}>
                      Monthly
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {onSortPress && (
              <TouchableOpacity style={styles.sortButton} onPress={onSortPress}>
                <Text style={styles.toggleText}>Sort</Text>
                <ArrowUpDown size={16} color="#ffffff" style={{ marginLeft: 6 }}/>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <WebNavigationMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  menuButton: {
    padding: 4,
  },
  titleSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  subtitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.9,
    display: 'none',
  },
  editButton: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: [{ translateY: -8 }],
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    color: '#ffffff',
    fontSize: 10,
    opacity: 0.8,
    marginBottom: 2,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  cycleContainer: {
    alignItems: 'flex-end',
    marginLeft: 16,
    minWidth: 60,
  },
  cycleLabel: {
    color: '#ffffff',
    fontSize: 10,
    opacity: 0.8,
    marginBottom: 2,
  },
  cycleValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cycleProgressBar: {
    width: 50,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  cycleProgressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    width: '100%',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 2,
    gap: 0,
    flex: 1,
    maxWidth: 500,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 70,
  },
  activeToggle: {
    backgroundColor: '#ffffff',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
});
