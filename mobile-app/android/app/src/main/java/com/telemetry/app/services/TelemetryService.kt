package com.telemetry.app.services

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import com.telemetry.app.MainActivity
import com.telemetry.app.R
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors

class TelemetryService : Service() {

    companion object {
        const val TAG = "TelemetryService"
        const val CHANNEL_ID = "telemetry_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.telemetry.app.START_SERVICE"
        const val ACTION_STOP = "com.telemetry.app.STOP_SERVICE"
        const val ACTION_UPDATE = "com.telemetry.app.UPDATE_NOTIFICATION"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"

        const val PREFS_NAME = "telemetry_prefs"
        const val KEY_TRACKING_ENABLED = "tracking_enabled"
        const val KEY_LOCATION_ENABLED = "location_enabled"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_WS_URL = "ws_url"

        const val LOCATION_INTERVAL_MS = 3000L
        const val APP_POLL_INTERVAL_MS = 5000L
        const val SYNC_INTERVAL_MS = 60000L
    }

    private var notificationManager: NotificationManager? = null
    private var currentTitle = "Telemetry Active"
    private var currentBody = "Location sharing is enabled"

    // Location tracking
    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var isLocationTracking = false

    // App usage tracking
    private var usageStatsManager: UsageStatsManager? = null
    private var lastAppPackage: String? = null
    private var lastAppTimestamp: Long = 0

    // Background handlers
    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()

    // Database
    private var dbHelper: TelemetryDatabaseHelper? = null

    // WebSocket
    private var webSocket: java.net.Socket? = null
    private var wsConnected = false

    // Wake lock
    private var wakeLock: PowerManager.WakeLock? = null

    // Configuration
    private var deviceId: String = ""
    private var serverUrl: String = ""
    private var wsUrl: String = ""

    private val appPollingRunnable = object : Runnable {
        override fun run() {
            pollCurrentApp()
            handler.postDelayed(this, APP_POLL_INTERVAL_MS)
        }
    }

