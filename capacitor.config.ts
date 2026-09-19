import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Muscle Max native configuration.
 *
 * appId is the PERMANENT production Bundle ID — it is set deliberately here so
 * the Xcode project and App Store record are created under the final identity.
 *
 * The `server` block enables hot-reload from the Lovable sandbox during
 * development ONLY. It must be removed (or `server` deleted entirely) before
 * any TestFlight / App Store build — a store binary must never load remote code.
 */
const config: CapacitorConfig = {
  appId: 'com.jms.musclemax',
  appName: 'musclemax',
  webDir: 'dist',
  server: {
    url: 'https://f86be05f-d3d8-45ba-9896-ffd439c44b15.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
