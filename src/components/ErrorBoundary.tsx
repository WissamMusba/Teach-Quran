import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export class ErrorBoundary extends React.Component<any, { hasError: boolean; errorText: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorText: error.toString() };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // This will log the error to your Android ADB logs as well
    console.error("App Crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>App Crashed! 🚨</Text>
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { color: 'red', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#333', fontSize: 14, marginBottom: 20 },
  errorBox: { maxHeight: 400, width: '100%', backgroundColor: '#eee', borderRadius: 8, padding: 10 },
  errorText: { color: '#000', fontSize: 12 }
});
