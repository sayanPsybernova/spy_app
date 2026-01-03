package com.telemetry.app.plugins

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "UsageStats")
class UsageStatsPlugin : Plugin() {

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        val granted = checkUsageStatsPermission()
        val result = JSObject()
        result.put("granted", granted)
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open usage access settings", e)
        }
    }

    @PluginMethod
    fun getCurrentApp(call: PluginCall) {
        if (!checkUsageStatsPermission()) {
            call.reject("Usage stats permission not granted")
            return
        }

        try {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val endTime = System.currentTimeMillis()
            val startTime = endTime - 60000 // Last minute

            val events = usageStatsManager.queryEvents(startTime, endTime)
            var lastApp: JSObject? = null
            var lastTimestamp: Long = 0

            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                    event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                    if (event.timeStamp > lastTimestamp) {
                        lastTimestamp = event.timeStamp
                        lastApp = JSObject().apply {
                            put("packageName", event.packageName)
                            put("appLabel", getAppLabel(event.packageName))
                            put("lastUsed", event.timeStamp)
                        }
                    }
                }
            }

            if (lastApp != null) {
                call.resolve(lastApp)
            } else {
                call.resolve(JSObject())
            }
        } catch (e: Exception) {
            call.reject("Failed to get current app", e)
        }
    }

    @PluginMethod
    fun getUsageStats(call: PluginCall) {
        if (!checkUsageStatsPermission()) {
            call.reject("Usage stats permission not granted")
            return
        }

        val startTime = call.getLong("startTime") ?: (System.currentTimeMillis() - 86400000)
        val endTime = call.getLong("endTime") ?: System.currentTimeMillis()

        try {
            val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )

            val apps = JSArray()
            stats?.filter { it.totalTimeInForeground > 0 }?.forEach { stat ->
                apps.put(JSObject().apply {
                    put("packageName", stat.packageName)
                    put("appLabel", getAppLabel(stat.packageName))
                    put("lastUsed", stat.lastTimeUsed)
                    put("totalTimeMs", stat.totalTimeInForeground)
                })
            }

            val result = JSObject()
            result.put("apps", apps)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to get usage stats", e)
        }
    }

    private fun checkUsageStatsPermission(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun getAppLabel(packageName: String): String {
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            packageName.split(".").lastOrNull() ?: packageName
        }
    }
}
