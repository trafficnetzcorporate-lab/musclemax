# iPhone development builds

Both workflows use the existing development signing, bundle ID
`com.jms.musclemax`, and native EmomNative plugin. These instructions do not
prepare or submit a TestFlight/App Store release.

## Bundled acceptance testing (default)

From the project folder, one command builds the latest local source, syncs the
native plugins, builds Debug, updates the connected iPhone, and opens the app:

```sh
npm run ios:device
```

Finish any active workout first: installing a new build restarts the app. The
helper updates the existing `com.jms.musclemax` app in place; it never uninstalls
the app or deletes its data. It uses the existing development signing settings
and does not change Apple accounts, register devices, or submit a release.

Keep the phone unlocked. USB is the most predictable connection; a paired phone
connected through Xcode over the same network can also work. The first native
build may take longer. Later runs reuse a stable Xcode build cache outside the
repository and do not clean/recompile unchanged native code unnecessarily.

Useful checks and selection options:

```sh
npm run ios:device -- --check
npm run ios:device -- --list-devices
npm run ios:device -- --device "Mr. Future"
```

With exactly one connected iPhone, selection is automatic. If more than one
phone is connected, pass its exact name or, preferably, its UDID. An ambiguous
name stops with a selection message. `MUSCLEMAX_IOS_DEVICE` can also select a
device. `--check` verifies tools and the phone without building or installing;
signing is validated by the actual build. `MUSCLEMAX_DERIVED_DATA` can override
the default build cache location printed by `--help`.

For interactive debugging or a signing error, the Xcode workflow remains:

```sh
npm run ios:sync:bundled
npm run ios:open
```

Select the connected iPhone in Xcode and run the **Debug** build. This builds
`dist`, copies it into `ios/App/App/public`, and writes the native Capacitor
configuration without `server.url`. The app loads `capacitor://localhost`
from its installed bundle. Account and other online features still need a
network connection.

Plain `npx cap sync ios` also defaults to bundled assets unless
`MUSCLEMAX_LIVE_RELOAD=1` is set; it does not build fresh web assets first.
The bundled script explicitly sets the mode to `0` so an inherited hot-reload
environment variable cannot accidentally select Lovable during acceptance testing.

## Lovable hot reload (opt in)

To install and open the app with the existing Lovable sandbox enabled:

```sh
npm run ios:device -- --lovable
```

Or use Xcode directly:

```sh
npm run ios:sync:lovable
npm run ios:open
```

Run again from Xcode. This retains the original Lovable sandbox URL and its
development settings. The app will load the remote sandbox, which may require
Lovable authentication, instead of the bundled web content.

## Switch back after hot reload

Run `npm run ios:device`, or `npm run ios:sync:bundled` and rebuild/install from
Xcode. Syncing writes the
selected mode into `ios/App/App/capacitor.config.json`; changing the environment
alone does not change an app already installed on the phone. Check that the
generated JSON has no `server.url` before a bundled acceptance run.

## Fast iteration between device checks

Use `npm run dev` for quick local web UI changes with automatic browser refresh.
Then use `npm run ios:device` to check the actual iPhone build, especially native
timer audio, background/resume behavior, and device layout. Browser preview
does not validate those native behaviors. The opt-in Lovable mode loads the
Lovable sandbox, so editing local source alone does not update that remote app.

Xcode does not automatically pull GitHub changes. The helper builds the current
local checkout, including uncommitted edits; it neither pulls nor commits code.
After bringing in upstream changes, preserve local work and run the helper
again. A bundled app on the phone changes only after a new build is installed.
