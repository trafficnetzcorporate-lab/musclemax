#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundleId = 'com.jms.musclemax';
const usage = `Build, install, and open a Muscle Max Debug build on a connected iPhone.

Usage: npm run ios:device -- [options]

  --device <UDID, identifier, or exact name>  Choose a particular iPhone
  --list-devices                            List known iPhones; do not build
  --check                                   Check tools and phone; do not build
  --lovable                                 Opt into the Lovable sandbox
  --help                                    Show this help

The default uses fresh bundled assets. One connected iPhone is selected
automatically; multiple connected iPhones require --device. The existing app
is updated in place, then restarted. Finish any workout before running.

Build cache: ~/Library/Developer/Xcode/DerivedData/MuscleMax-device-<project hash>
Override the cache location with MUSCLEMAX_DERIVED_DATA if needed.`;

function run(command, args, { capture = false, hint = '', env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const details = capture ? result.stderr?.trim() || result.stdout?.trim() : '';
    throw new Error([
      `${command} failed${result.status !== null ? ` (exit ${result.status})` : ''}.`,
      result.error?.message, details, hint,
    ].filter(Boolean).join('\n'));
  }
  return result.stdout?.trim();
}

function deviceLabel(device) {
  return `${device.deviceProperties?.name || 'Unnamed iPhone'} — ` +
    `${device.hardwareProperties.udid || device.identifier} ` +
    `(${device.connectionProperties?.tunnelState || 'unavailable'})`;
}

