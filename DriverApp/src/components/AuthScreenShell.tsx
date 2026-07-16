import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AuthScreenShellProps {
  children: ReactNode;
  centered?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}

function AuthScreenShell({
  children,
  centered = false,
  contentContainerStyle,
  scroll = false,
}: AuthScreenShellProps) {
  const contentStyle = [
    styles.content,
    centered && styles.centeredContent,
    contentContainerStyle,
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#07111F" />
      <View style={styles.background}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {scroll ? (
            <ScrollView
              contentContainerStyle={contentStyle}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={contentStyle}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07111F',
  },
  background: {
    flex: 1,
    backgroundColor: '#07111F',
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  centeredContent: {
    justifyContent: 'center',
  },
});

export default AuthScreenShell;
