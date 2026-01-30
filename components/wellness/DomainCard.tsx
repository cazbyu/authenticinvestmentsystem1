import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WellnessIcon } from '@/components/icons/WellnessIcon';

interface Domain {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface DomainCardProps {
  domain: Domain;
  onPress: (domain: Domain) => void;
  color: string;
}

export function DomainCard({ domain, onPress, color }: DomainCardProps) {
  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress(domain)}
        activeOpacity={0.7}
      >
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <WellnessIcon 
              name={domain.icon || domain.name} 
              color={color} 
              size={32} 
            />
          </View>
          <Text style={styles.title}>{domain.name}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    position: 'relative',
    width: '48%',
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
    minHeight: 140,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
});