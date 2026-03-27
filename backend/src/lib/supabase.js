const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

function getSupabaseConfigErrors() {
  const errors = []

  if (!supabaseUrl) {
    errors.push('SUPABASE_URL is missing')
  }
  if (!supabaseServerKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is missing')
  }

  return errors
}

let supabase = null

if (getSupabaseConfigErrors().length === 0) {
  supabase = createClient(supabaseUrl, supabaseServerKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function hasSupabaseConfig() {
  return Boolean(supabase)
}

module.exports = {
  supabase,
  hasSupabaseConfig,
  getSupabaseConfigErrors,
}
