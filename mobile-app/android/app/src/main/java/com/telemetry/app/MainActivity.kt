package com.telemetry.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.telemetry.app.plugins.AccessibilityPlugin
import com.telemetry.app.plugins.BeepPlugin
import com.telemetry.app.plugins.ForegroundServicePlugin
import com.telemetry.app.plugins.LocalStoragePlugin
import com.telemetry.app.plugins.LocationTrackerPlugin
import com.telemetry.app.plugins.UsageStatsPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Register custom plugins before super.onCreate()
        registerPlugin(UsageStatsPlugin::class.java)
        registerPlugin(LocationTrackerPlugin::class.java)
        registerPlugin(BeepPlugin::class.java)
        registerPlugin(ForegroundServicePlugin::class.java)
        registerPlugin(LocalStoragePlugin::class.java)
        registerPlugin(AccessibilityPlugin::class.java)

        super.onCreate(savedInstanceState)
    }
}
