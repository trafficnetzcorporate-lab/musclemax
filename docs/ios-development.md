# iPhone development builds

Both workflows use the existing development signing, bundle ID
`com.jms.musclemax`, and native EmomNative plugin. These instructions do not
prepare or submit a TestFlight/App Store release.

## Bundled acceptance testing (default)

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

```sh
npm run ios:sync:lovable
npm run ios:open
```

Run again from Xcode. This retains the original Lovable sandbox URL and its
development settings. The app will load the remote sandbox, which may require
Lovable authentication, instead of the bundled web content.

## Switch back after hot reload

Run `npm run ios:sync:bundled` and rebuild/install from Xcode. Syncing writes the
selected mode into `ios/App/App/capacitor.config.json`; changing the environment
alone does not change an app already installed on the phone. Check that the
generated JSON has no `server.url` before a bundled acceptance run.
