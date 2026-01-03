import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { broadcastToDashboards, sendToDevice } from '../websocket/server'

const router = Router()

// GET /api/devices - List all devices
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data: devices, error } = await supabase
      .from('devices')
      .select(`
        *,
        user:users(user_id, username, profile_image_url)
      `)
      .order('last_seen', { ascending: false })

    if (error) {
      console.error('Error fetching devices:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch devices' })
    }

    res.json({
      success: true,
      data: devices,
      count: devices?.length || 0
    })
  } catch (error) {
    console.error('Error fetching devices:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch devices' })
  }
})

// POST /api/devices - Register new device (legacy - now requires login)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { device_id, username, device_name } = req.body

    if (!device_id || !username || !device_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, username, device_name'
      })
    }

    // Check if device already exists
    const { data: existing } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', device_id)
      .single()

    if (existing) {
      // Update existing device
      await supabase
        .from('devices')
        .update({
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq('device_id', device_id)

      const { data: updatedDevice } = await supabase
        .from('devices')
        .select(`*, user:users(user_id, username, profile_image_url)`)
        .eq('device_id', device_id)
        .single()

      return res.json({
        success: true,
        message: 'Device reconnected',
        data: updatedDevice
      })
    }

    // For new devices without authentication, create as orphan (no user linked)
    // This maintains backward compatibility but device won't track until user logs in
    const { data: newDevice, error } = await supabase
      .from('devices')
      .insert({
        device_id,
        device_name,
        is_online: true,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error registering device:', error)
      return res.status(500).json({ success: false, error: 'Failed to register device' })
    }

    // Broadcast new device to all dashboards
    broadcastToDashboards({
      type: 'NEW_DEVICE_REGISTERED',
      device_id,
      data: {
        device_name,
        registered_at: new Date().toISOString()
      }
    })

    res.status(201).json({
      success: true,
      message: 'Device registered. User login required for tracking.',
      data: newDevice
    })
  } catch (error) {
    console.error('Error registering device:', error)
    res.status(500).json({ success: false, error: 'Failed to register device' })
  }
})

// GET /api/devices/:id - Get device details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select(`*, user:users(user_id, username, profile_image_url)`)
      .eq('device_id', req.params.id)
      .single()

    if (error || !device) {
      return res.status(404).json({ success: false, error: 'Device not found' })
    }

    // Get latest location
    const { data: latestLocation } = await supabase
      .from('location_history')
      .select('*')
      .eq('device_id', req.params.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    // Get recent telemetry
    const { data: recentTelemetry } = await supabase
      .from('telemetry_events')
      .select('*')
      .eq('device_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(20)

    res.json({
      success: true,
      data: {
        ...device,
        latest_location: latestLocation || null,
        recent_activity: recentTelemetry || []
      }
    })
  } catch (error) {
    console.error('Error fetching device:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch device' })
  }
})

// GET /api/devices/:id/telemetry - Get device telemetry history
router.get('/:id/telemetry', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100

    const { data: telemetry, error } = await supabase
      .from('telemetry_events')
      .select('*')
      .eq('device_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching telemetry:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch telemetry' })
    }

    res.json({
      success: true,
      data: telemetry,
      count: telemetry?.length || 0
    })
  } catch (error) {
    console.error('Error fetching telemetry:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch telemetry' })
  }
})

// POST /api/devices/:id/beep - Trigger beep command
router.post('/:id/beep', async (req: Request, res: Response) => {
  try {
    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', req.params.id)
      .single()

    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' })
    }

    // Send beep command to device via WebSocket
    const sent = sendToDevice(req.params.id, {
      type: 'BEEP_DEVICE',
      device_id: req.params.id,
      message: req.body.message || 'Find my device'
    })

    if (sent) {
      res.json({ success: true, message: 'Beep command sent' })
    } else {
      res.status(503).json({
        success: false,
        error: 'Device is not connected'
      })
    }
  } catch (error) {
    console.error('Error sending beep:', error)
    res.status(500).json({ success: false, error: 'Failed to send beep command' })
  }
})

// GET /api/devices/:id/location - Get latest location
router.get('/:id/location', async (req: Request, res: Response) => {
  try {
    const { data: location, error } = await supabase
      .from('location_history')
      .select('*')
      .eq('device_id', req.params.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (error || !location) {
      return res.status(404).json({
        success: false,
        error: 'No location data available'
      })
    }

    res.json({
      success: true,
      data: location
    })
  } catch (error) {
    console.error('Error fetching location:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch location' })
  }
})

// GET /api/devices/:id/location/history - Get location history
router.get('/:id/location/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100

    const { data: history, error } = await supabase
      .from('location_history')
      .select('*')
      .eq('device_id', req.params.id)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching location history:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch location history' })
    }

    res.json({
      success: true,
      data: history,
      count: history?.length || 0
    })
  } catch (error) {
    console.error('Error fetching location history:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch location history' })
  }
})

// GET /api/devices/:id/location/trail - Get location trail (last 30 min)
router.get('/:id/location/trail', async (req: Request, res: Response) => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { data: trail, error } = await supabase
      .from('location_history')
      .select('*')
      .eq('device_id', req.params.id)
      .gte('timestamp', thirtyMinutesAgo)
      .order('timestamp', { ascending: true })

    if (error) {
      console.error('Error fetching location trail:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch location trail' })
    }

    res.json({
      success: true,
      data: trail,
      count: trail?.length || 0
    })
  } catch (error) {
    console.error('Error fetching location trail:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch location trail' })
  }
})

// POST /api/devices/:id/request-location - Request location to be turned on
router.post('/:id/request-location', async (req: Request, res: Response) => {
  try {
    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', req.params.id)
      .single()

    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' })
    }

    const sent = sendToDevice(req.params.id, {
      type: 'REQUEST_LOCATION_ON',
      device_id: req.params.id,
      message: req.body.message || 'Admin requests location access'
    })

    if (sent) {
      res.json({ success: true, message: 'Location request sent' })
    } else {
      res.status(503).json({
        success: false,
        error: 'Device is not connected'
      })
    }
  } catch (error) {
    console.error('Error requesting location:', error)
    res.status(500).json({ success: false, error: 'Failed to request location' })
  }
})

// DELETE /api/devices/:id - Delete device and all its data
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', req.params.id)
      .single()

    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' })
    }

    // Delete device (cascade will delete telemetry and location history)
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('device_id', req.params.id)

    if (error) {
      console.error('Error deleting device:', error)
      return res.status(500).json({ success: false, error: 'Failed to delete device' })
    }

    res.json({ success: true, message: 'Device deleted' })
  } catch (error) {
    console.error('Error deleting device:', error)
    res.status(500).json({ success: false, error: 'Failed to delete device' })
  }
})

export default router
