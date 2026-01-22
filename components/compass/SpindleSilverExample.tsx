import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import SpindleSilver from './SpindleSilver';

export default function SpindleSilverExample() {
  const [angle, setAngle] = useState(180);
  const [currentAngle, setCurrentAngle] = useState(180);
  const [animated, setAnimated] = useState(true);
  const [inputAngle, setInputAngle] = useState('180');

  const presetAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  const handleCustomAngle = () => {
    const parsed = parseInt(inputAngle, 10);
    if (!isNaN(parsed)) {
      setAngle(parsed);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SpindleSilver Component Demo</Text>
      <Text style={styles.subtitle}>Precise 360° Rotation</Text>

      <View style={styles.compassContainer}>
        <SpindleSilver
          angle={angle}
          size={288}
          animated={animated}
          onAngleChange={(newAngle) => {
            setCurrentAngle(newAngle);
            console.log('Angle changed to:', newAngle);
          }}
        />
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.status}>
          Current Angle: {Math.round(currentAngle)}°
        </Text>
        <Text style={styles.modeText}>
          Mode: {animated ? 'Animated' : 'Instant'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.toggleButton, animated && styles.toggleButtonActive]}
        onPress={() => setAnimated(!animated)}
      >
        <Text style={styles.toggleButtonText}>
          {animated ? 'Disable Animation' : 'Enable Animation'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Preset Angles</Text>
      <View style={styles.buttonGrid}>
        {presetAngles.map((presetAngle) => (
          <TouchableOpacity
            key={presetAngle}
            style={[
              styles.presetButton,
              angle === presetAngle && styles.presetButtonActive
            ]}
            onPress={() => setAngle(presetAngle)}
          >
            <Text style={styles.presetButtonText}>{presetAngle}°</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Custom Angle</Text>
      <View style={styles.customInputContainer}>
        <TextInput
          style={styles.input}
          value={inputAngle}
          onChangeText={setInputAngle}
          keyboardType="numeric"
          placeholder="Enter angle (0-359)"
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleCustomAngle}
        >
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickTestContainer}>
        <Text style={styles.sectionTitle}>Quick Tests</Text>
        <TouchableOpacity
          style={styles.testButton}
          onPress={() => {
            const angles = [0, 90, 180, 270, 0];
            let i = 0;
            const interval = setInterval(() => {
              if (i < angles.length) {
                setAngle(angles[i]);
                i++;
              } else {
                clearInterval(interval);
              }
            }, 1000);
          }}
        >
          <Text style={styles.testButtonText}>Test Cardinal Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testButton}
          onPress={() => {
            const angles = [0, 45, 90, 135, 180, 225, 270, 315, 0];
            let i = 0;
            const interval = setInterval(() => {
              if (i < angles.length) {
                setAngle(angles[i]);
                i++;
              } else {
                clearInterval(interval);
              }
            }, 800);
          }}
        >
          <Text style={styles.testButtonText}>Test 8 Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.testButton}
          onPress={() => {
            const interval = setInterval(() => {
              setAngle(Math.floor(Math.random() * 360));
            }, 1500);
            setTimeout(() => clearInterval(interval), 10000);
          }}
        >
          <Text style={styles.testButtonText}>Random (10s)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
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
    marginVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  status: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  modeText: {
    fontSize: 14,
    color: '#666',
  },
  toggleButton: {
    backgroundColor: '#666',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 15,
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
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  presetButton: {
    backgroundColor: '#A8A9AD',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 70,
  },
  presetButtonActive: {
    backgroundColor: '#666',
  },
  presetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  applyButton: {
    backgroundColor: '#A8A9AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickTestContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  testButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 5,
    minWidth: 250,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
