import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { connectSocket, disconnectSocket, fetchActiveBuses, BusLocation } from '@/services/socket';

export default function LiveMapTab() {
  const [busList, setBusList] = useState<BusLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchActiveBuses()
      .then((map) => {
        if (cancelled) return;
        setBusList(Object.values(map).sort((a, b) => a.busNumber.localeCompare(b.busNumber)));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    const handleUpdate = (bus: BusLocation) => {
      setBusList((prev) => {
        const idx = prev.findIndex((b) => b.busNumber === bus.busNumber);
        const next = [...prev];
        if (idx >= 0) {
          next[idx] = bus;
        } else {
          next.push(bus);
        }
        return next.sort((a, b) => a.busNumber.localeCompare(b.busNumber));
      });
    };

    connectSocket(handleUpdate);

    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.status}>Loading buses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Bus Map</Text>
      <Text style={styles.count}>{busList.length} bus{busList.length !== 1 ? 'es' : ''} active</Text>

      <FlatList
        data={busList}
        keyExtractor={(item) => item.busNumber}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.busNumber}>{item.busNumber}</Text>
            <Text style={styles.detail}>Lat: {item.latitude.toFixed(5)}</Text>
            <Text style={styles.detail}>Lng: {item.longitude.toFixed(5)}</Text>
            <Text style={styles.detail}>Speed: {item.speed ?? 0} m/s</Text>
            <Text style={[styles.detail, styles.eta]}>
              ETA: {item.eta} min
            </Text>
            <Text style={styles.time}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No buses are currently active.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  count: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  status: {
    marginTop: 8,
    color: '#64748B',
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  busNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 6,
  },
  detail: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 2,
  },
  eta: {
    fontWeight: '600',
    color: '#10B981',
  },
  time: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
    color: '#94A3B8',
  },
});
