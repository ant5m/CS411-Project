require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { randomUUID } = require('crypto')
const { supabase, hasSupabaseConfig } = require('./lib/supabase')

const app = express()
const PORT = Number(process.env.PORT || 4000)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000'

const memoryStore = {
  events: [],
}

app.use(
  cors({
    origin: CLIENT_ORIGIN,
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    backend: 'usage-tracker-api',
    supabaseConfigured: hasSupabaseConfig(),
    now: new Date().toISOString(),
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

  if (!eventType) {
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
      return res.status(500).json({ error: 'Failed to store event in Supabase' })
    }
  } else {
    memoryStore.events.push(event)
  }

  return res.status(201).json({ ok: true, event })
})

app.get('/api/stats/daily', async (req, res) => {
  const userId = req.query.userId || 'local-dev-user'

  if (hasSupabaseConfig()) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch stats from Supabase' })
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

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})
