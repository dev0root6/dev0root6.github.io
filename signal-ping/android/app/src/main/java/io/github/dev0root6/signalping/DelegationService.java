package io.github.dev0root6.signalping;

import androidx.browser.trusted.TrustedWebActivityService;

/**
 * Receives Web Push notifications from Chrome and posts them as Signal Ping.
 *
 * <p>No body needed: androidx.browser's base class does the work. Its presence
 * in the manifest is what makes an alert arrive as an app notification rather
 * than a Chrome one — which also means the user can mute Chrome everywhere else
 * and still be reachable here, the whole point of the app.
 */
public class DelegationService extends TrustedWebActivityService {
}
