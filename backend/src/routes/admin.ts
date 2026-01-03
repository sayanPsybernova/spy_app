import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase'
import { broadcastToDashboards } from '../websocket/server'

const router = Router()

// Hardcoded admin credentials (as per requirements)
const ADMIN_EMAIL = 'pradhansayan2@gmail.com'
const ADMIN_PASSWORD = 'Sayan@0306'

// Simple admin auth middleware
const adminAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      success: false,
      error: 'Admin authentication required'
    })
  }

  const base64Credentials = authHeader.split(' ')[1]
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
  const [email, password] = credentials.split(':')

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(403).json({
      success: false,
      error: 'Invalid admin credentials'
    })
  }

  next()
}

// POST /api/admin/users - Create new user
router.post('/users', adminAuth, async (req: Request, res: Response) => {
  try {
    const { user_id, username, password, profile_image_url } = req.body

    if (!user_id || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, username, password'
      })
    }

    // Check if user_id already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', user_id)
      .single()

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User ID already exists'
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(password, salt)

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        user_id,
        username,
        password_hash,
        profile_image_url: profile_image_url || null,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Create user error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to create user'
      })
    }

    // Broadcast to dashboards
    broadcastToDashboards({
      type: 'USER_CREATED',
      data: {
        id: user.id,
        user_id: user.user_id,
        username: user.username,
        created_at: user.created_at
      }
    })

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        user_id: user.user_id,
        username: user.username,
        profile_image_url: user.profile_image_url,
        status: user.status,
        created_at: user.created_at
      }
    })
  } catch (error) {
    console.error('Create user error:', error)
    res.status(500).json({ success: false, error: 'Failed to create user' })
  }
})

// GET /api/admin/users - List all users
router.get('/users', adminAuth, async (req: Request, res: Response) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, user_id, username, profile_image_url, status, created_at, last_login')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch users error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch users'
      })
    }

    // Get device count for each user
    const usersWithDevices = await Promise.all(
      users.map(async (user) => {
        const { count } = await supabase
          .from('devices')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        return {
          ...user,
          device_count: count || 0
        }
      })
    )

    res.json({
      success: true,
      data: usersWithDevices,
      count: users.length
    })
  } catch (error) {
    console.error('Fetch users error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch users' })
  }
})

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { data: user, error } = await supabase
      .from('users')
      .select('id, user_id, username, profile_image_url, status, created_at, last_login')
      .eq('id', id)
      .single()

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    // Get user's devices
    const { data: devices } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', id)
      .order('last_seen', { ascending: false })

    res.json({
      success: true,
      data: {
        ...user,
        devices: devices || []
      }
    })
  } catch (error) {
    console.error('Fetch user error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch user' })
  }
})

// PATCH /api/admin/users/:id - Update user
router.patch('/users/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { username, password, profile_image_url, status } = req.body

    const updates: any = {}
    if (username) updates.username = username
    if (profile_image_url !== undefined) updates.profile_image_url = profile_image_url
    if (status) updates.status = status

    if (password) {
      const salt = await bcrypt.genSalt(10)
      updates.password_hash = await bcrypt.hash(password, salt)
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, user_id, username, profile_image_url, status, created_at, last_login')
      .single()

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ success: false, error: 'Failed to update user' })
  }
})

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Delete user (cascade will delete devices)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete user error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user'
      })
    }

    // Broadcast to dashboards
    broadcastToDashboards({
      type: 'USER_DELETED',
      data: { id }
    })

    res.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete user' })
  }
})

// GET /api/admin/access-requests - List access requests
router.get('/access-requests', adminAuth, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string || 'pending'

    const query = supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query.eq('status', status)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error('Fetch access requests error:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch access requests'
      })
    }

    res.json({
      success: true,
      data: requests,
      count: requests?.length || 0
    })
  } catch (error) {
    console.error('Fetch access requests error:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch access requests' })
  }
})

// POST /api/admin/access-requests/:id/approve - Approve access request
router.post('/access-requests/:id/approve', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { user_id, username, password } = req.body

    if (!user_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id, password'
      })
    }

    // Get the access request
    const { data: request, error: requestError } = await supabase
      .from('access_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (requestError || !request) {
      return res.status(404).json({
        success: false,
        error: 'Access request not found'
      })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Access request has already been processed'
      })
    }

    // Check if user_id already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', user_id)
      .single()

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User ID already exists'
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const password_hash = await bcrypt.hash(password, salt)

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        user_id,
        username: username || request.username,
        password_hash,
        status: 'active'
      })
      .select()
      .single()

    if (userError) {
      console.error('Create user from request error:', userError)
      return res.status(500).json({
        success: false,
        error: 'Failed to create user'
      })
    }

    // Update access request status
    await supabase
      .from('access_requests')
      .update({ status: 'approved' })
      .eq('id', id)

    // Broadcast to dashboards
    broadcastToDashboards({
      type: 'ACCESS_REQUEST_APPROVED',
      data: {
        request_id: id,
        user_id: user.user_id,
        username: user.username
      }
    })

    res.json({
      success: true,
      message: 'Access request approved and user created',
      data: {
        user: {
          id: user.id,
          user_id: user.user_id,
          username: user.username
        }
      }
    })
  } catch (error) {
    console.error('Approve access request error:', error)
    res.status(500).json({ success: false, error: 'Failed to approve access request' })
  }
})

// POST /api/admin/access-requests/:id/reject - Reject access request
router.post('/access-requests/:id/reject', adminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const { error } = await supabase
      .from('access_requests')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to reject access request'
      })
    }

    // Broadcast to dashboards
    broadcastToDashboards({
      type: 'ACCESS_REQUEST_REJECTED',
      data: { request_id: id }
    })

    res.json({
      success: true,
      message: 'Access request rejected'
    })
  } catch (error) {
    console.error('Reject access request error:', error)
    res.status(500).json({ success: false, error: 'Failed to reject access request' })
  }
})

export default router
