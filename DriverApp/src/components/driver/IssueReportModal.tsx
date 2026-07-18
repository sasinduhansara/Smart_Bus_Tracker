import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import type { IssueCategory, IssueSeverity } from '../../types';
import {
  driverColors,
  driverRadii,
  driverSizes,
  driverSpacing,
  driverTypography,
} from '../../theme/tokens';

interface IssueOption {
  value: IssueCategory;
  label: string;
  icon: string;
  defaultSeverity: IssueSeverity;
}

const ISSUE_OPTIONS: IssueOption[] = [
  {
    value: 'vehicle_breakdown',
    label: 'Vehicle breakdown',
    icon: 'build-outline',
    defaultSeverity: 'high',
  },
  {
    value: 'route_obstruction',
    label: 'Route obstruction',
    icon: 'warning-outline',
    defaultSeverity: 'medium',
  },
  {
    value: 'traffic_delay',
    label: 'Traffic delay',
    icon: 'time-outline',
    defaultSeverity: 'low',
  },
  {
    value: 'accident',
    label: 'Accident',
    icon: 'alert-circle-outline',
    defaultSeverity: 'critical',
  },
  {
    value: 'passenger_emergency',
    label: 'Passenger emergency',
    icon: 'medkit-outline',
    defaultSeverity: 'critical',
  },
  {
    value: 'technical_issue',
    label: 'App / technical issue',
    icon: 'phone-portrait-outline',
    defaultSeverity: 'medium',
  },
  {
    value: 'gps_problem',
    label: 'GPS problem',
    icon: 'locate-outline',
    defaultSeverity: 'medium',
  },
];

const SEVERITIES: IssueSeverity[] = ['low', 'medium', 'high', 'critical'];

export interface IssueReportModalProps {
  visible: boolean;
  submitting?: boolean;
  initialCategory?: IssueCategory;
  onClose: () => void;
  onSubmit: (data: {
    category: IssueCategory;
    severity: IssueSeverity;
    message?: string;
  }) => Promise<void>;
}

