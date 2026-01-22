import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SpindleGold from './SpindleGold';

export default function SpindleGoldExample() {
  const [angle, setAngle] = useState(0);
  const [snappedDirection, setSnappedDirection] = useState<number>(0);

  const directionLabels: Record<number, string> = {
    0: 'Mission (North)',
    90: 'Wellness (East)',
    180: 'Goals (South)',
    270: 'Roles (West)',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SpindleGold Component Demo</Text>

      <View style={styles.compassContainer}>
        <SpindleGold
          angle={angle}
          size={288}
          onSnapComplete={(direction) => {
            setSnappedDirection(direction);
            console.log('Snapped to:', direction, directionLabels[direction]);
          }}
        />
      </View>

      <Text style={styles.status}>
        Current Direction: {directionLabels[snappedDirection]}
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setAngle(0)}
        >
          <Text style={styles.buttonText}>Mission (0°)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setAngle(90)}
        >
          <Text style={styles.buttonText}>Wellness (90°)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setAngle(180)}
        >
          <Text style={styles.buttonText}>Goals (180°)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => setAngle(270)}
        >
          <Text style={styles.buttonText}>Roles (270°)</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.randomButton]}
        onPress={() => setAngle(Math.random() * 360)}
      >
        <Text style={styles.buttonText}>Random Angle (Auto-Snap)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
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
  status: {
    fontSize: 18,
    marginVertical: 20,
    color: '#666',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  button: {
    backgroundColor: '#C9A227',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  randomButton: {
    backgroundColor: '#333',
    marginTop: 10,
  },
});
