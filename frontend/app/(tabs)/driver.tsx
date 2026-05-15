import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { sendDriverLocation, sendTripEnded, fetchActiveBuses, BusLocation } from '@/services/socket';

export default function DriverTab() {
  const [busNumber, setBusNumber] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [speed, setSpeed] = useState('');
  const [connected, setConnected] = useState(false);
  const [liveBus, setLiveBus] = useState<BusLocation | null>(null);
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    if (!busNumber.trim()) return Alert.alert('Bus Number Required', 'Enter your bus number.');
    const { connectSocket } = await import('@/services/socket');
    await fetchActiveBuses().then((map) => {
      if (map[busNumber.trim()]) setLiveBus(map[busNumber.trim()]);
    });
    setConnected(true);
  };

  const sendLocation = async () => {
    if (!busNumber.trim() || !lat.trim() || !lng.trim()) {
      return Alert.alert('Missing Data', 'Fill in bus number, latitude, and longitude.');
    }
    setLoading(true);
    try {
      const locationData: BusLocation = {
        busNumber: busNumber.trim(),
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        speed: parseFloat(speed) || 0,
        eta: 0,
        timestamp: new Date().toISOString(),
      };
      await sendDriverLocation(locationData);
      setLiveBus(locationData);
      Alert.alert('Sent', `Location for bus ${busNumber} sent.`);
    } catch {
      Alert.alert('Error', 'Could not send location. Check that socket is connected.');
    } finally {
      setLoading(false);
    }
  };

  const endTrip = async () => {
    if (!busNumber.trim()) return;
    try {
      await sendTripEnded(busNumber.trim());
      setLiveBus(null);
      Alert.alert('Trip Ended', 'Passenger notifications sent.');
      await fetchActiveBuses();
    } catch {
      Alert.alert('Error', 'Could not end trip.');
    }
  };

  const stop = () => {
    const { disconnectSocket } = require('@/services/socket');
    disconnectSocket();
    setConnected(false);
    setLiveBus(null);
  };

  if (!connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Driver App</Text>
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Bus Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. ABC-123"
            value={busNumber}
            onChangeText={setBusNumber}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={connect}
          >
            <Text style={styles.primaryBtnText}>Connect</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Driver App</Text>
        <TouchableOpacity onPress={stop}>
          <Text style={styles.disconnect}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.statusRow}>
          <View style={styles.dot} />
          <Text style={styles.statusText}>Connected to backend</Text>
        </View>

        <Text style={styles.label}>Bus Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. ABC-123"
          value={busNumber}
          onChangeText={setBusNumber}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Latitude</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 6.9271"
          keyboardType="numeric"
          value={lat}
          onChangeText={setLat}
        />

        <Text style={styles.label}>Longitude</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 79.8612"
          keyboardType="numeric"
          value={lng}
          onChangeText={setLng}
        />

        <Text style={styles.label}>Speed (m/s) — optional</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 8"
          keyboardType="numeric"
          value={speed}
          onChangeText={setSpeed}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.disabledBtn]}
          onPress={sendLocation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Send Live Location</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={endTrip}
        >
          <Text style={styles.dangerBtnText}>End Trip</Text>
        </TouchableOpacity>
      </ScrollView>

      {liveBus && (
        <View style={styles.liveCard}>
          <Text style={styles.liveLabel}>Last Sent</Text>
          <Text style={styles.liveBus}>{liveBus.busNumber}</Text>
          <View style={styles.liveRow}>
            <Text style={styles.liveDetail}>{liveBus.latitude.toFixed(4)}, {liveBus.longitude.toFixed(4)}</Text>
            <Text style={styles.liveETA}>ETA: {liveBus.eta} min</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  disconnect: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  liveCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  liveLabel: {
    color: '#94A3B8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveBus: {
    color: '#60A5FA',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  liveDetail: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  liveETA: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
  },
});
