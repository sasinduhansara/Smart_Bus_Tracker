import { create } from 'zustand';

import type {
  DocumentFile,
  DriverRegistrationForm,
  DriverRegistrationPayload,
  DriverRegistrationTextField,
  RegistrationDocumentKey,
  UploadedDocumentRef,
} from '../types/registration';

import { normalizeMobile } from '../utils/validation';

const createInitialForm = (): DriverRegistrationForm => ({
  fullName: '',
  nic: '',
  mobile: '',
  email: '',
  password: '',
  driverNtcRegistrationNumber: '',
  drivingLicenseNumber: '',
  drivingLicenseExpiry: '',
  depotOperator: '',
  currentStep: 1,
});

const toUploadedDocumentRef = (
  file?: DocumentFile,
): UploadedDocumentRef | null => {
  if (!file?.url || !file.storagePath) {
    return null;
  }

  return {
    fileName: file.storagePath,
    url: file.url,
    mimeType: file.mimeType || file.type || 'application/octet-stream',
    originalFileName: file.fileName,
  };
};

interface DriverRegistrationStore {
  form: DriverRegistrationForm;
  updateField: (field: DriverRegistrationTextField, value: string) => void;
  setDocument: (field: RegistrationDocumentKey, file: DocumentFile) => void;
  removeDocument: (field: RegistrationDocumentKey) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetRegistration: () => void;
  getPayload: () => DriverRegistrationPayload;
}

export const useDriverRegistrationStore = create<DriverRegistrationStore>(
  (set, get) => ({
    form: createInitialForm(),

    updateField: (field, value) =>
      set(state => ({
        form: {
          ...state.form,
          [field]: value,
        },
      })),

    setDocument: (field, file) =>
      set(state => ({
        form: {
          ...state.form,
          [field]: file,
        },
      })),

    removeDocument: field =>
      set(state => ({
        form: {
          ...state.form,
          [field]: undefined,
        },
      })),

    nextStep: () =>
      set(state => ({
        form: {
          ...state.form,
          currentStep: Math.min(state.form.currentStep + 1, 4),
        },
      })),

    previousStep: () =>
      set(state => ({
        form: {
          ...state.form,
          currentStep: Math.max(state.form.currentStep - 1, 1),
        },
      })),

    resetRegistration: () => {
      set({ form: createInitialForm() });
    },

    getPayload: () => {
      const form = get().form;
      const depotOperator = form.depotOperator.trim();
      const documents = Object.fromEntries(
        (
          [
            ['nicFront', toUploadedDocumentRef(form.nicFront)],
            ['nicBack', toUploadedDocumentRef(form.nicBack)],
            [
              'drivingLicenseFront',
              toUploadedDocumentRef(form.drivingLicenseFront),
            ],
            [
              'drivingLicenseBack',
              toUploadedDocumentRef(form.drivingLicenseBack),
            ],
          ] as const
        ).filter((entry): entry is [RegistrationDocumentKey, UploadedDocumentRef] =>
          entry[1] !== null,
        ),
      );

      return {
        fullName: form.fullName.trim(),
        nic: form.nic.trim().toUpperCase(),
        mobile: normalizeMobile(form.mobile),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        driverNtcRegistrationNumber: form.driverNtcRegistrationNumber
          .trim()
          .toUpperCase(),
        drivingLicenseNumber: form.drivingLicenseNumber.trim().toUpperCase(),
        drivingLicenseExpiry: form.drivingLicenseExpiry,
        ...(depotOperator ? { depotOperator } : {}),
        documents,
        kycStatus: 'NOT_SUBMITTED',
      };
    },
  }),
);
