import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import { uploadDriverDocument } from '../services/api';
import type {
  DocumentFile,
  RegistrationDocumentKey,
} from '../types/registration';

export interface DocumentInfo {
  docType: RegistrationDocumentKey;
  label: string;
  uri?: string;
  fileName?: string;
  uploadedUrl?: string;
}

interface DocumentUploaderProps {
  driverId: string;
  documents: DocumentInfo[];

  onDocumentUploaded: (docType: RegistrationDocumentKey, url: string) => void;
}

interface DocumentTypeOption {
  docType: RegistrationDocumentKey;
  label: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const DOCUMENT_TYPES: readonly DocumentTypeOption[] = [
  {
    docType: 'nicFront',
    label: 'NIC — Front',
  },
  {
    docType: 'nicBack',
    label: 'NIC — Back',
  },
  {
    docType: 'drivingLicenseFront',
    label: 'Driving Licence — Front',
  },
  {
    docType: 'drivingLicenseBack',
    label: 'Driving Licence — Back',
  },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not upload the document.';
}

function createDocumentFile(
  asset: Asset,
  docType: RegistrationDocumentKey,
): DocumentFile {
  if (!asset.uri) {
    throw new Error('The selected image does not contain a valid file path.');
  }

  return {
    uri: asset.uri,
    type: asset.type || 'image/jpeg',
    fileName: asset.fileName || `${docType}-${Date.now()}.jpg`,
  };
}

function DocumentUploader({
  driverId,
  documents,
  onDocumentUploaded,
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState<RegistrationDocumentKey | null>(
    null,
  );

  const selectAndUpload = async (docType: RegistrationDocumentKey) => {
    if (uploading) {
      return;
    }

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 2048,
        maxHeight: 2048,
        selectionLimit: 1,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Image selection failed.');
      }

      const asset = result.assets?.[0];

      if (!asset) {
        throw new Error('No image was selected.');
      }

      if (
        typeof asset.fileSize === 'number' &&
        asset.fileSize > MAX_FILE_SIZE
      ) {
        throw new Error('The selected image exceeds the 5 MB limit.');
      }

      const file = createDocumentFile(asset, docType);

      setUploading(docType);

      const response = await uploadDriverDocument({
        driverId,
        docType,
        file,
      });

      onDocumentUploaded(docType, response.url);

      const selectedDocument = DOCUMENT_TYPES.find(
        document => document.docType === docType,
      );

      Alert.alert(
        'Upload Successful',
        `${selectedDocument?.label || 'Document'} uploaded successfully.`,
      );
    } catch (error) {
      Alert.alert('Upload Failed', getErrorMessage(error));
    } finally {
      setUploading(null);
    }
  };

  const startDocumentUpload = (docType: RegistrationDocumentKey) => {
    selectAndUpload(docType).catch(error => {
      Alert.alert('Upload Failed', getErrorMessage(error));
    });
  };

  const handleDocumentPress = (docType: RegistrationDocumentKey) => {
    const existingDocument = documents.find(
      document => document.docType === docType,
    );

    if (!existingDocument?.uploadedUrl) {
      startDocumentUpload(docType);
      return;
    }

    Alert.alert(
      'Replace Document',
      'This document has already been uploaded. Do you want to replace it?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Replace',
          onPress: () => {
            startDocumentUpload(docType);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Identity Documents</Text>

      <Text style={styles.sectionHint}>
        Upload clear photos of the NIC and driving licence. All four corners
        should be visible.
      </Text>

      {DOCUMENT_TYPES.map(documentType => {
        const uploadedDocument = documents.find(
          document => document.docType === documentType.docType,
        );

        const isUploading = uploading === documentType.docType;

        const isAnotherUploadRunning = uploading !== null && !isUploading;

        return (
          <TouchableOpacity
            key={documentType.docType}
            style={[
              styles.documentRow,
              uploadedDocument?.uploadedUrl && styles.documentRowUploaded,
              isAnotherUploadRunning && styles.documentRowDisabled,
            ]}
            onPress={() => handleDocumentPress(documentType.docType)}
            disabled={isUploading || isAnotherUploadRunning}
            activeOpacity={0.8}
          >
            <View style={styles.documentInfo}>
              <Text style={styles.documentLabel}>{documentType.label}</Text>

              {uploadedDocument?.uploadedUrl ? (
                <Text style={styles.uploadedText}>Uploaded successfully</Text>
              ) : (
                <Text style={styles.notUploadedText}>Not uploaded</Text>
              )}
            </View>

            {isUploading ? (
              <ActivityIndicator size="small" color="#0066cc" />
            ) : (
              <Text style={styles.actionText}>
                {uploadedDocument?.uploadedUrl ? 'Replace' : 'Select'}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: '#777',
    marginBottom: 16,
    lineHeight: 19,
  },
  documentRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  documentRowUploaded: {
    backgroundColor: '#f0faf0',
    borderColor: '#4caf50',
  },
  documentRowDisabled: {
    opacity: 0.55,
  },
  documentInfo: {
    flex: 1,
    paddingRight: 12,
  },
  documentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  uploadedText: {
    fontSize: 12,
    color: '#2e7d32',
    marginTop: 4,
  },
  notUploadedText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  actionText: {
    color: '#0066cc',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default DocumentUploader;
