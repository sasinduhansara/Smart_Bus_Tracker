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

const INITIAL_FORM: DriverRegistrationForm = {
  fullName: '',
  nic: '',
  mobile: '',
  email: '',
  password: '',
  conductorName: '',
  driverNtcRegistrationNumber: '',
  busNtcPermitNumber: '',
  drivingLicenseNumber: '',
  drivingLicenseExpiry: '',
  busRouteNumber: '',
  vehicleRegistrationNumber: '',
  depotOperator: '',
  currentStep: 1,
};

const toUploadedDocumentRef = (
  file?: DocumentFile,
): UploadedDocumentRef | null => {
  if (!file?.url || !file.storagePath) return null;

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
    form: INITIAL_FORM,
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
    resetRegistration: () => set({ form: INITIAL_FORM }),
    getPayload: () => {
      const form = get().form;

      return {
        fullName: form.fullName.trim(),
        nic: form.nic.trim().toUpperCase(),
        mobile: normalizeMobile(form.mobile),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        conductorName: form.conductorName.trim(),
        driverNtcRegistrationNumber: form.driverNtcRegistrationNumber.trim(),
        busNtcPermitNumber: form.busNtcPermitNumber.trim(),
        drivingLicenseNumber: form.drivingLicenseNumber.trim(),
        drivingLicenseExpiry: form.drivingLicenseExpiry,
        busRouteNumber: form.busRouteNumber.trim(),
        vehicleRegistrationNumber: form.vehicleRegistrationNumber
          .trim()
          .toUpperCase(),
        depotOperator: form.depotOperator.trim(),
        documents: {
          nicFront: toUploadedDocumentRef(form.nicFront),
          nicBack: toUploadedDocumentRef(form.nicBack),
          drivingLicenseFront: toUploadedDocumentRef(form.drivingLicenseFront),
          drivingLicenseBack: toUploadedDocumentRef(form.drivingLicenseBack),
        },
        kycStatus: 'NOT_SUBMITTED',
      };
    },
  }),
);
