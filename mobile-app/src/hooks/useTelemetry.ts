import { useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  UsageStats,
  LocationTracker,
  ForegroundService,
  LocalStorage,
  Beep,
  LocationData
} from '../plugins/definitions'

interface TelemetryOptions {
  deviceId: string
  wsUrl: string
  serverUrl: string
  isTracking: boolean
  locationEnabled: boolean
  onLocationUpdate?: (location: LocationData) => void
  onAppUpdate?: (app: { packageName: string; appLabel: string }) => void
}

export function useTelemetry(options: TelemetryOptions) {
  const {
    deviceId,
    wsUrl: _wsUrl,
    serverUrl,
    isTracking,
    locationEnabled,
    onLocationUpdate,
    onAppUpdate
  } = options
  void _wsUrl // Silence unused variable warning

  const wsRef = useRef<WebSocket | null>(null)
  const locationListenerRef = useRef<{ remove: () => void } | null>(null)
  const appPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check if we're running on native
  const isNative = Capacitor.isNativePlatform()

  // Start foreground service with configuration
  const startService = useCallback(async () => {
    if (!isNative) return

    try {
      // Pass configuration to native service so it can work independently
      await ForegroundService.startService({
        title: 'Location Sharing Active',
        body: locationEnabled ? 'Sharing your location' : 'App tracking enabled',
        deviceId: deviceId,
        serverUrl: serverUrl,
        wsUrl: serverUrl.replace('http://', 'ws://').replace(':3000', ':8080'),
        locationEnabled: locationEnabled
      })
    } catch (error) {
      console.error('Failed to start foreground service:', error)
    }
  }, [isNative, deviceId, serverUrl, locationEnabled])

  // Stop foreground service
  const stopService = useCallback(async () => {
    if (!isNative) return

    try {
      await ForegroundService.stopService()
    } catch (error) {
      console.error('Failed to stop foreground service:', error)
    }
  }, [isNative])

  // Start location tracking
  const startLocationTracking = useCallback(async () => {
    if (!isNative) return

    try {
      const { granted } = await LocationTracker.hasPermission()
      if (!granted) {
        const result = await LocationTracker.requestPermission()
        if (!result.granted) {
          console.warn('Location permission not granted')
          return
        }
      }

      // Remove existing listener
      if (locationListenerRef.current) {
        locationListenerRef.current.remove()
      }

      // Add location update listener
      locationListenerRef.current = await LocationTracker.addListener(
        'locationUpdate',
        (location) => {
          onLocationUpdate?.(location)

          // Send to server via WebSocket or API
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'LOCATION_UPDATE',
              device_id: deviceId,
              payload: {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                altitude: location.altitude,
                speed: location.speed,
                heading: location.bearing,
                timestamp: new Date().toISOString()
              }
            }))
          } else {
            // Save to local storage for later sync
            LocalStorage.saveEvent({
              eventType: 'LOCATION_UPDATE',
              payload: JSON.stringify({
                ...location,
                timestamp: new Date().toISOString()
              })
            })
          }
        }
      )

      // Start tracking with 3 second interval
      await LocationTracker.startTracking({ intervalMs: 3000 })
    } catch (error) {
      console.error('Failed to start location tracking:', error)
    }
  }, [isNative, deviceId, onLocationUpdate])

  // Stop location tracking
  const stopLocationTracking = useCallback(async () => {
    if (!isNative) return

    try {
      if (locationListenerRef.current) {
        locationListenerRef.current.remove()
        locationListenerRef.current = null
      }
      await LocationTracker.stopTracking()
    } catch (error) {
      console.error('Failed to stop location tracking:', error)
    }
  }, [isNative])

  // Start app usage polling
  const startAppPolling = useCallback(async () => {
    if (!isNative) return

    try {
      const { granted } = await UsageStats.hasPermission()
      if (!granted) {
        await UsageStats.requestPermission()
        return
      }

      // Poll current app every 5 seconds
      appPollingRef.current = setInterval(async () => {
        try {
          const app = await UsageStats.getCurrentApp()
          if (app && app.packageName) {
            onAppUpdate?.(app)

            // Send to server
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'TELEMETRY_EVENT',
                device_id: deviceId,
                payload: {
                  event_type: 'APP_FOREGROUND',
                  app_package: app.packageName,
                  app_label: app.appLabel,
                  duration_ms: 5000
                }
              }))
            } else {
              // Save to local storage
              LocalStorage.saveEvent({
                eventType: 'APP_FOREGROUND',
                payload: JSON.stringify({
                  app_package: app.packageName,
                  app_label: app.appLabel,
                  timestamp: new Date().toISOString()
                })
              })
            }
          }
        } catch (error) {
          console.error('Error polling app:', error)
        }
      }, 5000)
    } catch (error) {
      console.error('Failed to start app polling:', error)
    }
  }, [isNative, deviceId, onAppUpdate])

  // Stop app polling
  const stopAppPolling = useCallback(() => {
    if (appPollingRef.current) {
      clearInterval(appPollingRef.current)
      appPollingRef.current = null
    }
  }, [])

  // Sync pending events
  const syncPendingEvents = useCallback(async () => {
    if (!isNative) return

    try {
      const { events } = await LocalStorage.getPendingEvents()
      if (events.length === 0) return

      // Try to sync via API
      const response = await fetch(`${serverUrl}/api/telemetry/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          events: events.map(e => ({
            event_type: e.eventType,
            ...JSON.parse(e.payload)
          }))
        })
      })

      if (response.ok) {
        // Mark events as synced
        await LocalStorage.markEventsSynced({
          ids: events.map(e => e.id)
        })
      }
    } catch (error) {
      console.error('Failed to sync events:', error)
    }
  }, [isNative, deviceId, serverUrl])

  // Trigger beep
  const triggerBeep = useCallback(async (duration = 5000) => {
    if (!isNative) {
      // Web fallback
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = context.createOscillator()
        const gain = context.createGain()

        oscillator.connect(gain)
        gain.connect(context.destination)

        oscillator.frequency.value = 880
        oscillator.type = 'sine'
        gain.gain.value = 0.5

        oscillator.start()
        setTimeout(() => {
          oscillator.stop()
          context.close()
        }, duration)
      } catch (e) {
        console.error('Audio not available:', e)
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500])
      }
      return
    }

    try {
      await Beep.playBeep({ duration })
    } catch (error) {
      console.error('Failed to play beep:', error)
    }
  }, [isNative])

  // Stop beep
  const stopBeep = useCallback(async () => {
    if (!isNative) return

    try {
      await Beep.stopBeep()
    } catch (error) {
      console.error('Failed to stop beep:', error)
    }
  }, [isNative])

  // Handle tracking state changes
  useEffect(() => {
    if (isTracking) {
      startService()
      startAppPolling()

      // Set up sync interval
      syncIntervalRef.current = setInterval(syncPendingEvents, 60000)
    } else {
      stopService()
      stopAppPolling()

      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }

    return () => {
      stopService()
      stopAppPolling()
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [isTracking, startService, stopService, startAppPolling, stopAppPolling, syncPendingEvents])

  // Handle location state changes
  useEffect(() => {
    if (locationEnabled && isTracking) {
      startLocationTracking()
    } else {
      stopLocationTracking()
    }

    return () => {
      stopLocationTracking()
    }
  }, [locationEnabled, isTracking, startLocationTracking, stopLocationTracking])

  return {
    triggerBeep,
    stopBeep,
    syncPendingEvents,
    isNative
  }
}
