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

    // Allow localhost on any port for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
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

// Post events from the extension
app.post('/api/events', async (req, res) => {
  let userId = req.body?.userId || 'anonymous';
  const {
    eventType,
    messageCharCount = 0,
    estimatedTokens = 0,
    sessionId,
    timestamp,
  } = req.body || {}

  // Check for JWT in Authorization header (from authenticated extension)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      // Verify JWT using Supabase
      const { data: user, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.warn('⚠️ JWT validation failed:', error.message);
        // Continue with userId from request body
      } else if (user?.user?.id) {
        userId = user.user.id;
        console.log('✅ JWT validated, authenticated user:', userId);
      }
    } catch (e) {
      console.warn('⚠️ JWT parsing error:', e.message);
      // Continue with userId from request body
    }
  }

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

// Helper to get time range in milliseconds
function getTimeRangeMs(range) {
  switch (range) {
    case 'week':
      return 7 * 24 * 60 * 60 * 1000
    case 'month':
      return 30 * 24 * 60 * 60 * 1000
    case 'today':
    default:
      return 24 * 60 * 60 * 1000
  }
}

// Helper to get hourly breakdown for 24-hour period
function getHourlyBreakdown(events) {
  const hourlyData = Array(24).fill(0)
  const now = new Date()
  
  events.forEach(event => {
    const eventTime = new Date(event.created_at)
    const hoursDiff = Math.floor((now - eventTime) / (1000 * 60 * 60))
    
    // Count backwards: 0 = current hour, 23 = 23 hours ago
    if (hoursDiff >= 0 && hoursDiff < 24) {
      hourlyData[hoursDiff] += Number(event.estimated_tokens) || 0
    }
  })
  
  // Reverse so index 0 is oldest, index 23 is newest
  return hourlyData.reverse()
}

// Helper to get daily breakdown for 7-day period
function getDailyBreakdown(events) {
  const dailyData = Array(7).fill(0)
  const now = new Date()
  
  events.forEach(event => {
    const eventTime = new Date(event.created_at)
    const daysDiff = Math.floor((now - eventTime) / (1000 * 60 * 60 * 24))
    
    // Count backwards: 0 = today, 6 = 6 days ago
    if (daysDiff >= 0 && daysDiff < 7) {
      dailyData[daysDiff] += Number(event.estimated_tokens) || 0
    }
  })
  
  // Reverse so index 0 is oldest, index 6 is today
  return dailyData.reverse()
}

// Helper to get weekly breakdown for 30-day period
function getWeeklyBreakdown(events) {
  const weeklyData = Array(4).fill(0) // 4 buckets for 28 days (4 weeks)
  const now = new Date()
  
  events.forEach(event => {
    const eventTime = new Date(event.created_at)
    const daysDiff = Math.floor((now - eventTime) / (1000 * 60 * 60 * 24))
    
    // Week 0 = days 0-6, Week 1 = days 7-13, Week 2 = days 14-20, Week 3 = days 21-27
    const weekIndex = Math.floor(daysDiff / 7)
    if (weekIndex >= 0 && weekIndex < 4) {
      weeklyData[weekIndex] += Number(event.estimated_tokens) || 0
    }
  })
  
  // Reverse so index 0 is oldest (Week 3) and index 3 is newest (Week 0)
  return weeklyData.reverse()
}

// Helper to summarize stats
function summarizeStats(events, range = 'today') {
  const messageCount = events.filter((event) => event.event_type === 'message_sent').length
  const totalEstimatedTokens = events.reduce(
    (acc, event) => acc + (Number(event.estimated_tokens) || 0),
    0,
  )
  const activeMinutes = messageCount > 0 ? Math.round(messageCount * 1.7) : 0

  const rangeLabel =
    range === 'week' ? '7 Days' : range === 'month' ? '30 Days' : '24 Hours'

  let productivityInsight = ''
  if (messageCount === 0) {
    productivityInsight = `No activity yet ${rangeLabel.toLowerCase()}. Start chatting with ChatGPT to see your usage!`
  } else if (messageCount >= 10) {
    productivityInsight = `High output ${rangeLabel.toLowerCase()}. You were consistently engaged with ChatGPT.`
  } else {
    productivityInsight = `Light usage ${rangeLabel.toLowerCase()}. Try batching prompts into focused sessions.`
  }

  console.log('📝 Generating insight for messageCount:', messageCount, '→', productivityInsight)

  // Get breakdown based on range
  let breakdown = []
  if (range === 'today') {
    breakdown = getHourlyBreakdown(events)
  } else if (range === 'week') {
    breakdown = getDailyBreakdown(events)
  } else if (range === 'month') {
    breakdown = getWeeklyBreakdown(events)
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    range,
    rangeLabel,
    messageCount,
    activeMinutes,
    totalEstimatedTokens,
    productivityInsight,
    breakdown,
  }
}

