import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import FormInput from '../components/FormInput';

import type {
  DriverRegistrationForm,
  DriverRegistrationTextField,
  RegistrationAvailabilityState,
  RegistrationAvailabilityStates,
  RegistrationErrors,
} from '../types/registration';

interface RegisterPersonalScreenProps {
  form: DriverRegistrationForm;
  errors: RegistrationErrors;
  availability: RegistrationAvailabilityStates;
  onChangeText: (field: DriverRegistrationTextField) => (value: string) => void;
}

interface AvailabilityMessageProps {
  state: RegistrationAvailabilityState;
  availableMessage: string;
  retryMessage: string;
}

function AvailabilityMessage({
  state,
  availableMessage,
  retryMessage,
}: AvailabilityMessageProps) {
  return (
    <View style={styles.availabilityContainer} accessibilityLiveRegion="polite">
      {state === 'checking' ? (
        <Text style={styles.checkingText}>Checking availability...</Text>
      ) : null}

      {state === 'available' ? (
        <Text style={styles.availableText}>{availableMessage}</Text>
      ) : null}

      {state === 'error' ? (
        <Text style={styles.warningText}>{retryMessage}</Text>
      ) : null}
    </View>
  );
}

function RegisterPersonalScreen({
  form,
  errors,
  availability,
  onChangeText,
}: RegisterPersonalScreenProps) {
  return (
    <>
      <FormInput
        label="Full Name"
        placeholder="Enter full name"
        value={form.fullName}
        onChangeText={onChangeText('fullName')}
        error={errors.fullName}
      />

      <View>
        <FormInput
          label="NIC / Government ID"
          placeholder="e.g. 123456789V"
          value={form.nic}
          onChangeText={onChangeText('nic')}
          error={errors.nic}
          autoCapitalize="characters"
        />

        <AvailabilityMessage
          state={availability.nic}
          availableMessage="NIC is available"
          retryMessage="NIC availability could not be checked. It will be checked again when you continue."
        />
      </View>

      <View>
        <FormInput
          label="Mobile Number"
          placeholder="e.g. 0771234567"
          keyboardType="phone-pad"
          value={form.mobile}
          onChangeText={onChangeText('mobile')}
          error={errors.mobile}
          maxLength={10}
        />

        <AvailabilityMessage
          state={availability.mobile}
          availableMessage="Mobile number is available"
          retryMessage="Mobile availability could not be checked. It will be checked again when you continue."
        />
      </View>

      <View>
        <FormInput
          label="Email"
          placeholder="e.g. driver@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={form.email}
          onChangeText={onChangeText('email')}
          error={errors.email}
        />

        <AvailabilityMessage
          state={availability.email}
          availableMessage="Email address is available"
          retryMessage="Email availability could not be checked. It will be checked again when you continue."
        />
      </View>

      <FormInput
        label="Password"
        placeholder="At least 8 characters with a letter and number"
        secureTextEntry
        showPasswordToggle
        autoCapitalize="none"
        autoCorrect={false}
        value={form.password}
        onChangeText={onChangeText('password')}
        error={errors.password}
      />
    </>
  );
}

const styles = StyleSheet.create({
  availabilityContainer: {
    minHeight: 20,
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  checkingText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  availableText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  warningText: {
    color: '#B45309',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});

export default RegisterPersonalScreen;
