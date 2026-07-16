import React from 'react';
import {View, Text, TextInput, TextInputProps, StyleSheet} from 'react-native';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
}

function FormInput({label, error, style, ...props}: FormInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor="#999"
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {marginBottom: 16},
  label: {fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6},
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {borderColor: '#e74c3c'},
  error: {color: '#e74c3c', fontSize: 12, marginTop: 4},
});

export default FormInput;
