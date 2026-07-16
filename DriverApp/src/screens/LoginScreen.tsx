import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AuthScreenShell from '../components/AuthScreenShell';
import { requestLoginOTP } from '../services/api';

function LoginScreen({ navigation }: any) {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    if (mobile.length < 9) {
      Alert.alert('Invalid number', 'Please enter a valid mobile number');
      return;
    }
    setLoading(true);
    try {
      await requestLoginOTP(mobile);
      navigation.navigate('OtpVerify', { mobile, purpose: 'login' });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell centered>
      <View style={styles.card}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>G</Text>
        </View>

        <Text style={styles.kicker}>Driver Portal</Text>
        <Text style={styles.title}>Gamana.lk</Text>
        <Text style={styles.subtitle}>Sign in securely with your mobile OTP</Text>

        <TextInput
          style={styles.input}
          placeholder="Mobile Number (e.g. 0771234567)"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
          value={mobile}
          onChangeText={setMobile}
          maxLength={10}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={requestOtp}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Login OTP</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>Create a new driver account</Text>
        </TouchableOpacity>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 30,
    padding: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 12,
  },
  logoBadge: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    color: '#F59E0B',
    fontSize: 30,
    fontWeight: '900',
  },
  kicker: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#64748B',
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D7DEE8',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    marginBottom: 18,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  button: {
    minHeight: 56,
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkText: {
    color: '#0369A1',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LoginScreen;
