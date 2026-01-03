import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nfqdhqfykabnrbewrdrz.supabase.co'
const supabaseKey = 'sb_publishable_NiRAu1gJqhGExkGMrmx6iA_SZ4tWuwc'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types for database tables
export interface User {
  id: string
  user_id: string
  username: string
  password_hash: string
  profile_image_url: string | null
  status: 'active' | 'suspended'
  created_at: string
  last_login: string | null
}

export interface AccessRequest {
  id: string
  username: string
  device_name: string | null
  device_identifier: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface Device {
  id: string
  device_id: string
  user_id: string | null
  device_name: string | null
  is_online: boolean
  location_enabled: boolean
  first_seen: string
  last_seen: string
}

export interface TelemetryEvent {
  id: string
  device_id: string
  event_type: string
  app_package: string | null
  app_label: string | null
  duration_ms: number | null
  screen_state: string | null
  network_type: string | null
  created_at: string
}

export interface LocationHistory {
  id: string
  device_id: string
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  speed: number | null
  bearing: number | null
  timestamp: string
}
