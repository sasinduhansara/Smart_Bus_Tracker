import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import FormInput from '../components/FormInput';

import type {
  DriverRegistrationForm,
  DriverRegistrationTextField,
  RegistrationErrors,
} from '../types/registration';

interface RegisterDriverDetailsScreenProps {
  form: DriverRegistrationForm;
  errors: RegistrationErrors;
  onChangeText: (field: DriverRegistrationTextField) => (value: string) => void;
}

function RegisterDriverDetailsScreen({
  form,
  errors,
  onChangeText,
}: RegisterDriverDetailsScreenProps) {
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const selectedExpiryDate = parseDateValue(form.drivingLicenseExpiry);
  const minimumExpiryDate = getTodayDate();
  const [visibleMonth, setVisibleMonth] = useState(
    getMonthStart(selectedExpiryDate),
  );

  const openExpiryPicker = () => {
    setVisibleMonth(getMonthStart(selectedExpiryDate));
    setShowExpiryPicker(true);
  };

  const selectExpiryDate = (date: Date) => {
    onChangeText('drivingLicenseExpiry')(formatDateValue(date));
    setShowExpiryPicker(false);
  };

  return (
    <>
      <FormInput
        label="Driver NTC Registration Number"
        placeholder="Enter driver NTC registration number"
        value={form.driverNtcRegistrationNumber}
        onChangeText={onChangeText('driverNtcRegistrationNumber')}
        error={errors.driverNtcRegistrationNumber}
        autoCapitalize="characters"
      />

      <FormInput
        label="Driving License Number"
        placeholder="Enter driving license number"
        value={form.drivingLicenseNumber}
        onChangeText={onChangeText('drivingLicenseNumber')}
        error={errors.drivingLicenseNumber}
        autoCapitalize="characters"
      />

      <View style={styles.wrapper}>
        <Text style={styles.label}>Driving License Expiry</Text>

        <TouchableOpacity
          style={[
            styles.dateField,
            errors.drivingLicenseExpiry ? styles.dateFieldError : null,
          ]}
          onPress={openExpiryPicker}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.dateText,
              !form.drivingLicenseExpiry ? styles.placeholderText : null,
            ]}
          >
            {form.drivingLicenseExpiry || 'Select license expiry date'}
          </Text>
        </TouchableOpacity>

        {errors.drivingLicenseExpiry ? (
          <Text style={styles.error}>{errors.drivingLicenseExpiry}</Text>
        ) : null}
      </View>

      <DatePickerModal
        visible={showExpiryPicker}
        visibleMonth={visibleMonth}
        selectedDate={selectedExpiryDate}
        minimumDate={minimumExpiryDate}
        onClose={() => setShowExpiryPicker(false)}
        onPreviousMonth={() => setVisibleMonth(addMonths(visibleMonth, -1))}
        onNextMonth={() => setVisibleMonth(addMonths(visibleMonth, 1))}
        onSelectDate={selectExpiryDate}
      />

      <FormInput
        label="Operator / Depot (Optional)"
        placeholder="Enter affiliated operator or depot"
        value={form.depotOperator}
        onChangeText={onChangeText('depotOperator')}
        error={errors.depotOperator}
      />
    </>
  );
}

interface DatePickerModalProps {
  visible: boolean;
  visibleMonth: Date;
  selectedDate: Date;
  minimumDate: Date;
  onClose: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: Date) => void;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DatePickerModal({
  visible,
  visibleMonth,
  selectedDate,
  minimumDate,
  onClose,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
}: DatePickerModalProps) {
  const days = getCalendarDays(visibleMonth);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={onPreviousMonth}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Text style={styles.monthButtonText}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {formatMonthTitle(visibleMonth)}
            </Text>

            <TouchableOpacity
              style={styles.monthButton}
              onPress={onNextMonth}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Text style={styles.monthButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEK_DAYS.map(day => (
              <Text key={day} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {days.map((date, index) => {
              if (!date) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const disabled = isBeforeDate(date, minimumDate);
              const selected = isSameDate(date, selectedDate);

              return (
                <TouchableOpacity
                  key={formatDateValue(date)}
                  style={[
                    styles.dayCell,
                    styles.dayButton,
                    selected ? styles.selectedDayButton : null,
                    disabled ? styles.disabledDayButton : null,
                  ]}
                  onPress={() => onSelectDate(date)}
                  disabled={disabled}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected ? styles.selectedDayText : null,
                      disabled ? styles.disabledDayText : null,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const parseDateValue = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return getTodayDate();
  }

  return new Date(year, month - 1, day);
};

const getMonthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, monthCount: number) =>
  new Date(date.getFullYear(), date.getMonth() + monthCount, 1);

const getCalendarDays = (visibleMonth: Date) => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<Date | null> = Array(firstDayIndex).fill(null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
};

const formatMonthTitle = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const isSameDate = (firstDate: Date, secondDate: Date) =>
  formatDateValue(firstDate) === formatDateValue(secondDate);

const isBeforeDate = (firstDate: Date, secondDate: Date) =>
  getDateOnlyTime(firstDate) < getDateOnlyTime(secondDate);

const getDateOnlyTime = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  dateField: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  dateFieldError: { borderColor: '#E74C3C' },
  dateText: { fontSize: 16, color: '#333333' },
  placeholderText: { color: '#999999' },
  error: { color: '#E74C3C', fontSize: 12, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonText: { fontSize: 28, color: '#0066CC', lineHeight: 32 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#777777',
  },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayButton: { borderRadius: 21 },
  selectedDayButton: { backgroundColor: '#0066CC' },
  disabledDayButton: { opacity: 0.35 },
  dayText: { fontSize: 15, fontWeight: '700', color: '#333333' },
  selectedDayText: { color: '#FFFFFF' },
  disabledDayText: { color: '#999999' },
  closeButton: {
    borderWidth: 1,
    borderColor: '#0066CC',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  closeButtonText: { color: '#0066CC', fontWeight: '700' },
});

export default RegisterDriverDetailsScreen;
