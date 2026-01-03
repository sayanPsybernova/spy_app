import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nfqdhqfykabnrbewrdrz.supabase.co'
const supabaseKey = 'sb_publishable_NiRAu1gJqhGExkGMrmx6iA_SZ4tWuwc'

export const supabase = createClient(supabaseUrl, supabaseKey)