    private val syncRunnable = object : Runnable {
        override fun run() {
            syncPendingEvents()
            handler.postDelayed(this, SYNC_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service onCreate")

        notificationManager = getSystemService(NotificationManager::class.java)
        createNotificationChannel()

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        dbHelper = TelemetryDatabaseHelper(this)

        // Acquire wake lock to keep service running
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "TelemetryService::WakeLock"
        )
        wakeLock?.acquire(24 * 60 * 60 * 1000L) // 24 hours max

        // Load configuration
        loadConfig()
    }

    private fun loadConfig() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        deviceId = prefs.getString(KEY_DEVICE_ID, "") ?: ""
        serverUrl = prefs.getString(KEY_SERVER_URL, "") ?: ""
        wsUrl = prefs.getString(KEY_WS_URL, "") ?: ""
        Log.d(TAG, "Config loaded - deviceId: $deviceId, serverUrl: $serverUrl")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand action: ${intent?.action}")

        // Reload config in case it changed
        loadConfig()

        when (intent?.action) {
            ACTION_START -> {
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: currentTitle
                currentBody = intent.getStringExtra(EXTRA_BODY) ?: currentBody
                startForeground(NOTIFICATION_ID, buildNotification())

                // Save tracking state
                saveTrackingState(true)

                // Start tracking
                startLocationTracking()
                startAppPolling()
                startSyncInterval()

                // Connect WebSocket
                connectWebSocket()
            }
            ACTION_STOP -> {
                stopLocationTracking()
                stopAppPolling()
                stopSyncInterval()
                disconnectWebSocket()
                saveTrackingState(false)

                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_UPDATE -> {
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: currentTitle
                currentBody = intent.getStringExtra(EXTRA_BODY) ?: currentBody
                notificationManager?.notify(NOTIFICATION_ID, buildNotification())
            }
            null -> {
                // Service restarted by system - resume tracking
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val wasTracking = prefs.getBoolean(KEY_TRACKING_ENABLED, false)
                val locationEnabled = prefs.getBoolean(KEY_LOCATION_ENABLED, true)

                if (wasTracking) {
                    Log.d(TAG, "Resuming tracking after restart")
                    startForeground(NOTIFICATION_ID, buildNotification())

                    if (locationEnabled) {
                        startLocationTracking()
                    }
                    startAppPolling()
                    startSyncInterval()
                    connectWebSocket()
                }
            }
        }

        return START_STICKY
    }

    private fun saveTrackingState(enabled: Boolean) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_TRACKING_ENABLED, enabled)
            .apply()
    }

    // ==================== Location Tracking ====================

    private fun startLocationTracking() {
        if (isLocationTracking) return

        if (ActivityCompat.checkSelfPermission(
                this,
                android.Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Location permission not granted")
            return
        }

        Log.d(TAG, "Starting location tracking")

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_INTERVAL_MS
        ).apply {
            setMinUpdateIntervalMillis(LOCATION_INTERVAL_MS / 2)
            setWaitForAccurateLocation(false)
            setMaxUpdateDelayMillis(LOCATION_INTERVAL_MS)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    handleLocationUpdate(
                        latitude = location.latitude,
                        longitude = location.longitude,
                        accuracy = location.accuracy.toDouble(),
                        altitude = if (location.hasAltitude()) location.altitude else null,
                        speed = if (location.hasSpeed()) location.speed.toDouble() else null,
                        bearing = if (location.hasBearing()) location.bearing.toDouble() else null
                    )
                }
            }
        }

        fusedLocationClient?.requestLocationUpdates(
            locationRequest,
            locationCallback!!,
            Looper.getMainLooper()
        )

        isLocationTracking = true

        // Update notification
        currentBody = "Location sharing every 3 seconds"
        notificationManager?.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun stopLocationTracking() {
        if (!isLocationTracking) return

        Log.d(TAG, "Stopping location tracking")
        locationCallback?.let {
            fusedLocationClient?.removeLocationUpdates(it)
        }
        locationCallback = null
        isLocationTracking = false
    }

    private fun handleLocationUpdate(
        latitude: Double,
        longitude: Double,
        accuracy: Double,
        altitude: Double?,
        speed: Double?,
        bearing: Double?
    ) {
        val timestamp = getIsoTimestamp()

        val payload = JSONObject().apply {
            put("latitude", latitude)
            put("longitude", longitude)
            put("accuracy", accuracy)
            altitude?.let { put("altitude", it) }
            speed?.let { put("speed", it) }
            bearing?.let { put("heading", it) }
            put("timestamp", timestamp)
        }

        // Try to send via WebSocket
        if (wsConnected && deviceId.isNotEmpty()) {
            val message = JSONObject().apply {
                put("type", "LOCATION_UPDATE")
                put("device_id", deviceId)
                put("payload", payload)
            }
            sendWebSocketMessage(message.toString())
        } else {
            // Save to local database
            saveEventToDb("LOCATION_UPDATE", payload.toString())
        }
    }

    // ==================== App Usage Tracking ====================

    private fun startAppPolling() {
        Log.d(TAG, "Starting app polling")
        handler.post(appPollingRunnable)
    }

    private fun stopAppPolling() {
        Log.d(TAG, "Stopping app polling")
        handler.removeCallbacks(appPollingRunnable)
    }

    private fun pollCurrentApp() {
        try {
            val endTime = System.currentTimeMillis()
            val startTime = endTime - 60000

            val events = usageStatsManager?.queryEvents(startTime, endTime) ?: return
            var lastApp: String? = null
            var lastLabel: String? = null
            var lastTimestamp: Long = 0

            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                    event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                    if (event.timeStamp > lastTimestamp) {
                        lastTimestamp = event.timeStamp
                        lastApp = event.packageName
                        lastLabel = getAppLabel(event.packageName)
                    }
                }
            }

            if (lastApp != null && lastApp != lastAppPackage) {
                // App changed - send telemetry
                val durationMs = if (lastAppTimestamp > 0) {
                    System.currentTimeMillis() - lastAppTimestamp
                } else {
                    APP_POLL_INTERVAL_MS
                }

                handleAppForeground(lastApp, lastLabel ?: lastApp, durationMs)

                lastAppPackage = lastApp
                lastAppTimestamp = System.currentTimeMillis()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error polling app usage", e)
        }
    }

    private fun handleAppForeground(packageName: String, appLabel: String, durationMs: Long) {
        val timestamp = getIsoTimestamp()

        val payload = JSONObject().apply {
            put("event_type", "APP_FOREGROUND")
            put("app_package", packageName)
            put("app_label", appLabel)
            put("duration_ms", durationMs)
            put("timestamp", timestamp)
        }

        // Try to send via WebSocket
        if (wsConnected && deviceId.isNotEmpty()) {
            val message = JSONObject().apply {
                put("type", "TELEMETRY_EVENT")
                put("device_id", deviceId)
                put("payload", payload)
            }
            sendWebSocketMessage(message.toString())
        } else {
            // Save to local database
            saveEventToDb("APP_FOREGROUND", payload.toString())
        }
    }

    private fun getAppLabel(packageName: String): String {
        return try {
            val pm = packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            packageName.split(".").lastOrNull() ?: packageName
        }
    }

    // ==================== Database Operations ====================

    private fun saveEventToDb(eventType: String, payload: String) {
        executor.execute {
            try {
                val db = dbHelper?.writableDatabase ?: return@execute
                val values = ContentValues().apply {
                    put("event_type", eventType)
                    put("payload", payload)
                    put("timestamp", System.currentTimeMillis())
                    put("synced", 0)
                }
                db.insert("pending_events", null, values)
            } catch (e: Exception) {
                Log.e(TAG, "Error saving event to db", e)
            }
        }
    }

    // ==================== Sync Operations ====================

    private fun startSyncInterval() {
        Log.d(TAG, "Starting sync interval")
        handler.postDelayed(syncRunnable, SYNC_INTERVAL_MS)
    }

    private fun stopSyncInterval() {
        Log.d(TAG, "Stopping sync interval")
        handler.removeCallbacks(syncRunnable)
    }

    private fun syncPendingEvents() {
        if (serverUrl.isEmpty() || deviceId.isEmpty()) return

        executor.execute {
            try {
                val db = dbHelper?.readableDatabase ?: return@execute
                val cursor = db.query(
                    "pending_events",
                    null,
                    "synced = ?",
                    arrayOf("0"),
                    null,
                    null,
                    "timestamp ASC",
                    "100"
                )

                val events = mutableListOf<Pair<Long, JSONObject>>()
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(cursor.getColumnIndexOrThrow("id"))
                    val eventType = cursor.getString(cursor.getColumnIndexOrThrow("event_type"))
                    val payload = cursor.getString(cursor.getColumnIndexOrThrow("payload"))

                    val eventObj = JSONObject().apply {
                        put("event_type", eventType)
                        val payloadObj = JSONObject(payload)
                        for (key in payloadObj.keys()) {
                            put(key, payloadObj.get(key))
                        }
                    }
                    events.add(Pair(id, eventObj))
                }
                cursor.close()

                if (events.isEmpty()) return@execute

                // Send to server
                val url = URL("$serverUrl/api/telemetry/batch")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                val requestBody = JSONObject().apply {
                    put("device_id", deviceId)
                    put("events", events.map { it.second }.let { list ->
                        org.json.JSONArray().apply {
                            list.forEach { put(it) }
                        }
                    })
                }

                OutputStreamWriter(conn.outputStream).use { writer ->
                    writer.write(requestBody.toString())
                }

                if (conn.responseCode == 200 || conn.responseCode == 201) {
                    // Mark as synced
                    val writeDb = dbHelper?.writableDatabase ?: return@execute
                    val ids = events.map { it.first }.joinToString(",")
                    writeDb.execSQL("UPDATE pending_events SET synced = 1 WHERE id IN ($ids)")

                    // Clean old synced events
                    writeDb.execSQL("""
                        DELETE FROM pending_events
                        WHERE synced = 1 AND id NOT IN (
                            SELECT id FROM pending_events WHERE synced = 1 ORDER BY timestamp DESC LIMIT 100
                        )
                    """)

                    Log.d(TAG, "Synced ${events.size} events")
                }

                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing events", e)
            }
        }
    }

    // ==================== WebSocket ====================

    private fun connectWebSocket() {
        if (wsUrl.isEmpty() || deviceId.isEmpty()) {
            Log.w(TAG, "Cannot connect WebSocket - missing config")
            return
        }

        executor.execute {
            try {
                // Parse WebSocket URL
                val wsUrlParsed = wsUrl.replace("ws://", "").replace("wss://", "")
                val parts = wsUrlParsed.split(":")
                val host = parts[0]
                val port = if (parts.size > 1) parts[1].toIntOrNull() ?: 8080 else 8080

                Log.d(TAG, "Connecting WebSocket to $host:$port")

                webSocket = java.net.Socket(host, port)
                webSocket?.let { socket ->
                    val writer = OutputStreamWriter(socket.getOutputStream())
                    val reader = BufferedReader(InputStreamReader(socket.getInputStream()))

                    // Send HTTP upgrade request
                    writer.write("GET / HTTP/1.1\r\n")
                    writer.write("Host: $host:$port\r\n")
                    writer.write("Upgrade: websocket\r\n")
                    writer.write("Connection: Upgrade\r\n")
                    writer.write("Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n")
                    writer.write("Sec-WebSocket-Version: 13\r\n")
                    writer.write("\r\n")
                    writer.flush()

                    // Read response
                    val response = reader.readLine()
                    if (response?.contains("101") == true) {
                        wsConnected = true
                        Log.d(TAG, "WebSocket connected")

                        // Send registration
                        val registerMsg = JSONObject().apply {
                            put("type", "REGISTER")
                            put("device_id", deviceId)
                            put("client_type", "device")
                        }
                        sendWebSocketMessage(registerMsg.toString())
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "WebSocket connection failed", e)
                wsConnected = false

                // Retry after 30 seconds
                handler.postDelayed({ connectWebSocket() }, 30000)
            }
        }
    }

    private fun sendWebSocketMessage(message: String) {
        executor.execute {
            try {
                webSocket?.let { socket ->
                    if (socket.isConnected) {
                        val data = message.toByteArray()
                        val frame = ByteArray(2 + data.size)
                        frame[0] = 0x81.toByte() // Text frame
                        frame[1] = data.size.toByte()
                        System.arraycopy(data, 0, frame, 2, data.size)
                        socket.getOutputStream().write(frame)
                        socket.getOutputStream().flush()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending WebSocket message", e)
                wsConnected = false
            }
        }
    }

    private fun disconnectWebSocket() {
        try {
            webSocket?.close()
            webSocket = null
            wsConnected = false
        } catch (e: Exception) {
            Log.e(TAG, "Error closing WebSocket", e)
        }
    }

    // ==================== Utilities ====================

    private fun getIsoTimestamp(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Sharing",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when location sharing is active"
                setShowBadge(false)
            }
            notificationManager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentBody)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        Log.d(TAG, "onTaskRemoved - app was swiped away")

        // Restart service
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val wasTracking = prefs.getBoolean(KEY_TRACKING_ENABLED, false)

        if (wasTracking) {
            val restartIntent = Intent(this, TelemetryService::class.java).apply {
                action = ACTION_START
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent)
            } else {
                startService(restartIntent)
            }
        }

        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        Log.d(TAG, "Service onDestroy")

        stopLocationTracking()
        stopAppPolling()
        stopSyncInterval()
        disconnectWebSocket()

        wakeLock?.let {
            if (it.isHeld) it.release()
        }

        // Restart if was tracking
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val wasTracking = prefs.getBoolean(KEY_TRACKING_ENABLED, false)

        if (wasTracking) {
            val restartIntent = Intent(this, TelemetryService::class.java).apply {
                action = ACTION_START
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent)
            } else {
                startService(restartIntent)
            }
        }

        super.onDestroy()
    }

    // ==================== Database Helper ====================

    private class TelemetryDatabaseHelper(context: Context) : SQLiteOpenHelper(
        context,
        "telemetry_buffer.db",
        null,
        1
    ) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS pending_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    synced INTEGER DEFAULT 0
                )
            """)
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_events(synced)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_pending_timestamp ON pending_events(timestamp)")
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            db.execSQL("DROP TABLE IF EXISTS pending_events")
            onCreate(db)
        }
    }
}
