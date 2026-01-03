import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { broadcastToDashboards } from '../websocket/server'

const router = Router()

// POST /api/location - Submit location update
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      device_id,
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      bearing,
      timestamp
    } = req.body

    if (!device_id || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, latitude, longitude'
      })
    }

    // Insert location
    const { data: location, error } = await supabase
      .from('location_history')
      .insert({
        device_id,
        latitude,
        longitude,
        accuracy: accuracy || null,
        altitude: altitude || null,
        speed: speed || null,
        bearing: bearing || null,
        timestamp: timestamp || new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error recording location:', error)
      return res.status(500).json({ success: false, error: 'Failed to record location' })
    }

    // Update device last seen and location enabled
    await supabase
      .from('devices')
      .update({
        is_online: true,
        location_enabled: true,
        last_seen: new Date().toISOString()
      })
      .eq('device_id', device_id)

    // Determine movement status based on speed
    let movementStatus = 'stationary'
    if (speed !== null && speed !== undefined) {
      if (speed > 1.5 && speed <= 7) {
        movementStatus = 'walking'
      } else if (speed > 7) {
        movementStatus = 'driving'
      }
    }

    // Broadcast to dashboards
    broadcastToDashboards({
      type: 'LOCATION_UPDATE',
      device_id,
      data: {
        id: location.id,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        bearing,
        movement_status: movementStatus,
        timestamp: location.timestamp
      }
    })

    res.status(201).json({
      success: true,
      message: 'Location recorded',
      id: location.id
    })
  } catch (error) {
    console.error('Error recording location:', error)
    res.status(500).json({ success: false, error: 'Failed to record location' })
  }
})

// POST /api/location/batch - Submit multiple location updates (for offline sync)
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { device_id, locations } = req.body

    if (!device_id || !Array.isArray(locations)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, locations (array)'
      })
    }

    let insertedCount = 0

    for (const loc of locations) {
      try {
        await supabase
          .from('location_history')
          .insert({
            device_id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy || null,
            altitude: loc.altitude || null,
            speed: loc.speed || null,
            bearing: loc.bearing || null,
            timestamp: loc.timestamp || new Date().toISOString()
          })
        insertedCount++
      } catch (e) {
        console.error('Error inserting location:', e)
      }
    }

    // Update device
    await supabase
      .from('devices')
      .update({
        is_online: true,
        location_enabled: true,
        last_seen: new Date().toISOString()
      })
      .eq('device_id', device_id)

    res.status(201).json({
      success: true,
      message: `${insertedCount} locations recorded`,
      count: insertedCount
    })
  } catch (error) {
    console.error('Error recording batch locations:', error)
    res.status(500).json({ success: false, error: 'Failed to record locations' })
  }
})

export default router
