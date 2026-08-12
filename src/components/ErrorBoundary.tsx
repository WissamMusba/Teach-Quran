/**
 * FILE: src/components/ErrorBoundary.tsx
 * ROLE: App-wide crash shield — renders an "App Crashed" screen instead of unmounting the tree on uncaught render errors.
 * DEPENDS ON: nothing (react-native View/Text/ScrollView for the crash UI).
 * USED BY: App.tsx:20,78 — wraps SafeAreaProvider > Provider > PersistGate, i.e. the whole app.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

/**
 * ErrorBoundary — class component catching render/lifecycle errors of all children.
 * WHAT: Catches errors thrown while rendering the tree below; shows a fallback screen instead of a white-screen crash.
 * FLOW: 1) getDerivedStateFromError sets hasError + errorText; 2) componentDidCatch logs "App Crashed:" to console.error
 *        (surfaces in Android ADB logs); 3) when hasError, renders title + scrollable error text; otherwise this.props.children.
 * CALLS: none.
 * CALLED BY: App.tsx:78-86 (wraps the entire app).
 * AFFECTS: Rendering of the whole app on uncaught render errors.
 * NOTES: No reset/retry button — the app must be restarted. Only catches render/lifecycle errors,
 *        NOT async errors or event-handler exceptions.
 */
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#1A1A1A' },
  title: { color: 'red', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#333', fontSize: 14, marginBottom: 20 },
  errorBox: { maxHeight: 400, width: '100%', backgroundColor: '#eee', borderRadius: 8, padding: 10 },
  errorText: { color: '#000', fontSize: 12 }
});
