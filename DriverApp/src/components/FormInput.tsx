import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  showPasswordToggle?: boolean;
}

function FormInput({
  label,
  error,
  style,
  secureTextEntry = false,
  showPasswordToggle = false,
  ...props
}: FormInputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const passwordToggleEnabled = showPasswordToggle && secureTextEntry;

  const handleTogglePassword = () => {
    setPasswordVisible(previousValue => !previousValue);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.inputContainer,
          error ? styles.inputContainerError : null,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            passwordToggleEnabled ? styles.passwordInput : null,
            style,
          ]}
          placeholderTextColor="#999"
          secureTextEntry={
            passwordToggleEnabled ? !passwordVisible : secureTextEntry
          }
          {...props}
        />

        {passwordToggleEnabled ? (
          <Pressable
            style={styles.passwordToggle}
            onPress={handleTogglePassword}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible ? 'Hide password' : 'Show password'
            }
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#475569"
            />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },

  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },

  inputContainerError: {
    borderColor: '#E74C3C',
  },

  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },

  passwordInput: {
    paddingRight: 4,
  },

  passwordToggle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  error: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: 4,
  },
});

export default FormInput;
