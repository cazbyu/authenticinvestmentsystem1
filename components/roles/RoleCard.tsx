import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

interface Role {
  id: string;
  label: string;
  category?: string;
  image_path?: string;
  color?: string;
}

interface RoleCardProps {
  role: Role;
  onPress: (role: Role) => void;
  imageUrl?: string;
}

export function RoleCard({ role, onPress, imageUrl }: RoleCardProps) {
  return (
    <View style={styles.cardWrapper}>
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
        </View>
      </TouchableOpacity>
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
    minHeight: 140,
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
    textAlign: 'center',
  },
});
