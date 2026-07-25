import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, scaleFont } from '../utils/theme';

export class ErrorBoundary extends React.Component<any, { hasError: boolean; errorText: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorText: error.toString() };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("App Crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>App Crashed!</Text>
          <Text style={styles.subtitle}>Please send a screenshot of this error:</Text>
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>{this.state.errorText}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl, backgroundColor: COLORS.bgWhite },
  title: { color: COLORS.red, fontSize: scaleFont(22), fontWeight: 'bold', marginBottom: SPACING.sm },
  subtitle: { color: COLORS.textDarkSecondary, fontSize: scaleFont(14), marginBottom: SPACING.xl },
  errorBox: { maxHeight: 400, width: '100%', backgroundColor: COLORS.bgLightCard, borderRadius: RADIUS.md, padding: SPACING.sm },
  errorText: { color: COLORS.textDark, fontSize: scaleFont(12) }
});
