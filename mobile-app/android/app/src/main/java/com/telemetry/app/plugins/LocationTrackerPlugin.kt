package com.telemetry.app.plugins

import android.Manifest
import android.content.pm.PackageManager
import android.os.Looper
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.getcapacitor.PermissionState
import com.google.android.gms.location.*

@CapacitorPlugin(
    name = "LocationTracker",
    permissions = [
        Permission(
            alias = "location",
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ]
        ),
        Permission(
            alias = "backgroundLocation",
            strings = [Manifest.permission.ACCESS_BACKGROUND_LOCATION]
        )
    ]
)
class LocationTrackerPlugin : Plugin() {

    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var isTracking = false

    override fun load() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(activity)
    }

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        val fineLocation = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseLocation = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val result = JSObject()
        result.put("granted", fineLocation || coarseLocation)
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermissionCallback")
        } else {
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
        }
    }

    @PermissionCallback
    private fun locationPermissionCallback(call: PluginCall) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
        } else {
            call.reject("Location permission denied")
        }
    }

    @PluginMethod
    fun startTracking(call: PluginCall) {
        val intervalMs = call.getLong("intervalMs", 3000L) ?: 3000L

        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            call.reject("Location permission not granted")
            return
        }

        try {
            val locationRequest = LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY,
                intervalMs
            ).apply {
                setMinUpdateIntervalMillis(intervalMs / 2)
                setWaitForAccurateLocation(false)
                setMaxUpdateDelayMillis(intervalMs)
            }.build()

            locationCallback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    result.lastLocation?.let { location ->
                        val data = JSObject().apply {
                            put("latitude", location.latitude)
                            put("longitude", location.longitude)
                            put("accuracy", location.accuracy.toDouble())
                            put("altitude", if (location.hasAltitude()) location.altitude else null)
                            put("speed", if (location.hasSpeed()) location.speed.toDouble() else null)
                            put("bearing", if (location.hasBearing()) location.bearing.toDouble() else null)
                            put("timestamp", location.time)
                        }
                        notifyListeners("locationUpdate", data)
                    }
                }
            }

            fusedLocationClient?.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                Looper.getMainLooper()
            )

            isTracking = true
            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to start location tracking", e)
        }
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        try {
            locationCallback?.let {
                fusedLocationClient?.removeLocationUpdates(it)
            }
            isTracking = false
            locationCallback = null

            val result = JSObject()
            result.put("success", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to stop location tracking", e)
        }
    }

    @PluginMethod
    fun getCurrentLocation(call: PluginCall) {
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            call.reject("Location permission not granted")
            return
        }

        try {
            fusedLocationClient?.lastLocation?.addOnSuccessListener { location ->
                if (location != null) {
                    val result = JSObject().apply {
                        put("latitude", location.latitude)
                        put("longitude", location.longitude)
                        put("accuracy", location.accuracy.toDouble())
                        put("altitude", if (location.hasAltitude()) location.altitude else null)
                        put("speed", if (location.hasSpeed()) location.speed.toDouble() else null)
                        put("bearing", if (location.hasBearing()) location.bearing.toDouble() else null)
                        put("timestamp", location.time)
                    }
                    call.resolve(result)
                } else {
                    // Request a fresh location
                    val request = CurrentLocationRequest.Builder()
                        .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                        .setMaxUpdateAgeMillis(0)
                        .build()

                    fusedLocationClient?.getCurrentLocation(request, null)
                        ?.addOnSuccessListener { freshLocation ->
                            if (freshLocation != null) {
                                val result = JSObject().apply {
                                    put("latitude", freshLocation.latitude)
                                    put("longitude", freshLocation.longitude)
                                    put("accuracy", freshLocation.accuracy.toDouble())
                                    put("altitude", if (freshLocation.hasAltitude()) freshLocation.altitude else null)
                                    put("speed", if (freshLocation.hasSpeed()) freshLocation.speed.toDouble() else null)
                                    put("bearing", if (freshLocation.hasBearing()) freshLocation.bearing.toDouble() else null)
                                    put("timestamp", freshLocation.time)
                                }
                                call.resolve(result)
                            } else {
                                call.reject("Location not available")
                            }
                        }
                        ?.addOnFailureListener { e ->
                            call.reject("Failed to get location", e)
                        }
                }
            }?.addOnFailureListener { e ->
                call.reject("Failed to get location", e)
            }
        } catch (e: Exception) {
            call.reject("Failed to get current location", e)
        }
    }

    override fun handleOnDestroy() {
        locationCallback?.let {
            fusedLocationClient?.removeLocationUpdates(it)
        }
        super.handleOnDestroy()
    }
}
