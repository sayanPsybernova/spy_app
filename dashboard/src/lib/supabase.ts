import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nfqdhqfykabnrbewrdrz.supabase.co'
const supabaseKey = 'sb_publishable_NiRAu1gJqhGExkGMrmx6iA_SZ4tWuwc'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Admin credentials for API calls
export const ADMIN_EMAIL = 'pradhansayan2@gmail.com'
export const ADMIN_PASSWORD = 'Sayan@0306'

// Helper to create Basic Auth header
export function getAdminAuthHeader(): string {
  return 'Basic ' + btoa(`${ADMIN_EMAIL}:${ADMIN_PASSWORD}`)
}

// API base URL
export const API_BASE_URL = 'http://localhost:3000'
