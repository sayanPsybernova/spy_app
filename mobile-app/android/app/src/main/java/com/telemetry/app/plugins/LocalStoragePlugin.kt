package com.telemetry.app.plugins

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "LocalStorage")
class LocalStoragePlugin : Plugin() {

    private lateinit var dbHelper: TelemetryDatabaseHelper

    override fun load() {
        dbHelper = TelemetryDatabaseHelper(context)
    }

    @PluginMethod
    fun saveEvent(call: PluginCall) {
        val eventType = call.getString("eventType") ?: return call.reject("eventType required")
        val payload = call.getString("payload") ?: return call.reject("payload required")

        try {
            val db = dbHelper.writableDatabase
            val values = ContentValues().apply {
                put("event_type", eventType)
                put("payload", payload)
                put("timestamp", System.currentTimeMillis())
                put("synced", 0)
            }
            val id = db.insert("pending_events", null, values)

            val result = JSObject()
            result.put("id", id)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to save event", e)
        }
    }

    @PluginMethod
    fun getPendingEvents(call: PluginCall) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.query(
                "pending_events",
                null,
                "synced = ?",
                arrayOf("0"),
                null,
                null,
                "timestamp ASC",
                "1000"
            )

            val events = JSArray()
            while (cursor.moveToNext()) {
                val event = JSObject().apply {
                    put("id", cursor.getLong(cursor.getColumnIndexOrThrow("id")))
                    put("eventType", cursor.getString(cursor.getColumnIndexOrThrow("event_type")))
                    put("payload", cursor.getString(cursor.getColumnIndexOrThrow("payload")))
                    put("timestamp", cursor.getLong(cursor.getColumnIndexOrThrow("timestamp")))
                    put("synced", cursor.getInt(cursor.getColumnIndexOrThrow("synced")) == 1)
                }
                events.put(event)
            }
            cursor.close()

            val result = JSObject()
            result.put("events", events)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to get pending events", e)
        }
    }

    @PluginMethod
    fun markEventsSynced(call: PluginCall) {
        val ids = call.getArray("ids") ?: return call.reject("ids required")

        try {
            val db = dbHelper.writableDatabase
            val idsString = (0 until ids.length()).map { ids.getLong(it) }.joinToString(",")

            db.execSQL("UPDATE pending_events SET synced = 1 WHERE id IN ($idsString)")

            // Also delete old synced events (keep last 100)
            db.execSQL("""
                DELETE FROM pending_events
                WHERE synced = 1 AND id NOT IN (
                    SELECT id FROM pending_events WHERE synced = 1 ORDER BY timestamp DESC LIMIT 100
                )
            """)

            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to mark events synced", e)
        }
    }

    @PluginMethod
    fun clearAllEvents(call: PluginCall) {
        try {
            val db = dbHelper.writableDatabase
            db.delete("pending_events", null, null)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to clear events", e)
        }
    }

    @PluginMethod
    fun getEventCount(call: PluginCall) {
        try {
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery("SELECT COUNT(*) FROM pending_events WHERE synced = 0", null)
            var count = 0
            if (cursor.moveToFirst()) {
                count = cursor.getInt(0)
            }
            cursor.close()

            val result = JSObject()
            result.put("count", count)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to get event count", e)
        }
    }

    private class TelemetryDatabaseHelper(context: Context) : SQLiteOpenHelper(
        context,
        "telemetry_buffer.db",
        null,
        1
    ) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE pending_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    synced INTEGER DEFAULT 0
                )
            """)
            db.execSQL("CREATE INDEX idx_pending_synced ON pending_events(synced)")
            db.execSQL("CREATE INDEX idx_pending_timestamp ON pending_events(timestamp)")
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            db.execSQL("DROP TABLE IF EXISTS pending_events")
            onCreate(db)
        }
    }
}
