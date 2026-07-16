import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type {
  DriverRegistrationForm,
  RegistrationDocumentKey,
} from '../types/registration';

interface ReviewRow {
  label: string;
  value: string;
}

interface DocumentReviewRow {
  label: string;
  key: RegistrationDocumentKey;
}

interface RegisterReviewScreenProps {
  form: DriverRegistrationForm;
  confirmed: boolean;
  loading: boolean;
  onToggleConfirmed: () => void;
  onSubmit: () => void;
}

const DOCUMENT_ROWS: DocumentReviewRow[] = [
  { label: 'NIC Front', key: 'nicFront' },
  { label: 'NIC Back', key: 'nicBack' },
  { label: 'Driving License Front', key: 'drivingLicenseFront' },
  { label: 'Driving License Back', key: 'drivingLicenseBack' },
];

const getReviewRows = (form: DriverRegistrationForm): ReviewRow[] => [
  { label: 'Full Name', value: form.fullName },
  { label: 'NIC', value: form.nic },
  { label: 'Mobile', value: form.mobile },
  { label: 'Email', value: form.email },
  { label: 'Password', value: form.password ? 'Set' : 'Not set' },
  { label: 'Conductor Name', value: form.conductorName },
  {
    label: 'Driver NTC Registration Number',
    value: form.driverNtcRegistrationNumber,
  },
  {
    label: 'Vehicle NTC Number / Passenger Service Permit Number',
    value: form.busNtcPermitNumber,
  },
  { label: 'Driving License Number', value: form.drivingLicenseNumber },
  { label: 'Driving License Expiry', value: form.drivingLicenseExpiry },
  { label: 'Bus Route Number', value: form.busRouteNumber },
  { label: 'Vehicle Registration Number', value: form.vehicleRegistrationNumber },
  { label: 'Depot / Operator Name', value: form.depotOperator },
];

function RegisterReviewScreen({
  form,
  confirmed,
  loading,
  onToggleConfirmed,
  onSubmit,
}: RegisterReviewScreenProps) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Entered Information</Text>
      <View style={styles.card}>
        {getReviewRows(form).map(row => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value || 'Not provided'}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Document Upload Status</Text>
      <View style={styles.card}>
        {DOCUMENT_ROWS.map(row => {
          const uploaded = Boolean(form[row.key]);

          return (
            <View key={row.key} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text
                style={[
                  styles.rowValue,
                  uploaded ? styles.uploadedText : styles.notUploadedText,
                ]}
              >
                {uploaded ? 'Uploaded' : 'Not uploaded'}
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.confirmRow}
        onPress={onToggleConfirmed}
        activeOpacity={0.8}
        disabled={loading}
      >
        <View style={[styles.checkbox, confirmed && styles.checkboxActive]}>
          {confirmed ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <Text style={styles.confirmText}>
          I confirm that the information provided is correct.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!confirmed || loading) && styles.submitButtonDisabled,
        ]}
        onPress={onSubmit}
        disabled={!confirmed || loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? 'Submitting...' : 'Submit Registration'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#555',
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 3,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  uploadedText: {
    color: '#16a34a',
  },
  notUploadedText: {
    color: '#888',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0066cc',
  },
  checkMark: {
    color: '#fff',
    fontWeight: '800',
  },
  confirmText: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RegisterReviewScreen;
