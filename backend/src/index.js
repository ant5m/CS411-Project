require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { randomUUID } = require('crypto')
const { supabase, hasSupabaseConfig, getSupabaseConfigErrors } = require('./lib/supabase')
const { authenticateUser } = require('./lib/auth')

const app = express()
const PORT = Number(process.env.PORT || 4000)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000'

const defaultAllowedOrigins = [
  CLIENT_ORIGIN,
  'https://chat.openai.com',
  'https://chatgpt.com',
  'https://www.chatgpt.com',
].filter(Boolean)

const extraOrigins = (process.env.ADDITIONAL_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...extraOrigins]))
const extensionProtocol = 'chrome-extension://'

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true)
    }

    if (allowedOrigins.includes(origin) || origin.startsWith(extensionProtocol)) {
      return callback(null, true)
    }

    console.warn('🚫 Blocked CORS origin:', origin)
    return callback(new Error('Not allowed by CORS'))
  },
}

const memoryStore = {
  events: [],
}

app.use(cors(corsOptions))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (req, res) => {
  const supabaseConfigured = hasSupabaseConfig()

  res.json({
    status: 'ok',
    backend: 'usage-tracker-api',
    supabaseConfigured,
    supabaseConfigErrors: supabaseConfigured ? [] : getSupabaseConfigErrors(),
    now: new Date().toISOString(),
  })
})

app.get('/api/supabase/status', async (req, res) => {
  if (!hasSupabaseConfig()) {
    return res.status(400).json({
      configured: false,
      errors: getSupabaseConfigErrors(),
    })
  }

  const { error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return res.status(500).json({
      configured: true,
      reachable: false,
      error: error.message,
      hint: 'Verify the events table exists and your service role key is correct.',
    })
  }

  return res.json({
    configured: true,
    reachable: true,
    table: 'public.events',
  })
})

app.post('/api/events', async (req, res) => {
  const {
    userId = 'local-dev-user',
    eventType,
    messageCharCount = 0,
    estimatedTokens = 0,
    sessionId,
    timestamp,
  } = req.body || {}

  console.log('📨 Event received:', {
    eventType,
    userId,
    messageCharCount,
    estimatedTokens,
    timestamp: new Date().toISOString(),
  });

  if (!eventType) {
    console.warn('❌ No eventType provided');
    return res.status(400).json({ error: 'eventType is required' })
  }

  const event = {
    id: randomUUID(),
    user_id: userId,
    event_type: eventType,
    message_char_count: Number(messageCharCount) || 0,
    estimated_tokens: Number(estimatedTokens) || 0,
    session_id: sessionId || randomUUID(),
    created_at: timestamp || new Date().toISOString(),
  }

  if (hasSupabaseConfig()) {
    const { error } = await supabase.from('events').insert(event)
    if (error) {
      console.error('❌ Supabase insert error:', error);
      return res.status(500).json({
        error: 'Failed to store event in Supabase',
        details: error.message,
      })
    } else {
      console.log('✅ Event saved to Supabase:', event.id);
    }
  } else {
    memoryStore.events.push(event)
    console.log('✅ Event stored in memory:', event.id);
  }

  return res.status(201).json({ ok: true, event })
})

app.get('/api/stats/daily', authenticateUser, async (req, res) => {
  const userId = req.user.id

  if (hasSupabaseConfig()) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch stats from Supabase',
        details: error.message,
      })
    }

    const summary = summarizeDaily(data || [])
    return res.json({
      source: 'supabase',
      ...summary,
    })
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const filtered = memoryStore.events.filter(
    (event) => event.user_id === userId && new Date(event.created_at).getTime() >= dayAgo,
  )

  return res.json({
    source: 'memory',
    ...summarizeDaily(filtered),
  })
})

function summarizeDaily(events) {
  const messageCount = events.filter((event) => event.event_type === 'message_sent').length
  const totalEstimatedTokens = events.reduce(
    (acc, event) => acc + (Number(event.estimated_tokens) || 0),
    0,
  )
  const activeMinutes = Math.max(1, Math.round(messageCount * 1.7))

  return {
    date: new Date().toISOString().slice(0, 10),
    messageCount,
    activeMinutes,
    totalEstimatedTokens,
    productivityInsight:
      messageCount >= 10
        ? 'High output day. You were consistently engaged with ChatGPT.'
        : 'Light usage day. Try batching prompts into focused sessions.',
  }
}

// Auth endpoints
app.post('/api/user/api-key', authenticateUser, async (req, res) => {
  const { apiKey } = req.body
  const userId = req.user.id

  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' })
  }

  if (!hasSupabaseConfig()) {
    return res.status(400).json({ error: 'Database not configured' })
  }

  try {
    const { error } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          email: req.user.email,
          openai_api_key: apiKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (error) throw error

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save API key', details: err.message })
  }
})

app.get('/api/user/api-key', authenticateUser, async (req, res) => {
  const userId = req.user.id

  if (!hasSupabaseConfig()) {
    return res.status(400).json({ error: 'Database not configured' })
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('openai_api_key')
      .eq('id', userId)
      .single()

    if (error) {
      // User doesn't have a record yet
      return res.json({ apiKey: '' })
    }

    // Return masked key for security (only show first/last few chars)
    const { openai_api_key } = data
    const maskedKey = openai_api_key
      ? `${openai_api_key.slice(0, 8)}...${openai_api_key.slice(-4)}`
      : ''

    res.json({ apiKey: maskedKey, hasKey: !!openai_api_key })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch API key', details: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})
