import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.superpowergym.app',
  appName: 'Super Power Gym',
  webDir: 'dist',
  // Preferences may contain client notes and session data: never echo bridge payloads.
  loggingBehavior: 'none',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile'
  }
};

export default config;
