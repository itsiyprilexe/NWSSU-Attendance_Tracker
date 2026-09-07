import React from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';

const GREEN = '#1E7A3E';
const SUBTITLE_GRAY = '#3A3F47';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image
        // TODO: point this at your actual NWSSU seal asset, e.g.:
        // source={require('../../assets/nwssu-logo.png')}
        source={require('../../assets/images/nwssu-removebg-preview.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>UniMonitor</Text>
      <Text style={styles.subtitle}>
        Northwest Samar State University Student Attendance Tracker
      </Text>
      <ActivityIndicator size="large" color={GREEN} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: GREEN,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: SUBTITLE_GRAY,
    textAlign: 'center',
    marginBottom: 32,
  },
  spinner: {
    marginTop: 8,
  },
});