import React from 'react';
import FormInput from '../components/FormInput';
import type {
  DriverRegistrationForm,
  DriverRegistrationTextField,
  RegistrationErrors,
} from '../types/registration';

interface RegisterPersonalScreenProps {
  form: DriverRegistrationForm;
  errors: RegistrationErrors;
  onChangeText: (field: DriverRegistrationTextField) => (value: string) => void;
}

function RegisterPersonalScreen({
  form,
  errors,
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

      <FormInput
        label="NIC / Government ID"
        placeholder="e.g. 123456789V"
        value={form.nic}
        onChangeText={onChangeText('nic')}
        error={errors.nic}
        autoCapitalize="characters"
      />

      <FormInput
        label="Mobile Number"
        placeholder="e.g. 0771234567"
        keyboardType="phone-pad"
        value={form.mobile}
        onChangeText={onChangeText('mobile')}
        error={errors.mobile}
        maxLength={10}
      />

      <FormInput
        label="Email"
        placeholder="e.g. driver@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={form.email}
        onChangeText={onChangeText('email')}
        error={errors.email}
      />

      <FormInput
        label="Password"
        placeholder="At least 6 characters"
        secureTextEntry
        value={form.password}
        onChangeText={onChangeText('password')}
        error={errors.password}
      />

      <FormInput
        label="Conductor Name"
        placeholder="Enter conductor's full name"
        value={form.conductorName}
        onChangeText={onChangeText('conductorName')}
        error={errors.conductorName}
      />
    </>
  );
}

export default RegisterPersonalScreen;
