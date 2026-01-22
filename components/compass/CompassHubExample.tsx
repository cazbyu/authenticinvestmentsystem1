import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import CompassHub from './CompassHub';

type Zone = 'mission' | 'wellness' | 'goals' | 'roles' | null;

export default function CompassHubExample() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeZone, setActiveZone] = useState<Zone>(null);
  const [tapCount, setTapCount] = useState(0);

  const handleTap = () => {
    setTapCount(prev => prev + 1);
    console.log('Hub tapped!');
  };

  const startSpinSequence = () => {
    setIsSpinning(true);
    const zones: Zone[] = ['mission', 'wellness', 'goals', 'roles'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < zones.length) {
        setActiveZone(zones[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsSpinning(false);
        setActiveZone(null);
      }
    }, 1000);
  };

  const zones: Array<{ name: string; value: Zone; color: string }> = [
    { name: 'Mission', value: 'mission', color: '#ed1c24' },
    { name: 'Wellness', value: 'wellness', color: '#39b54a' },
    { name: 'Goals', value: 'goals', color: '#00abc5' },
    { name: 'Roles', value: 'roles', color: '#ffd400' },
  ];

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>CompassHub Component</Text>
      <Text style={styles.subtitle}>Interactive Center Control</Text>

      <View style={styles.hubContainer}>
        <CompassHub
          size={288}
          isSpinning={isSpinning}
          onTap={handleTap}
          activeZone={activeZone}
        />
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>State:</Text>
        <Text style={styles.statusValue}>
          {isSpinning ? 'Spinning' : 'Ready'}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Active Zone:</Text>
        <Text style={[styles.statusValue, activeZone && { color: zones.find(z => z.value === activeZone)?.color }]}>
          {activeZone ? activeZone.charAt(0).toUpperCase() + activeZone.slice(1) : 'None'}
        </Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Tap Count:</Text>
        <Text style={styles.statusValue}>{tapCount}</Text>
      </View>

      <Text style={styles.sectionTitle}>Controls</Text>

      <TouchableOpacity
        style={[styles.button, styles.spinButton]}
        onPress={startSpinSequence}
        disabled={isSpinning}
      >
        <Text style={styles.buttonText}>
          {isSpinning ? 'Spinning...' : 'Start Spin Sequence'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.toggleButton]}
        onPress={() => setIsSpinning(!isSpinning)}
      >
        <Text style={styles.buttonText}>
          Toggle Spinning State
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Set Active Zone</Text>
      <View style={styles.zoneGrid}>
        {zones.map((zone) => (
          <TouchableOpacity
            key={zone.value}
            style={[
              styles.zoneButton,
              { backgroundColor: zone.color },
              activeZone === zone.value && styles.zoneButtonActive,
            ]}
            onPress={() => setActiveZone(activeZone === zone.value ? null : zone.value)}
          >
            <Text style={styles.zoneButtonText}>{zone.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, styles.clearButton]}
        onPress={() => {
          setActiveZone(null);
          setIsSpinning(false);
          setTapCount(0);
        }}
      >
        <Text style={styles.buttonText}>Reset All</Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Features</Text>
        <Text style={styles.infoText}>
          • Tap the hub to trigger actions
        </Text>
        <Text style={styles.infoText}>
          • Pulse animation when ready (isSpinning=false)
        </Text>
        <Text style={styles.infoText}>
          • Rotating indicator when spinning (isSpinning=true)
        </Text>
        <Text style={styles.infoText}>
          • Center color changes based on active zone
        </Text>
        <Text style={styles.infoText}>
          • 44px minimum touch target for accessibility
        </Text>
        <Text style={styles.infoText}>
          • Press feedback shows visual response
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>States Demonstrated</Text>
        <View style={styles.stateRow}>
          <View style={[styles.stateIndicator, { backgroundColor: '#808285' }]} />
          <Text style={styles.stateText}>Ready (pulsing)</Text>
        </View>
        <View style={styles.stateRow}>
          <View style={[styles.stateIndicator, styles.stateIndicatorSpinning]} />
          <Text style={styles.stateText}>Spinning (rotating ring)</Text>
        </View>
        <View style={styles.stateRow}>
          <View style={[styles.stateIndicator, { backgroundColor: '#ed1c24' }]} />
          <Text style={styles.stateText}>Mission zone active</Text>
        </View>
        <View style={styles.stateRow}>
          <View style={[styles.stateIndicator, { backgroundColor: '#39b54a' }]} />
          <Text style={styles.stateText}>Wellness zone active</Text>
        </View>
        <View style={styles.stateRow}>
          <View style={[styles.stateIndicator, { backgroundColor: '#00abc5' }]} />
          <Text style={styles.stateText}>Goals zone active</Text>
        </View>
        <View style={styles.stateRow}>
          <View style={[styles.stateIndicator, { backgroundColor: '#ffd400' }]} />
          <Text style={styles.stateText}>Roles zone active</Text>
        </View>
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
  hubContainer: {
    marginVertical: 30,
    backgroundColor: '#fff',
    borderRadius: 150,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    gap: 10,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 30,
    marginBottom: 15,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 5,
    minWidth: 250,
  },
  spinButton: {
    backgroundColor: '#4a90e2',
  },
  toggleButton: {
    backgroundColor: '#808285',
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  zoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  zoneButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  zoneButtonActive: {
    borderWidth: 3,
    borderColor: '#333',
  },
  zoneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    padding: 16,
    borderRadius: 8,
    marginTop: 30,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginVertical: 3,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 10,
  },
  stateIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  stateIndicatorSpinning: {
    backgroundColor: '#808285',
    borderWidth: 2,
    borderColor: '#333',
  },
  stateText: {
    fontSize: 14,
    color: '#555',
  },
});
