import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import type {
  DocumentFile,
  DriverRegistrationForm,
  RegistrationDocumentKey,
} from '../types/registration';
import { uploadRegistrationDocument } from '../services/api';

interface DocumentOption {
  key: RegistrationDocumentKey;
  label: string;
}

interface RegisterDocumentsScreenProps {
  form: DriverRegistrationForm;
  loading: boolean;
  onSetDocument: (field: RegistrationDocumentKey, file: DocumentFile) => void;
  onRemoveDocument: (field: RegistrationDocumentKey) => void;
  onSkip: () => void;
  onContinue: () => void;
}

const DOCUMENT_OPTIONS: DocumentOption[] = [
  { key: 'nicFront', label: 'NIC Front' },
  { key: 'nicBack', label: 'NIC Back' },
  { key: 'drivingLicenseFront', label: 'Driving License Front' },
  { key: 'drivingLicenseBack', label: 'Driving License Back' },
];

const toDocumentFile = (asset: Asset): DocumentFile | null => {
  if (!asset.uri) return null;

  return {
    uri: asset.uri,
    fileName: asset.fileName || asset.uri.split('/').pop() || 'Selected file',
    type: asset.type,
  };
};

function RegisterDocumentsScreen({
  form,
  loading,
  onSetDocument,
  onRemoveDocument,
  onSkip,
  onContinue,
}: RegisterDocumentsScreenProps) {
  const [uploadingDocument, setUploadingDocument] =
    useState<RegistrationDocumentKey | null>(null);

  const uploadSelectedDocument = async (
    field: RegistrationDocumentKey,
    file: DocumentFile,
  ) => {
    if (!form.mobile.trim()) {
      Alert.alert(
        'Mobile Required',
        'Please complete the personal information step before uploading documents.',
      );
      return;
    }

    setUploadingDocument(field);
    try {
      const result = await uploadRegistrationDocument({
        mobile: form.mobile,
        docType: field,
        file,
      });

      onSetDocument(field, {
        ...file,
        url: result.document.url,
        storagePath: result.document.fileName,
        mimeType: result.document.mimeType,
        uploaded: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not upload document';
      Alert.alert('Upload Failed', message);
    } finally {
      setUploadingDocument(null);
    }
  };

  const pickFromCamera = async (field: RegistrationDocumentKey) => {
    const response = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Document Error', response.errorMessage || 'Could not open camera');
      return;
    }

    const file = response.assets?.[0] ? toDocumentFile(response.assets[0]) : null;
    if (file) await uploadSelectedDocument(field, file);
  };

  const pickFromGallery = async (field: RegistrationDocumentKey) => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });

    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert(
        'Document Error',
        response.errorMessage || 'Could not open gallery',
      );
      return;
    }

    const file = response.assets?.[0] ? toDocumentFile(response.assets[0]) : null;
    if (file) await uploadSelectedDocument(field, file);
  };

  const showPicker = (field: RegistrationDocumentKey) => {
    Alert.alert('Select Document', 'Choose how you want to add this document.', [
      { text: 'Camera', onPress: () => void pickFromCamera(field) },
      { text: 'Gallery', onPress: () => void pickFromGallery(field) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View>
      <Text style={styles.hint}>
        Upload documents to Supabase now, or skip and add them later from KYC
        Verification.
      </Text>

      {DOCUMENT_OPTIONS.map(option => {
        const selectedDocument = form[option.key];
        const isUploading = uploadingDocument === option.key;

        return (
          <View key={option.key} style={styles.card}>
            <View style={styles.documentInfo}>
              <Text style={styles.documentLabel}>{option.label}</Text>
              <Text style={styles.documentStatus}>
                {isUploading
                  ? 'Uploading...'
                  : selectedDocument?.uploaded
                    ? 'Uploaded to Supabase'
                    : 'Not uploaded'}
              </Text>
            </View>

            {selectedDocument?.uri ? (
              <Image source={{ uri: selectedDocument.uri }} style={styles.preview} />
            ) : null}

            <View style={styles.documentActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => showPicker(option.key)}
                disabled={loading || Boolean(uploadingDocument)}
              >
                {isUploading ? (
                  <ActivityIndicator color="#0066cc" />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    {selectedDocument ? 'Replace' : 'Select'}
                  </Text>
                )}
              </TouchableOpacity>

              {selectedDocument ? (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => onRemoveDocument(option.key)}
                  disabled={loading || Boolean(uploadingDocument)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}

      <View style={styles.footerActions}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onSkip}
          disabled={loading || Boolean(uploadingDocument)}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            Boolean(uploadingDocument) && styles.continueButtonDisabled,
          ]}
          onPress={onContinue}
          disabled={loading || Boolean(uploadingDocument)}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 19,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  documentInfo: {
    marginBottom: 10,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  documentStatus: {
    fontSize: 12,
    color: '#777',
    marginTop: 3,
  },
  preview: {
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f2f2f2',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0066cc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0066cc',
    fontWeight: '700',
  },
  removeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e74c3c',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#e74c3c',
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  skipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#555',
    fontWeight: '700',
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default RegisterDocumentsScreen;
