package io.github.dev0root6.signalping;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

/**
 * Opens the Signal Ping PWA as a Trusted Web Activity.
 *
 * <p>Almost everything is inherited from androidx.browser. The one thing this
 * subclass adds is asking for POST_NOTIFICATIONS before handing off to Chrome:
 * on Android 13+ an unanswered permission means every alert this app exists to
 * deliver would be dropped silently.
 */
public class LauncherActivity extends androidx.browser.trusted.LauncherActivity {

    private static final int REQUEST_NOTIFICATIONS = 1;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestNotificationPermissionIfNeeded();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return; // Granted at install time before Android 13.
        }
        boolean granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        if (!granted) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }
    }

    /**
     * Keeps the splash screen up until Chrome is ready. Returning false here
     * would flash a blank activity on slower devices.
     */
    @Override
    protected boolean shouldLaunchImmediately() {
        return true;
    }
}
