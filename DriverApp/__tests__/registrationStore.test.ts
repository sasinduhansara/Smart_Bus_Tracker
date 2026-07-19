import { useDriverRegistrationStore } from '../src/store/useDriverRegistrationStore';

describe('driver registration payload', () => {
  beforeEach(() => {
    useDriverRegistrationStore.getState().resetRegistration();
  });

  test('normalizes identity fields and omits operational assignments', () => {
    const store = useDriverRegistrationStore.getState();
    store.updateField('fullName', '  Test Driver  ');
    store.updateField('nic', '123456789v');
    store.updateField('mobile', '077 123 4567');
    store.updateField('email', ' Driver@Example.COM ');
    store.updateField('password', 'secure123');
    store.updateField('driverNtcRegistrationNumber', ' d-123 ');
    store.updateField('drivingLicenseNumber', ' l-123 ');
    store.updateField('drivingLicenseExpiry', '2099-01-01');

    expect(useDriverRegistrationStore.getState().getPayload()).toEqual({
      fullName: 'Test Driver',
      nic: '123456789V',
      mobile: '94771234567',
      email: 'driver@example.com',
      password: 'secure123',
      driverNtcRegistrationNumber: 'D-123',
      drivingLicenseNumber: 'L-123',
      drivingLicenseExpiry: '2099-01-01',
      documents: {},
      kycStatus: 'NOT_SUBMITTED',
    });
  });

  test('includes only completed document uploads', () => {
    useDriverRegistrationStore.getState().setDocument('nicFront', {
      uri: 'file:///nic-front.jpg',
      fileName: 'nic-front.jpg',
      storagePath: '94771234567/verified.jpg',
      url: 'https://storage.example/verified.jpg',
      mimeType: 'image/jpeg',
      uploaded: true,
    });

    expect(
      useDriverRegistrationStore.getState().getPayload().documents,
    ).toEqual({
      nicFront: {
        fileName: '94771234567/verified.jpg',
        url: 'https://storage.example/verified.jpg',
        mimeType: 'image/jpeg',
        originalFileName: 'nic-front.jpg',
      },
    });
  });
});