export function IssueReportModal({
  visible,
  submitting = false,
  initialCategory,
  onClose,
  onSubmit,
}: IssueReportModalProps) {
  const initialOption = useMemo(
    () => ISSUE_OPTIONS.find(option => option.value === initialCategory),
    [initialCategory],
  );
  const [category, setCategory] = useState<IssueCategory>(
    initialOption?.value || 'traffic_delay',
  );
  const [severity, setSeverity] = useState<IssueSeverity>(
    initialOption?.defaultSeverity || 'low',
  );
  const [message, setMessage] = useState('');

  const chooseCategory = (option: IssueOption) => {
    setCategory(option.value);
    setSeverity(option.defaultSeverity);
  };

  const submit = async () => {
    await onSubmit({
      category,
      severity,
      message: message.trim() || undefined,
    });
  };

  const confirmSubmit = () => {
    if (severity !== 'critical' && severity !== 'high') {
      submit().catch(() => undefined);
      return;
    }

    Alert.alert(
      'Confirm serious report',
      'This report will be recorded against the current vehicle and route. Submit it now?',
      [
        { text: 'Review', style: 'cancel' },
        {
          text: 'Submit report',
          style: 'destructive',
          onPress: () => submit().catch(() => undefined),
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Report an issue
            </Text>
            <Text style={styles.subtitle}>
              The report is private and linked by the backend.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close issue report"
            disabled={submitting}
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Icon
              name="close"
              size={driverSizes.iconMedium}
              color={driverColors.text}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.optionGrid}>
            {ISSUE_OPTIONS.map(option => {
              const selected = category === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  disabled={submitting}
                  onPress={() => chooseCategory(option)}
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                  ]}
                >
                  <Icon
                    name={option.icon}
                    size={driverSizes.iconMedium}
                    color={
                      selected ? driverColors.teal700 : driverColors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      selected && styles.optionLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Severity</Text>
          <View accessibilityRole="radiogroup" style={styles.severityRow}>
            {SEVERITIES.map(level => {
              const selected = severity === level;

              return (
                <Pressable
                  key={level}
                  accessibilityRole="radio"
                  accessibilityLabel={`${level} severity`}
                  accessibilityState={{ checked: selected }}
                  disabled={submitting}
                  onPress={() => setSeverity(level)}
                  style={[
                    styles.severity,
                    selected && styles.severitySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      selected && styles.severityTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Notes (optional)</Text>
          <TextInput
            accessibilityLabel="Issue notes"
            editable={!submitting}
            maxLength={500}
            multiline
            onChangeText={setMessage}
            placeholder="Add information that helps operations respond safely"
            placeholderTextColor={driverColors.textSubtle}
            style={styles.input}
            textAlignVertical="top"
            value={message}
          />
          <Text style={styles.characterCount}>{message.length}/500</Text>

          <View style={styles.privacyNotice}>
            <Icon
              name="shield-checkmark-outline"
              size={driverSizes.iconSmall}
              color={driverColors.info}
            />
            <Text style={styles.privacyText}>
              Driver, bus, route, trip, and server time are derived securely;
              they are not entered here.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: submitting, disabled: submitting }}
            disabled={submitting}
            onPress={confirmSubmit}
            style={[styles.submitButton, submitting && styles.disabled]}
          >
            {submitting ? (
              <ActivityIndicator color={driverColors.textOnDark} />
            ) : (
              <Icon
                name="send"
                size={driverSizes.iconMedium}
                color={driverColors.textOnDark}
              />
            )}
            <Text style={styles.submitText}>
              {submitting ? 'Submitting…' : 'Submit private report'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: driverColors.background },
  header: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: driverSpacing.md,
    padding: driverSpacing.lg,
    backgroundColor: driverColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: driverColors.border,
  },
  title: {
    color: driverColors.text,
    fontSize: driverTypography.sectionTitle,
    fontWeight: driverTypography.weights.heavy,
  },
  subtitle: {
    color: driverColors.textMuted,
    fontSize: driverTypography.label,
    marginTop: driverSpacing.xxs,
  },
  closeButton: {
    width: driverSizes.compactTouchTarget,
    height: driverSizes.compactTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.surfaceMuted,
  },
  content: { padding: driverSpacing.lg, paddingBottom: driverSpacing.xxl },
  sectionLabel: {
    color: driverColors.text,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
    marginBottom: driverSpacing.sm,
    marginTop: driverSpacing.sm,
  },
  optionGrid: { gap: driverSpacing.xs },
  option: {
    minHeight: driverSizes.primaryControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: driverSpacing.sm,
    paddingHorizontal: driverSpacing.md,
    borderWidth: 1,
    borderColor: driverColors.border,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.surface,
  },
  optionSelected: {
    borderColor: driverColors.teal600,
    backgroundColor: driverColors.teal100,
  },
  optionLabel: {
    color: driverColors.textMuted,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.semibold,
  },
  optionLabelSelected: { color: driverColors.teal700 },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: driverSpacing.xs },
  severity: {
    minHeight: driverSizes.minimumTouchTarget,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: driverSpacing.sm,
    borderWidth: 1,
    borderColor: driverColors.border,
    borderRadius: driverRadii.pill,
    backgroundColor: driverColors.surface,
  },
  severitySelected: {
    borderColor: driverColors.amber600,
    backgroundColor: driverColors.warningSoft,
  },
  severityText: {
    color: driverColors.textMuted,
    fontSize: driverTypography.label,
    fontWeight: driverTypography.weights.bold,
    textTransform: 'capitalize',
  },
  severityTextSelected: { color: driverColors.warning },
  input: {
    minHeight: 116,
    padding: driverSpacing.md,
    borderWidth: 1,
    borderColor: driverColors.border,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.surface,
    color: driverColors.text,
    fontSize: driverTypography.body,
    lineHeight: 21,
  },
  characterCount: {
    alignSelf: 'flex-end',
    color: driverColors.textSubtle,
    fontSize: driverTypography.caption,
    marginTop: driverSpacing.xxs,
  },
  privacyNotice: {
    flexDirection: 'row',
    gap: driverSpacing.xs,
    marginTop: driverSpacing.lg,
    padding: driverSpacing.sm,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.infoSoft,
  },
  privacyText: {
    flex: 1,
    color: driverColors.textMuted,
    fontSize: driverTypography.caption,
    lineHeight: 18,
  },
  footer: {
    padding: driverSpacing.md,
    backgroundColor: driverColors.surface,
    borderTopWidth: 1,
    borderTopColor: driverColors.border,
  },
  submitButton: {
    minHeight: driverSizes.primaryControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: driverSpacing.xs,
    borderRadius: driverRadii.control,
    backgroundColor: driverColors.teal700,
  },
  submitText: {
    color: driverColors.textOnDark,
    fontSize: driverTypography.body,
    fontWeight: driverTypography.weights.bold,
  },
  disabled: { opacity: 0.55 },
});
