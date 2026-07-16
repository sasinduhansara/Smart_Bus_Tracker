import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const Colors = {
  primary: '#0B4C8C',
  primaryLight: '#E6F0FA',
  background: '#F4F7FC',
  surface: '#FFFFFF',
  textPrimary: '#1A2B3C',
  textSecondary: '#5E6F7D',
  textMuted: '#8E9EAB',
  border: '#E4E9F0',
};

const ProfileScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.container}>
        <Icon name="person-circle-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Your profile details will appear here</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ProfileScreen;
