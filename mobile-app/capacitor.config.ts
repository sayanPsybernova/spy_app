import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.telemetry.app',
  appName: 'Telemetry',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    App: {
      // App plugin config
    },
    Preferences: {
      // Preferences plugin config
    }
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f0f23'
  }
};

export default config;
