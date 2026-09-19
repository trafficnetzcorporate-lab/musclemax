import Foundation
import AVFoundation
import UIKit
import Capacitor

/**
 * Muscle Max native bridges.
 *
 * - monotonicNow: ProcessInfo.systemUptime — monotonic, immune to wall-clock changes.
 * - setKeepAwake: UIApplication.isIdleTimerDisabled during active workouts.
 * - playEmomCue: activates AVAudioSession (.playback + .duckOthers), plays the
 *   bundled cue, then immediately deactivates with .notifyOthersOnDeactivation
 *   so the user's music returns to full volume. Ducking lasts only for the cue.
 *   We intentionally do NOT use .interruptSpokenAudioAndMixWithOthers: podcasts
 *   and spoken audio are ducked, not paused.
 */
@objc(EmomNativePlugin)
public class EmomNativePlugin: CAPPlugin, CAPBridgedPlugin, AVAudioPlayerDelegate {
    public let identifier = "EmomNativePlugin"
    public let jsName = "EmomNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "monotonicNow", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKeepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playEmomCue", returnType: CAPPluginReturnPromise)
    ]

    private var player: AVAudioPlayer?
    private var pendingCall: CAPPluginCall?

    @objc func monotonicNow(_ call: CAPPluginCall) {
        call.resolve(["seconds": ProcessInfo.processInfo.systemUptime])
    }

    @objc func setKeepAwake(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = enabled
            call.resolve()
        }
    }

    @objc func playEmomCue(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? "hard"
        let resource = "cue_\(kind)"

        guard let url = Bundle.module.url(forResource: resource, withExtension: "wav") else {
            call.reject("Cue asset missing: \(resource).wav")
            return
        }

        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                // Duck others only for the duration of this short cue.
                try session.setCategory(.playback, mode: .default, options: [.duckOthers])
                try session.setActive(true)

                let player = try AVAudioPlayer(contentsOf: url)
                player.delegate = self
                player.volume = 1.0
                self.player = player
                self.pendingCall = call
                player.play()
            } catch {
                call.reject("Audio session failed: \(error.localizedDescription)")
            }
        }
    }

    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        finishCue()
    }

    public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        finishCue()
    }

    private func finishCue() {
        // Hand audio focus straight back — music un-ducks immediately.
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        self.player = nil
        if let call = self.pendingCall {
            call.resolve()
            self.pendingCall = nil
        }
    }
}
