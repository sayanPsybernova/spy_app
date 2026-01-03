import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase'
import { broadcastToDashboards } from '../websocket/server'

const router = Router()

// POST /api/auth/login - User login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { user_id, password, device_id, device_name } = req.body

    if (!user_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, password'
      })
    }

    // Find user by user_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // Check if user is suspended
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Account is suspended. Please contact your administrator.'
      })
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)

    // Create or update device record if device_id provided
    if (device_id) {
      const { data: existingDevice } = await supabase
        .from('devices')
        .select('*')
        .eq('device_id', device_id)
        .single()

      if (existingDevice) {
        // Update existing device
        await supabase
          .from('devices')
          .update({
            user_id: user.id,
            device_name: device_name || existingDevice.device_name,
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('device_id', device_id)
      } else {
        // Create new device
        await supabase
          .from('devices')
          .insert({
            device_id,
            user_id: user.id,
            device_name: device_name || 'Unknown Device',
            is_online: true,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          })
      }

      // Broadcast to dashboards
      broadcastToDashboards({
        type: 'USER_LOGIN',
        device_id,
        data: {
          user_id: user.user_id,
          username: user.username,
          device_name,
          login_at: new Date().toISOString()
        }
      })
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user_id: user.user_id,
        username: user.username,
        profile_image_url: user.profile_image_url,
        device_id
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// POST /api/auth/request-access - Request access (for new users)
router.post('/request-access', async (req: Request, res: Response) => {
  try {
    const { username, device_name, device_identifier } = req.body

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: username'
      })
    }

    // Create access request
    const { data: request, error } = await supabase
      .from('access_requests')
      .insert({
        username,
        device_name: device_name || null,
        device_identifier: device_identifier || null,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Access request error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to submit access request'
      })
    }

    // Broadcast to dashboards
    broadcastToDashboards({
      type: 'NEW_ACCESS_REQUEST',
      data: {
        id: request.id,
        username,
        device_name,
        created_at: request.created_at
      }
    })

    res.status(201).json({
      success: true,
      message: 'Access request submitted. Please wait for approval.',
      request_id: request.id
    })
  } catch (error) {
    console.error('Access request error:', error)
    res.status(500).json({ success: false, error: 'Failed to submit access request' })
  }
})

// GET /api/auth/check-request/:id - Check access request status
router.get('/check-request/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: request, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !request) {
      return res.status(404).json({
        success: false,
        error: 'Access request not found'
      })
    }

    res.json({
      success: true,
      data: {
        id: request.id,
        status: request.status,
        username: request.username
      }
    })
  } catch (error) {
    console.error('Check request error:', error)
    res.status(500).json({ success: false, error: 'Failed to check request status' })
  }
})

export default router
