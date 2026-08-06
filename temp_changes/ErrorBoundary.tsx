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
 * FLOW: 1) getDerivedStateFromError sets hasError + errorText (error message, or String() for non-Error throws);
 *       2) componentDidCatch logs "App Crashed:" to console.error (surfaces in Android ADB logs) and stashes
 *          errorInfo.componentStack into state — shown in the fallback (available in production since React 17);
 *       3) when hasError, renders title + scrollable error text + component stack; otherwise this.props.children.
 * CALLS: none.
 * CALLED BY: App.tsx:78-86 (wraps the entire app).
 * AFFECTS: Rendering of the whole app on uncaught render errors.
 * NOTES: No reset/retry button — the app must be restarted. Only catches render/lifecycle errors,
 *        NOT async errors or event-handler exceptions. The error is NEVER swallowed: console.error
 *        always fires and the fallback always shows the message.
 */
export class ErrorBoundary extends React.Component<any, { hasError: boolean; errorText: string; componentStack: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorText: '', componentStack: '' };
  }

  static getDerivedStateFromError(error: any) {
    // Defensive: render errors are usually Error instances, but `throw 'string'`/`throw null` must not crash the fallback path itself.
    return { hasError: true, errorText: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // This will log the error to your Android ADB logs as well
    console.error('App Crashed:', error, errorInfo)
    if (errorInfo?.componentStack) this.setState({ componentStack: errorInfo.componentStack })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>App Crashed!</Text>
          <Text style={styles.subtitle}>Please send a screenshot of this error:</Text>
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>{this.state.errorText}</Text>
            {this.state.componentStack ? <Text style={styles.stackText}>{this.state.componentStack}</Text> : null}
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
  errorText: { color: '#000', fontSize: 12 },
  stackText: { color: '#666', fontSize: 10, marginTop: 8 },
});