// Debug endpoint to see all events (no auth required - for debugging only)
app.get('/api/debug/all-events', async (req, res) => {
  console.log('🔍 DEBUG: Fetching ALL events from database (no filter)')

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Group by user_id to see distribution
    const byUser = {}
    data.forEach(event => {
      if (!byUser[event.user_id]) byUser[event.user_id] = []
      byUser[event.user_id].push(event)
    })

    console.log('📊 DEBUG: Total events:', data?.length || 0)
    console.log('👥 DEBUG: Events by user:')
    Object.entries(byUser).forEach(([userId, events]) => {
      console.log(`  ${userId}: ${events.length} events`)
    })

    return res.json({
      totalEvents: data?.length || 0,
      uniqueUsers: Object.keys(byUser).length,
      byUser: Object.fromEntries(
        Object.entries(byUser).map(([userId, events]) => [
          userId,
          { count: events.length, latestEvent: events[0] }
        ])
      ),
      allEvents: data || [],
    })
  } catch (err) {
    console.error('❌ DEBUG error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// Debug endpoint to see all events for a user
app.get('/api/debug/events', authenticateUser, async (req, res) => {
  const userId = req.user.id

  console.log('🔍 DEBUG: Fetching ALL events for user:', userId)

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    console.log('📊 DEBUG: Total events found:', data?.length || 0)
    if (data && data.length > 0) {
      console.log('📋 DEBUG: Events:', data)
    }

    return res.json({
      userId,
      totalEvents: data?.length || 0,
      events: data || [],
    })
  } catch (err) {
    console.error('❌ DEBUG error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

app.get('/api/stats/daily', authenticateUser, async (req, res) => {
  const userId = req.user.id
  const range = req.query.range || 'today'

  console.log('📊 Stats request from user:', { userId, userEmail: req.user.email, range })

  try {
    if (!hasSupabaseConfig()) {
      console.warn('⚠️ Supabase not configured, returning empty stats')
      return res.json(summarizeStats([], range))
    }

    // Calculate time range
    const timeRangeMs = getTimeRangeMs(range)
    const cutoffTime = new Date(Date.now() - timeRangeMs).toISOString()

    console.log('🔍 Query parameters:', { userId, range, cutoffTime, timeRangeMs })

    // Fetch events from the specified time range
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoffTime)

    console.log('📡 Query result for user', userId, ':', { eventCount: data?.length || 0, error: error?.message })

    if (error) {
      console.error('❌ Error fetching stats:', error.message)
      return res.status(500).json({
        error: 'Failed to fetch stats',
        details: error.message,
      })
    }

    console.log('✅ Events found:', data?.length || 0)
    if (data && data.length > 0) {
      console.log('📋 Sample events:', data.slice(0, 3))
    }

    const summary = summarizeStats(data || [], range)
    console.log('📊 Summary for user', userId, ':', summary)
    return res.json(summary)
  } catch (err) {
    console.error('❌ Error in /api/stats/daily:', err)
    return res.status(500).json({
      error: 'Failed to fetch stats',
      details: err.message,
    })
  }
})

// Get user's personal average for their own benchmark
app.get('/api/stats/user-average', authenticateUser, async (req, res) => {
  const userId = req.user.id
  const daysBack = Number(req.query.daysBack) || 30 // Default: last 30 days

  console.log('📊 User average request:', { userId, daysBack })

  try {
    if (!hasSupabaseConfig()) {
      return res.json({
        avgTokensPerDay: 1000,
        avgMessagesPerDay: 8,
        totalDays: 0,
        source: 'defaults',
      })
    }

    // Fetch user's events over the specified period
    const cutoffTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: userEvents, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoffTime)

    if (error) {
      console.warn('⚠️ Error fetching user events:', error.message)
      return res.json({
        avgTokensPerDay: 1000,
        avgMessagesPerDay: 8,
        totalDays: 0,
        source: 'defaults',
      })
    }

    if (!userEvents || userEvents.length === 0) {
      return res.json({
        avgTokensPerDay: 1000,
        avgMessagesPerDay: 8,
        totalDays: 0,
        source: 'no-data',
      })
    }

    // Group events by day
    const dayStats = {}
    userEvents.forEach(event => {
      const day = event.created_at.split('T')[0] // YYYY-MM-DD
      if (!dayStats[day]) {
        dayStats[day] = { messageCount: 0, totalTokens: 0 }
      }
      if (event.event_type === 'message_sent') {
        dayStats[day].messageCount += 1
      }
      dayStats[day].totalTokens += Number(event.estimated_tokens) || 0
    })

    const activeDays = Object.keys(dayStats).length
    let totalMessages = 0
    let totalTokens = 0

    Object.values(dayStats).forEach(stat => {
      totalMessages += stat.messageCount
      totalTokens += stat.totalTokens
    })

    const avgMessagesPerDay = activeDays > 0 ? Math.round(totalMessages / activeDays) : 0
    const avgTokensPerDay = activeDays > 0 ? Math.round(totalTokens / activeDays) : 0

    console.log('📊 User average calculated:', { userId, activeDays, avgMessagesPerDay, avgTokensPerDay })

    return res.json({
      avgTokensPerDay,
      avgMessagesPerDay,
      activeDays,
      totalDays: daysBack,
      source: 'calculated',
    })
  } catch (err) {
    console.error('❌ Error in /api/stats/user-average:', err)
    return res.json({
      avgTokensPerDay: 1000,
      avgMessagesPerDay: 8,
      totalDays: 0,
      source: 'error',
    })
  }
})

// Get average stats across all users for benchmarking
app.get('/api/stats/averages', authenticateUser, async (req, res) => {
  try {
    if (!hasSupabaseConfig()) {
      return res.json({
        avgMessages: 12,
        avgMinutes: 18,
        avgTokens: 2500,
        source: 'defaults',
      })
    }

    // Fetch all events from all users
    const { data: allEvents, error } = await supabase
      .from('events')
      .select('*')

    if (error) {
      console.warn('⚠️ Error fetching events for averages:', error.message)
      return res.json({
        avgMessages: 12,
        avgMinutes: 18,
        avgTokens: 2500,
        source: 'defaults',
      })
    }

    if (!allEvents || allEvents.length === 0) {
      return res.json({
        avgMessages: 12,
        avgMinutes: 18,
        avgTokens: 2500,
        source: 'defaults',
      })
    }

    // Group by user to calculate per-user stats first
    const userStats = {}
    allEvents.forEach(event => {
      if (!userStats[event.user_id]) {
        userStats[event.user_id] = {
          messageCount: 0,
          totalTokens: 0,
        }
      }
      if (event.event_type === 'message_sent') {
        userStats[event.user_id].messageCount += 1
      }
      userStats[event.user_id].totalTokens += Number(event.estimated_tokens) || 0
    })

    // Calculate averages
    const userCount = Object.keys(userStats).length
    let totalMessages = 0
    let totalTokens = 0

    Object.values(userStats).forEach(stat => {
      totalMessages += stat.messageCount
      totalTokens += stat.totalTokens
    })

    const avgMessages = userCount > 0 ? Math.round(totalMessages / userCount) : 12
    const avgTokens = userCount > 0 ? Math.round(totalTokens / userCount) : 2500
    const avgMinutes = avgMessages > 0 ? Math.round(avgMessages * 1.5) : 18

    console.log('📊 Calculated averages:', { avgMessages, avgMinutes, avgTokens, userCount })

    return res.json({
      avgMessages,
      avgMinutes,
      avgTokens,
      userCount,
      totalEvents: allEvents.length,
      source: 'calculated',
    })
  } catch (err) {
    console.error('❌ Error in /api/stats/averages:', err)
    return res.json({
      avgMessages: 12,
      avgMinutes: 18,
      avgTokens: 2500,
      source: 'defaults',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})