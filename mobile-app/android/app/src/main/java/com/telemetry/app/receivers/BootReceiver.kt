package com.telemetry.app.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.telemetry.app.services.TelemetryService

class BootReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON" ||
            intent.action == "com.htc.intent.action.QUICKBOOT_POWERON") {

            Log.d(TAG, "Boot completed - checking if tracking was enabled")

            // Check if tracking was enabled before reboot
            val prefs = context.getSharedPreferences(TelemetryService.PREFS_NAME, Context.MODE_PRIVATE)
            val wasTrackingEnabled = prefs.getBoolean(TelemetryService.KEY_TRACKING_ENABLED, false)
            val locationEnabled = prefs.getBoolean(TelemetryService.KEY_LOCATION_ENABLED, true)

            Log.d(TAG, "Tracking was enabled: $wasTrackingEnabled, Location enabled: $locationEnabled")

            if (wasTrackingEnabled) {
                val serviceIntent = Intent(context, TelemetryService::class.java).apply {
                    action = TelemetryService.ACTION_START
                    putExtra(TelemetryService.EXTRA_TITLE, "Location Sharing Active")
                    putExtra(TelemetryService.EXTRA_BODY,
                        if (locationEnabled) "Sharing your location" else "App tracking enabled")
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                    Log.d(TAG, "Service started after boot")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start service after boot", e)
                }
            }
        }
    }
}
