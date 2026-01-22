import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import SpindleGold from './SpindleGold';
import SpindleSilver from './SpindleSilver';

export default function SpindleComparison() {
  const [goldAngle, setGoldAngle] = useState(0);
  const [silverAngle, setSilverAngle] = useState(180);
  const [goldDirection, setGoldDirection] = useState<number>(0);
  const [currentSilverAngle, setCurrentSilverAngle] = useState(180);
  const [animated, setAnimated] = useState(true);

  const domains = [
    { name: 'Mission', angle: 0, color: '#ed1c24' },
    { name: 'Wellness', angle: 90, color: '#39b54a' },
    { name: 'Goals', angle: 180, color: '#00abc5' },
    { name: 'Roles', angle: 270, color: '#ffd400' },
  ];

  const wellnessSlots = [
    { name: 'Mental', angle: 45 },
    { name: 'Physical', angle: 90 },
    { name: 'Spiritual', angle: 135 },
    { name: 'Relational', angle: 180 },
  ];

  const directionLabels: Record<number, string> = {
    0: 'Mission',
    90: 'Wellness',
    180: 'Goals',
    270: 'Roles',
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Dual Spindle System</Text>
      <Text style={styles.subtitle}>Gold (Domain) + Silver (Item)</Text>

      <View style={styles.compassContainer}>
        <View style={styles.spindleLayer}>
          <SpindleGold
            angle={goldAngle}
            size={288}
            onSnapComplete={(direction) => {
              setGoldDirection(direction);
              console.log('Gold snapped to:', directionLabels[direction]);
            }}
          />
        </View>

        <View style={[styles.spindleLayer, StyleSheet.absoluteFill]}>
          <SpindleSilver
            angle={silverAngle}
            size={288}
            animated={animated}
            onAngleChange={(angle) => {
              setCurrentSilverAngle(angle);
              console.log('Silver at:', angle);
            }}
          />
        </View>

        <View style={styles.centerLabel}>
          <Text style={styles.centerLabelText}>
            {directionLabels[goldDirection]}
          </Text>
          <Text style={styles.centerAngleText}>
            {Math.round(currentSilverAngle)}°
          </Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, { backgroundColor: '#C9A227' }]} />
          <Text style={styles.statusLabel}>
            Gold: {directionLabels[goldDirection]} ({goldDirection}°)
          </Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, { backgroundColor: '#A8A9AD' }]} />
          <Text style={styles.statusLabel}>
            Silver: {Math.round(currentSilverAngle)}°
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.toggleButton, animated && styles.toggleButtonActive]}
        onPress={() => setAnimated(!animated)}
      >
        <Text style={styles.toggleButtonText}>
          Silver Animation: {animated ? 'ON' : 'OFF'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Select Domain (Gold Spindle)</Text>
      <View style={styles.buttonGrid}>
        {domains.map((domain) => (
          <TouchableOpacity
            key={domain.name}
            style={[
              styles.domainButton,
              { backgroundColor: domain.color },
              goldDirection === domain.angle && styles.domainButtonActive
            ]}
            onPress={() => setGoldAngle(domain.angle)}
          >
            <Text style={styles.domainButtonText}>{domain.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>
        Select Item (Silver Spindle)
      </Text>
      <Text style={styles.helperText}>
        Example: Wellness zones
      </Text>
      <View style={styles.buttonGrid}>
        {wellnessSlots.map((slot) => (
          <TouchableOpacity
            key={slot.name}
            style={[
              styles.slotButton,
              Math.abs(currentSilverAngle - slot.angle) < 5 && styles.slotButtonActive
            ]}
            onPress={() => setSilverAngle(slot.angle)}
          >
            <Text style={styles.slotButtonText}>
              {slot.name}
            </Text>
            <Text style={styles.slotAngleText}>
              {slot.angle}°
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Demonstration Scenarios</Text>

      <TouchableOpacity
        style={styles.demoButton}
        onPress={() => {
          setGoldAngle(270);
          setTimeout(() => setSilverAngle(315), 400);
        }}
      >
        <Text style={styles.demoButtonText}>
          1. Select Roles Domain → Father Role
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.demoButton}
        onPress={() => {
          setGoldAngle(90);
          setTimeout(() => setSilverAngle(90), 400);
        }}
      >
        <Text style={styles.demoButtonText}>
          2. Select Wellness Domain → Physical
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.demoButton}
        onPress={() => {
          setGoldAngle(180);
          setTimeout(() => setSilverAngle(225), 400);
        }}
      >
        <Text style={styles.demoButtonText}>
          3. Select Goals Domain → Goal Slot 6
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.demoButton, styles.demoButtonSpecial]}
        onPress={() => {
          const sequence = [
            { gold: 0, silver: 0 },
            { gold: 90, silver: 45 },
            { gold: 180, silver: 180 },
            { gold: 270, silver: 315 },
            { gold: 0, silver: 0 },
          ];

          sequence.forEach((step, index) => {
            setTimeout(() => {
              setGoldAngle(step.gold);
              setTimeout(() => setSilverAngle(step.silver), 350);
            }, index * 1500);
          });
        }}
      >
        <Text style={styles.demoButtonText}>
          Tour All Domains (7.5s)
        </Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How It Works</Text>
        <Text style={styles.infoText}>
          • Gold Spindle snaps to 4 cardinal directions (domains)
        </Text>
        <Text style={styles.infoText}>
          • Silver Spindle points to any angle (specific items)
        </Text>
        <Text style={styles.infoText}>
          • Both rotate around the same center point
        </Text>
        <Text style={styles.infoText}>
          • Silver renders above Gold for visibility
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  compassContainer: {
    width: 288,
    height: 288,
    marginVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  spindleLayer: {
    width: 288,
    height: 288,
  },
  centerLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -30 }],
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  centerLabelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  centerAngleText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusContainer: {
    marginVertical: 15,
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  toggleButton: {
    backgroundColor: '#666',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 10,
  },
  toggleButtonActive: {
    backgroundColor: '#A8A9AD',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  domainButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  domainButtonActive: {
    borderWidth: 3,
    borderColor: '#333',
  },
  domainButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  slotButton: {
    backgroundColor: '#A8A9AD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  slotButtonActive: {
    backgroundColor: '#666',
    borderWidth: 2,
    borderColor: '#333',
  },
  slotButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  slotAngleText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
  },
  demoButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 5,
    minWidth: 300,
  },
  demoButtonSpecial: {
    backgroundColor: '#333',
    marginTop: 10,
  },
  demoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginVertical: 3,
  },
});
