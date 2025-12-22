import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Info } from 'lucide-react-native';
import { HoverStatsPopup } from '@/components/common/HoverStatsPopup';
import { RoleStatistics } from '@/lib/roleStatistics';

interface Role {
  id: string;
  label: string;
  category?: string;
  image_path?: string;
  color?: string;
}

interface RoleCardProps {
  role: Role;
  statistics: RoleStatistics | null;
  onPress: (role: Role) => void;
  imageUrl?: string;
}

export function RoleCard({ role, statistics, onPress, imageUrl }: RoleCardProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [isInfoPressed, setIsInfoPressed] = useState(false);

  const handleMouseEnter = () => {
    if (Platform.OS === 'web') {
      setShowPopup(true);
    }
  };

  const handleMouseLeave = () => {
    if (Platform.OS === 'web') {
      setShowPopup(false);
    }
  };

  const handleInfoPress = () => {
    setIsInfoPressed(!isInfoPressed);
  };

  const isHoverVisible = Platform.OS === 'web' ? showPopup : isInfoPressed;

  return (
    <View
      style={styles.cardWrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress(role)}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.roleImage} />
          ) : (
            <View style={[styles.roleImagePlaceholder, { backgroundColor: role.color || '#0078d4' }]}>
              <Text style={styles.roleImagePlaceholderText}>
                {role.label.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.title}>{role.label}</Text>
          {statistics && (
            <View style={styles.statsContainer}>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{statistics.completedDeposits}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{statistics.totalScheduled}</Text>
                <Text style={styles.statLabel}>Scheduled</Text>
              </View>
            </View>
          )}
        </View>

        {Platform.OS !== 'web' && statistics && (
          <TouchableOpacity
            style={styles.infoButton}
            onPress={handleInfoPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Info size={16} color="#6b7280" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {statistics && (
        <HoverStatsPopup
          scheduledByWeek={statistics.scheduledByWeek}
          reflectionStats={statistics.reflectionStats}
          visible={isHoverVisible}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    position: 'relative',
    width: '23%',
    minWidth: 140,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 180,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  roleImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
  },
  roleImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  roleImagePlaceholderText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 20,
    width: '100%',
  },
  statBlock: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'center',
  },
  infoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
});