function main() {
  const options = { device: process.env.MUSCLEMAX_IOS_DEVICE, lovable: false };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case '--help': console.log(usage); return;
      case '--check': options.check = true; break;
      case '--list-devices': options.list = true; break;
      case '--lovable': options.lovable = true; break;
      case '--device':
        if (!args[i + 1] || args[i + 1].startsWith('--')) {
          throw new Error('--device needs a UDID, CoreDevice identifier, or exact device name.');
        }
        options.device = args[++i];
        break;
      default: throw new Error(`Unknown option: ${args[i]}\nRun with --help for usage.`);
    }
  }
  if (process.platform !== 'darwin') throw new Error('iPhone builds require macOS and Xcode.');

  const xcodeVersion = run('xcodebuild', ['-version'], {
    capture: true,
    hint: 'Open the installed Xcode once and finish its setup. Select that Xcode under Settings > Locations > Command Line Tools.',
  });
  console.log(xcodeVersion);
  const temp = mkdtempSync(join(tmpdir(), 'musclemax-device-'));
  let devices;
  try {
    const deviceFile = join(temp, 'devices.json');
    run('xcrun', ['devicectl', 'list', 'devices', '--timeout', '30', '--quiet', '--json-output', deviceFile], {
      hint: 'Xcode 15 or newer is required. Connect and unlock the iPhone, and trust this Mac.',
    });
    const result = JSON.parse(readFileSync(deviceFile, 'utf8'));
    if (!Array.isArray(result.result?.devices)) throw new Error('Xcode returned an unexpected device list.');
    devices = result.result.devices.filter(device =>
      device.hardwareProperties?.deviceType === 'iPhone' &&
      device.hardwareProperties?.reality === 'physical');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  if (options.list) {
    console.log(devices.length ? devices.map(deviceLabel).join('\n') : 'No known iPhones. Connect and trust a phone in Xcode.');
    return;
  }
  const connected = devices.filter(device => device.connectionProperties?.tunnelState === 'connected');
  const candidates = options.device
    ? devices.filter(device => [device.identifier, device.hardwareProperties?.udid, device.deviceProperties?.name]
      .some(value => value?.toLowerCase() === options.device.toLowerCase()))
    : connected;
  if (candidates.length !== 1) {
    throw new Error([
      candidates.length > 1 ? 'More than one iPhone matches. Choose one with --device <UDID>.' :
        options.device ? `No known iPhone matches "${options.device}".` : 'No connected iPhone found.',
      'Connect by USB and unlock the phone, trust this Mac, then enable Developer Mode if prompted.',
      ...devices.map(deviceLabel),
    ].join('\n'));
  }
  const device = candidates[0];
  if (device.connectionProperties?.tunnelState !== 'connected') {
    throw new Error(`${deviceLabel(device)} is not connected. Unlock it and connect by USB, then retry.`);
  }
  if (device.deviceProperties?.developerModeStatus !== 'enabled') {
    throw new Error('Enable Settings > Privacy & Security > Developer Mode on the selected iPhone, then reconnect.');
  }
  if (!device.hardwareProperties?.udid) throw new Error('Xcode did not return a UDID for the selected iPhone.');
  if (!existsSync(join(root, 'node_modules/.bin/cap'))) throw new Error('Project dependencies are missing. Run npm ci first.');
  console.log(`Selected: ${deviceLabel(device)}`);
  console.log(`Mode: ${options.lovable ? 'Lovable sandbox (remote web content)' : 'bundled local assets'}`);
  if (options.check) {
    console.log('Tools and device checks passed. Signing will be checked by the build. No app was changed.');
    return;
  }

  console.log('\n1/4 Preparing web assets and native plugins…');
  run('npm', ['run', options.lovable ? 'ios:sync:lovable' : 'ios:sync:bundled'], {
    env: { MUSCLEMAX_LIVE_RELOAD: options.lovable ? '1' : '0' },
  });
  const configPath = join(root, 'ios/App/App/capacitor.config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  if (config.appId !== bundleId || Boolean(config.server?.url) !== options.lovable) {
    throw new Error('The synced Capacitor bundle ID or server mode is unexpected. Stopping before install.');
  }

  const projectHash = createHash('sha256').update(root).digest('hex').slice(0, 10);
  const derivedData = process.env.MUSCLEMAX_DERIVED_DATA
    ? resolve(root, process.env.MUSCLEMAX_DERIVED_DATA)
    : join(homedir(), 'Library/Developer/Xcode/DerivedData', `MuscleMax-device-${projectHash}`);
  console.log('\n2/4 Building Debug app (reusing the native build cache)…');
  run('xcodebuild', [
    '-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Debug',
    '-destination', `id=${device.hardwareProperties.udid}`,
    '-derivedDataPath', derivedData, '-quiet', 'build',
  ], {
    hint: 'For signing errors, open npm run ios:open and check App > Signing & Capabilities using the existing development team. No app was installed by this command.',
  });
  const app = join(derivedData, 'Build/Products/Debug-iphoneos/App.app');
  const builtBundleId = run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', join(app, 'Info.plist')], { capture: true });
  const builtConfig = JSON.parse(readFileSync(join(app, 'capacitor.config.json'), 'utf8'));
  if (builtBundleId !== bundleId || Boolean(builtConfig.server?.url) !== options.lovable) {
    throw new Error('The built app has an unexpected bundle ID or server mode. Stopping before install.');
  }

  console.log('\n3/4 Updating the app on the selected iPhone…');
  run('xcrun', ['devicectl', 'device', 'install', 'app', '--device', device.identifier, '--timeout', '120', app], {
    hint: 'Unlock the phone and check its connection. This helper never uninstalls the app or deletes its data.',
  });
  console.log('\n4/4 Opening Muscle Max…');
  run('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', device.identifier,
    '--timeout', '30', '--terminate-existing', bundleId], {
    hint: 'The new app was installed. Unlock the phone and open Muscle Max manually if launch is blocked.',
  });
  console.log(`\nMuscle Max is running on ${device.deviceProperties.name} (${options.lovable ? 'Lovable' : 'bundled Debug'}).`);
}

try {
  main();
} catch (error) {
  console.error(`\nMuscle Max: ${error.message}`);
  process.exitCode = 1;
}
