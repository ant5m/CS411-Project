const { supabase, hasSupabaseConfig } = require('./supabase')

/**
 * Middleware to verify Supabase JWT token and add user to request
 */
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const token = authHeader.slice(7)

  if (!hasSupabaseConfig()) {
    return res.status(400).json({ error: 'Supabase not configured' })
  }

  try {
    const { data, error } = await supabase.auth.getUser(token)
    
    if (error || !data.user) {
      console.error('❌ Auth error:', error?.message)
      return res.status(401).json({ error: 'Invalid token' })
    }

    console.log('✅ User authenticated:', { id: data.user.id, email: data.user.email })
    req.user = data.user
    next()
  } catch (err) {
    console.error('❌ Authentication exception:', err.message)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

module.exports = { authenticateUser }
