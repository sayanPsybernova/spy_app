package com.telemetry.app.plugins

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Beep")
class BeepPlugin : Plugin() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())
    private var stopRunnable: Runnable? = null

    override fun load() {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    @PluginMethod
    fun playBeep(call: PluginCall) {
        val duration = call.getInt("duration", 5000) ?: 5000
        val volume = call.getFloat("volume", 1.0f) ?: 1.0f

        try {
            // Stop any existing playback
            stopPlayback()

            // Set volume to maximum
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0)

            // Get alarm sound URI
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            // Create and configure media player
            mediaPlayer = MediaPlayer().apply {
                setDataSource(context, alarmUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                setVolume(volume, volume)
                prepare()
                start()
            }

            // Start vibration
            startVibration()

            // Schedule stop after duration
            stopRunnable = Runnable {
                stopPlayback()
            }
            handler.postDelayed(stopRunnable!!, duration.toLong())

            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to play beep", e)
        }
    }

    @PluginMethod
    fun stopBeep(call: PluginCall) {
        stopPlayback()
        call.resolve()
    }

    @PluginMethod
    fun vibrate(call: PluginCall) {
        try {
            val pattern = call.getArray("pattern")?.let { array ->
                LongArray(array.length()) { i ->
                    array.getLong(i)
                }
            } ?: longArrayOf(0, 500, 200, 500, 200, 500)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(
                    VibrationEffect.createWaveform(pattern, -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, -1)
            }

            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to vibrate", e)
        }
    }

    private fun startVibration() {
        val pattern = longArrayOf(0, 500, 200, 500, 200, 500)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(
                VibrationEffect.createWaveform(pattern, 0) // 0 = repeat from start
            )
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    private fun stopPlayback() {
        // Cancel scheduled stop
        stopRunnable?.let { handler.removeCallbacks(it) }
        stopRunnable = null

        // Stop media player
        mediaPlayer?.let {
            try {
                if (it.isPlaying) {
                    it.stop()
                }
                it.release()
            } catch (e: Exception) {
                // Ignore
            }
        }
        mediaPlayer = null

        // Stop vibration
        vibrator?.cancel()
    }

    override fun handleOnDestroy() {
        stopPlayback()
        super.handleOnDestroy()
    }
}
