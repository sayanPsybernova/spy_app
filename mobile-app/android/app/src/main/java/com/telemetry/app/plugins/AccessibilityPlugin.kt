package com.telemetry.app.plugins

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.telemetry.app.services.BrowserUrlService

@CapacitorPlugin(name = "Accessibility")
class AccessibilityPlugin : Plugin() {

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        val enabled = isAccessibilityServiceEnabled()
        val result = JSObject()
        result.put("granted", enabled)
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open accessibility settings", e)
        }
    }

    @PluginMethod
    fun isEnabled(call: PluginCall) {
        val enabled = isAccessibilityServiceEnabled()
        val result = JSObject()
        result.put("enabled", enabled)
        call.resolve(result)
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val context = activity.applicationContext
        val prefString = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )

        if (prefString.isNullOrEmpty()) {
            return false
        }

        val serviceName = "${context.packageName}/${BrowserUrlService::class.java.canonicalName}"
        return prefString.contains(serviceName)
    }
}
