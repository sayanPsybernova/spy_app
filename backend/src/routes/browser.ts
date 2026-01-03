import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { broadcastToDashboards } from '../websocket/server'

const router = Router()

// POST /api/browser - Record URL visit
router.post('/', async (req: Request, res: Response) => {
  try {
    const { device_id, url, domain, browser_package, timestamp } = req.body

    if (!device_id || !url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: device_id, url'
      })
    }

    // Extract domain from URL if not provided
    let finalDomain = domain
    if (!finalDomain) {
      try {
        const urlObj = new URL(url)
        finalDomain = urlObj.hostname
      } catch {
        finalDomain = url.split('/')[2] || url
      }
    }

    // Insert browser history record
    const { data: record, error } = await supabase
      .from('browser_history')
      .insert({
        device_id,
        url,
        domain: finalDomain,
        browser_package: browser_package || null,
        timestamp: timestamp || new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error recording browser history:', error)
      return res.status(500).json({ success: false, error: 'Failed to record URL' })
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
      type: 'URL_VISITED',
      device_id,
      data: {
        id: record.id,
        url,
        domain: finalDomain,
        browser_package,
        timestamp: record.timestamp
      }
    })

    res.status(201).json({
      success: true,
      message: 'URL recorded',
      id: record.id
    })
  } catch (error) {
    console.error('Error recording browser history:', error)
    res.status(500).json({ success: false, error: 'Failed to record URL' })
  }
})

// GET /api/browser/:deviceId - Get browsing history for a device
router.get('/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0

    const { data: history, error, count } = await supabase
      .from('browser_history')
      .select('*', { count: 'exact' })
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching browser history:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch history' })
    }

    res.json({
      success: true,
      data: history,
      count: history?.length || 0,
      total: count || 0
    })
  } catch (error) {
    console.error('Error fetching browser history:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch history' })
  }
})

// GET /api/browser/:deviceId/stats - Get browsing stats
router.get('/:deviceId/stats', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params

    // Get browsing history for the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: history, error } = await supabase
      .from('browser_history')
      .select('*')
      .eq('device_id', deviceId)
      .gte('timestamp', twentyFourHoursAgo)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching browser stats:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch stats' })
    }

    // Calculate domain stats
    const domainCounts: { [domain: string]: number } = {}
    for (const record of history || []) {
      if (record.domain) {
        domainCounts[record.domain] = (domainCounts[record.domain] || 0) + 1
      }
    }

    // Sort by count
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }))

    res.json({
      success: true,
      data: {
        total_urls: history?.length || 0,
        unique_domains: Object.keys(domainCounts).length,
        top_domains: topDomains
      }
    })
  } catch (error) {
    console.error('Error fetching browser stats:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch stats' })
  }
})

// GET /api/browser/:deviceId/search - Search browser history
router.get('/:deviceId/search', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params
    const query = req.query.q as string

    if (!query) {
      return res.status(400).json({ success: false, error: 'Missing search query' })
    }

    const { data: history, error } = await supabase
      .from('browser_history')
      .select('*')
      .eq('device_id', deviceId)
      .or(`url.ilike.%${query}%,domain.ilike.%${query}%`)
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error searching browser history:', error)
      return res.status(500).json({ success: false, error: 'Failed to search history' })
    }

    res.json({
      success: true,
      data: history,
      count: history?.length || 0
    })
  } catch (error) {
    console.error('Error searching browser history:', error)
    res.status(500).json({ success: false, error: 'Failed to search history' })
  }
})

// DELETE /api/browser/:deviceId - Clear browsing history
router.delete('/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params

    const { error } = await supabase
      .from('browser_history')
      .delete()
      .eq('device_id', deviceId)

    if (error) {
      console.error('Error clearing browser history:', error)
      return res.status(500).json({ success: false, error: 'Failed to clear history' })
    }

    res.json({
      success: true,
      message: 'Browser history cleared'
    })
  } catch (error) {
    console.error('Error clearing browser history:', error)
    res.status(500).json({ success: false, error: 'Failed to clear history' })
  }
})

export default router
