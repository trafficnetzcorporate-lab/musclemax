import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Muscle Max native configuration.
 *
 * appId is the PERMANENT production Bundle ID — it is set deliberately here so
 * the Xcode project and App Store record are created under the final identity.
 *
 * Device builds use bundled dist assets by default. Opt into the existing
 * Lovable hot-reload workflow with MUSCLEMAX_LIVE_RELOAD=1 when syncing iOS.
 * See docs/ios-development.md for the two development workflows.
 */
const liveReload = process.env.MUSCLEMAX_LIVE_RELOAD === '1';

const config: CapacitorConfig = {
  appId: 'com.jms.musclemax',
  appName: 'musclemax',
  webDir: 'dist',
  ...(liveReload
    ? {
        server: {
          url: 'https://f86be05f-d3d8-45ba-9896-ffd439c44b15.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {}),
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
