import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { broadcastToDashboards } from '../websocket/server'
import { inferIntent } from '../services/intent'

const router = Router()

// POST /api/telemetry - Submit telemetry event
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      device_id,
      event_type,
      app_package,
      app_label,
      start_time,
      end_time,
      duration_ms,
      screen_state,
      network_type
    } = req.body

    if (!device_id || !event_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, event_type'
      })
    }

    // Insert telemetry event
    const { data: event, error } = await supabase
      .from('telemetry_events')
      .insert({
        device_id,
        event_type,
        app_package: app_package || null,
        app_label: app_label || null,
        duration_ms: duration_ms || null,
        screen_state: screen_state || null,
        network_type: network_type || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error recording telemetry:', error)
      return res.status(500).json({ success: false, error: 'Failed to record telemetry' })
    }

    // Update device last seen
    await supabase
      .from('devices')
      .update({
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('device_id', device_id)

    // Broadcast to dashboards
    broadcastToDashboards({
      type: 'TELEMETRY_EVENT',
      device_id,
      data: {
        id: event.id,
        event_type,
        app_package,
        app_label,
        duration_ms,
        screen_state,
        network_type,
        timestamp: event.created_at
      }
    })

    // Try to infer intent if we have app info
    if (app_package && app_label && duration_ms) {
      const intent = inferIntent(app_package, app_label, duration_ms)
      if (intent) {
        // Broadcast intent update
        broadcastToDashboards({
          type: 'INTENT_UPDATE',
          device_id,
          data: intent
        })
      }
    }

    res.status(201).json({
      success: true,
      message: 'Telemetry event recorded',
      id: event.id
    })
  } catch (error) {
    console.error('Error recording telemetry:', error)
    res.status(500).json({ success: false, error: 'Failed to record telemetry' })
  }
})

// POST /api/telemetry/batch - Submit multiple telemetry events (for offline sync)
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { device_id, events } = req.body

    if (!device_id || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, events (array)'
      })
    }

    let insertedCount = 0

    for (const event of events) {
      try {
        await supabase
          .from('telemetry_events')
          .insert({
            device_id,
            event_type: event.event_type,
            app_package: event.app_package || null,
            app_label: event.app_label || null,
            duration_ms: event.duration_ms || null,
            screen_state: event.screen_state || null,
            network_type: event.network_type || null
          })
        insertedCount++
      } catch (e) {
        console.error('Error inserting event:', e)
      }
    }

    // Update device last seen
    await supabase
      .from('devices')
      .update({
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('device_id', device_id)

    // Broadcast batch update to dashboards
    broadcastToDashboards({
      type: 'TELEMETRY_BATCH',
      device_id,
      data: {
        count: insertedCount,
        timestamp: new Date().toISOString()
      }
    })

    res.status(201).json({
      success: true,
      message: `${insertedCount} telemetry events recorded`,
      count: insertedCount
    })
  } catch (error) {
    console.error('Error recording batch telemetry:', error)
    res.status(500).json({ success: false, error: 'Failed to record telemetry batch' })
  }
})

// GET /api/telemetry/stats/:deviceId - Get telemetry stats
router.get('/stats/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params

    // Get telemetry from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: telemetry, error } = await supabase
      .from('telemetry_events')
      .select('*')
      .eq('device_id', deviceId)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Error fetching telemetry stats:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch stats' })
    }

    // Calculate stats
    const appUsage: { [key: string]: number } = {}
    let totalDuration = 0
    let appSwitches = 0

    for (const event of telemetry || []) {
      if (event.app_label && event.duration_ms) {
        appUsage[event.app_label] = (appUsage[event.app_label] || 0) + event.duration_ms
        totalDuration += event.duration_ms
      }
      if (event.event_type === 'APP_FOREGROUND') {
        appSwitches++
      }
    }

    // Sort by usage
    const sortedApps = Object.entries(appUsage)
      .sort((a, b) => b[1] - a[1])
      .map(([app, duration]) => ({ app, duration }))

    res.json({
      success: true,
      data: {
        total_duration_ms: totalDuration,
        app_switches: appSwitches,
        top_apps: sortedApps.slice(0, 10),
        event_count: telemetry?.length || 0
      }
    })
  } catch (error) {
    console.error('Error fetching telemetry stats:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch stats' })
  }
})

export default router
