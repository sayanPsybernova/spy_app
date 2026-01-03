package com.telemetry.app.plugins

import android.content.Context
import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.telemetry.app.services.TelemetryService

@CapacitorPlugin(name = "ForegroundService")
class ForegroundServicePlugin : Plugin() {

    companion object {
        var isServiceRunning = false
    }

    @PluginMethod
    fun startService(call: PluginCall) {
        val title = call.getString("title") ?: "Telemetry Active"
        val body = call.getString("body") ?: "App usage tracking is enabled"
        val deviceId = call.getString("deviceId") ?: ""
        val serverUrl = call.getString("serverUrl") ?: ""
        val wsUrl = call.getString("wsUrl") ?: ""
        val locationEnabled = call.getBoolean("locationEnabled", true) ?: true

        try {
            // Save configuration to SharedPreferences for service to read
            val prefs = context.getSharedPreferences(TelemetryService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                putBoolean(TelemetryService.KEY_TRACKING_ENABLED, true)
                putBoolean(TelemetryService.KEY_LOCATION_ENABLED, locationEnabled)
                if (deviceId.isNotEmpty()) {
                    putString(TelemetryService.KEY_DEVICE_ID, deviceId)
                }
                if (serverUrl.isNotEmpty()) {
                    putString(TelemetryService.KEY_SERVER_URL, serverUrl)
                }
                if (wsUrl.isNotEmpty()) {
                    putString(TelemetryService.KEY_WS_URL, wsUrl)
                }
                apply()
            }

            val intent = Intent(context, TelemetryService::class.java).apply {
                action = TelemetryService.ACTION_START
                putExtra(TelemetryService.EXTRA_TITLE, title)
                putExtra(TelemetryService.EXTRA_BODY, body)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }

            isServiceRunning = true
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to start service", e)
        }
    }

    @PluginMethod
    fun stopService(call: PluginCall) {
        try {
            // Update SharedPreferences to indicate tracking is disabled
            val prefs = context.getSharedPreferences(TelemetryService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(TelemetryService.KEY_TRACKING_ENABLED, false).apply()

            val intent = Intent(context, TelemetryService::class.java).apply {
                action = TelemetryService.ACTION_STOP
            }
            context.startService(intent)

            isServiceRunning = false
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to stop service", e)
        }
    }

    @PluginMethod
    fun updateNotification(call: PluginCall) {
        val title = call.getString("title") ?: return call.reject("Title required")
        val body = call.getString("body") ?: return call.reject("Body required")

        try {
            val intent = Intent(context, TelemetryService::class.java).apply {
                action = TelemetryService.ACTION_UPDATE
                putExtra(TelemetryService.EXTRA_TITLE, title)
                putExtra(TelemetryService.EXTRA_BODY, body)
            }
            context.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to update notification", e)
        }
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        val result = JSObject()
        result.put("running", isServiceRunning)
        call.resolve(result)
    }

    @PluginMethod
    fun saveConfig(call: PluginCall) {
        val deviceId = call.getString("deviceId") ?: ""
        val serverUrl = call.getString("serverUrl") ?: ""
        val wsUrl = call.getString("wsUrl") ?: ""
        val locationEnabled = call.getBoolean("locationEnabled", true) ?: true

        try {
            val prefs = context.getSharedPreferences(TelemetryService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                if (deviceId.isNotEmpty()) {
                    putString(TelemetryService.KEY_DEVICE_ID, deviceId)
                }
                if (serverUrl.isNotEmpty()) {
                    putString(TelemetryService.KEY_SERVER_URL, serverUrl)
                }
                if (wsUrl.isNotEmpty()) {
                    putString(TelemetryService.KEY_WS_URL, wsUrl)
                }
                putBoolean(TelemetryService.KEY_LOCATION_ENABLED, locationEnabled)
                apply()
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to save config", e)
        }
    }

    @PluginMethod
    fun updateLocationEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true) ?: true

        try {
            val prefs = context.getSharedPreferences(TelemetryService.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(TelemetryService.KEY_LOCATION_ENABLED, enabled).apply()
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to update location setting", e)
        }
    }
}
