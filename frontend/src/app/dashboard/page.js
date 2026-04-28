'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

const initialStats = {
  date: '-',
  messageCount: 0,
  activeMinutes: 0,
  totalEstimatedTokens: 0,
  productivityInsight: 'No insight yet.',
  breakdown: [],
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState(initialStats)
  const [status, setStatus] = useState('Loading...')
  const [selectedRange, setSelectedRange] = useState('today')
  const [showBenchmark, setShowBenchmark] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('Not synced yet')
  const [userAverage, setUserAverage] = useState(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
      return
    }

    if (user) {
      console.log('🎯 Dashboard mounted, loading stats for range:', selectedRange)
      
      // Send auth token to extension
      const sendTokenToExtension = async () => {
        try {
          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token
          const userId = session.data.session?.user?.id
          
          if (token && userId) {
            window.postMessage({
              type: 'CHATGPT_TRACKER_AUTH',
              token,
              userId,
            }, '*')
            console.log('📤 Sent auth token to extension from dashboard')
          }
        } catch (err) {
          console.error('Failed to send token to extension:', err)
        }
      }
      
      sendTokenToExtension()
      
      // Load initial stats immediately
      loadStats(selectedRange)
      loadUserAverage()

      // Poll for updates every 10 seconds
      const pollInterval = setInterval(() => {
        console.log(' Polling stats for range:', selectedRange)
        loadStats(selectedRange)
      }, 10000)

      // Refresh on window focus
      const handleFocus = () => {
        console.log('👁️ Window focused, refreshing stats')
        loadStats(selectedRange)
      }

      window.addEventListener('focus', handleFocus)

      return () => {
        clearInterval(pollInterval)
        window.removeEventListener('focus', handleFocus)
      }
    }
  }, [user, authLoading, router, selectedRange])

  const loadUserAverage = async () => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      
      if (!token) {
        console.warn('⚠️ No token for user average')
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/stats/user-average`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        console.warn('⚠️ Failed to fetch user average')
        return
      }

      const data = await response.json()
      console.log('📊 User average loaded:', data)
      setUserAverage(data)
    } catch (err) {
      console.error('❌ Error loading user average:', err)
    }
  }

  const loadStats = async (range = 'today') => {
    try {
      setIsSyncing(true)
      console.log(' Loading stats for range:', range)

      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      
      if (!token) {
        console.error(' No auth token available')
        setStatus('Error: No authentication token')
        setIsSyncing(false)
        return
      }

      console.log(' Token available, fetching from:', `${API_BASE_URL}/api/stats/daily?range=${range}`)
      
      const response = await fetch(`${API_BASE_URL}/api/stats/daily?range=${range}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log(' Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(' API Error:', errorText)
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log(' Stats data received:', data)

      setStats({
        date: data.date ?? '-',
        messageCount: data.messageCount ?? 0,
        activeMinutes: data.activeMinutes ?? 0,
        totalEstimatedTokens: data.totalEstimatedTokens ?? 0,
        productivityInsight: data.productivityInsight ?? 'No insight yet.',
        breakdown: data.breakdown ?? [],
        source: data.source ?? 'Web Extension',
      })

      setStatus(`Connected (${data.source || 'Database'})`)
      setLastSync('just now')
    } catch (err) {
      console.error(' Failed to load dashboard data:', err)
      setStatus(`Error: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const hasData =
    Number(stats.messageCount) > 0 ||
    Number(stats.activeMinutes) > 0 ||
    Number(stats.totalEstimatedTokens) > 0

  const derivedStats = useMemo(() => {
    // Don't multiply - backend already returns aggregated stats for the selected range
    const messageCount = Math.round(Number(stats.messageCount) || 0)
    const activeMinutes = Math.round(Number(stats.activeMinutes) || 0)
    const totalEstimatedTokens = Math.round(Number(stats.totalEstimatedTokens) || 0)

    const estimatedCO2 = ((totalEstimatedTokens / 1000) * 0.35).toFixed(2)

    const label =
      selectedRange === 'today'
        ? '24 Hours'
        : selectedRange === 'week'
        ? '7 Days'
        : '30 Days'

    // Use actual breakdown data from backend
    const trend = buildTrendArray(totalEstimatedTokens, selectedRange, hasData, stats.breakdown)

    return {
      label,
      messageCount,
      activeMinutes,
      totalEstimatedTokens,
      estimatedCO2,
      trend,
      avgTrend: buildAverageTrend(selectedRange, userAverage),
      labels: getTrendLabels(selectedRange),
    }
  }, [stats, selectedRange, hasData, userAverage])

  const buddyState = useMemo(() => {
    const tokens = Number(derivedStats.totalEstimatedTokens || 0)

    if (!hasData || tokens === 0) {
      return {
        health: 'Unknown',
        mood: 'Neutral',
        impact: 'Limited Activity',
        badge: ' Limited Activity',
        image: '/neutral_buddy.png',
        summary:
          'Buddy does not have enough recent activity yet to show a stronger response.',
      }
    }

    if (tokens < 1500) {
      return {
        health: 'Good',
        mood: 'Happy',
        impact: 'Low Impact',
        badge: ' Low Impact',
        image: '/good_buddy.png',
        summary:
          'Buddy is doing well because your recent tracked usage is staying in a lower-impact range.',
      }
    }

    if (tokens < 6000) {
      return {
        health: 'Fair',
        mood: 'Tired',
        impact: 'Moderate Impact',
        badge: ' Moderate Impact',
        image: '/neutral_buddy.png',
        summary:
          'Buddy is starting to feel the effects of increased usage and is now in a moderate-impact state.',
      }
    }

    return {
      health: 'Low',
      mood: 'Stressed',
      impact: 'High Impact',
      badge: ' High Impact',
      image: '/poor_buddy.png',
      summary:
        'Buddy is stressed because recent tracked usage is high enough to indicate a stronger environmental impact.',
    }
  }, [derivedStats, hasData])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#eef8f2] flex items-center justify-center text-slate-700">
        Loading...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#eef8f2] px-5 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2d9b72]">
                TamagotGPT
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                Sustainability Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-500">
                Track AI usage, estimated environmental impact, and Buddy status in one place.
              </p>
              <p className="mt-4 text-sm font-medium text-emerald-700">{status}</p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="min-w-[220px] rounded-[1.35rem] border border-[#c9eadc] bg-[#dff3e9] px-5 py-4">
                <p className="text-xl font-semibold text-[#145c43]">
                  {isSyncing ? 'Syncing...' : 'System synced'}
                </p>
                <p className="mt-2 text-base text-slate-500">Last sync: {lastSync}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => loadStats(selectedRange)}
                  disabled={isSyncing}
                  className="rounded-full bg-[#0ea56a] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#0c935f] disabled:cursor-not-allowed disabled:bg-[#8ed8bc]"
                >
                  {isSyncing ? 'Syncing...' : 'Sync now'}
                </button>

                <Link
                  href="/settings"
                  className="rounded-full border border-[#d7e3ef] bg-[#f8fafc] px-5 py-3 text-base font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Usage Overview</h2>
              <p className="mt-1 text-lg text-slate-500">
                Select a time range to update the dashboard metrics.
              </p>
            </div>

            <div className="inline-flex rounded-full bg-[#d7f1e4] p-1.5">
              <RangeButton
                label="24 Hours"
                isActive={selectedRange === 'today'}
                onClick={() => setSelectedRange('today')}
              />
              <RangeButton
                label="7 Days"
                isActive={selectedRange === 'week'}
                onClick={() => setSelectedRange('week')}
              />
              <RangeButton
                label="30 Days"
                isActive={selectedRange === 'month'}
                onClick={() => setSelectedRange('month')}
              />
            </div>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              accent="bg-[#2fd37c]"
              icon=""
              label="Messages"
              value={hasData ? derivedStats.messageCount : '—'}
              sublabel="tracked prompts"
            />
            <MetricCard
              accent="bg-[#53a8ff]"
              icon=""
              label="Active Minutes"
              value={hasData ? derivedStats.activeMinutes : '—'}
              sublabel="estimated session time"
            />
            <MetricCard
              accent="bg-[#f3c14b]"
              icon=""
              label="Estimated Tokens"
              value={hasData ? derivedStats.totalEstimatedTokens : '—'}
              sublabel="usage volume"
            />
            <MetricCard
              accent="bg-[#2fd37c]"
              icon=""
              label="Estimated CO₂"
              value={hasData ? `${derivedStats.estimatedCO2} g` : '—'}
              sublabel={derivedStats.label}
            />
          </div>

          {!hasData ? (
            <div className="mt-7 rounded-[1.6rem] border border-dashed border-[#c9dad1] bg-[#f7fcf9] p-6 text-center">
              <h3 className="text-xl font-bold text-slate-900">No Data Found</h3>
              <p className="mt-2 text-lg text-slate-500">
                No recorded usage exists yet. Send an AI prompt first, then return to the dashboard.
              </p>
            </div>
          ) : (
            <div className="mt-7 rounded-[1.6rem] border border-[#d7eee2] bg-[#f7fcf9] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Impact Trend</h3>
                  <p className="text-sm text-slate-500">
                    Estimated environmental impact for the selected range.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBenchmark((prev) => !prev)}
                  className="rounded-full border border-[#d7eee2] bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-[#f2fbf6]"
                >
                  {showBenchmark ? 'Hide Your Average' : 'Show Your Average'}
                </button>
              </div>

              <div className="mt-5">
                <TrendChart
                  values={derivedStats.trend}
                  average={showBenchmark ? derivedStats.avgTrend : null}
                  labels={derivedStats.labels}
                />
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
            <h2 className="text-2xl font-bold text-slate-900">Productivity Insight</h2>
            <p className="mt-3 text-lg leading-8 text-slate-500">
              {hasData
                ? stats.productivityInsight
                : 'No insight yet. Once usage is recorded, the system will generate an insight here.'}
            </p>

            <div className="mt-6 rounded-[1.4rem] border border-[#d7eee2] bg-[#f7fcf9] p-4 text-sm text-slate-600">
              Source: {stats.source || 'unknown'} • Date: {stats.date || '-'}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
            <h2 className="text-2xl font-bold text-slate-900">Buddy Summary</h2>
            <p className="mt-2 text-lg text-slate-500">
              Current Buddy status for the {derivedStats.label} range.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
              <div className="relative h-56 overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#eef8f2] to-[#f7fcf9]">
                <Image
                  src={buddyState.image}
                  alt="Buddy visual state"
                  fill
                  className="object-contain p-5"
                  priority
                />
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <InfoPill label={`Health: ${buddyState.health}`} />
                  <InfoPill label={`Mood: ${buddyState.mood}`} />
                  <InfoPill label={buddyState.badge} />
                </div>

                <div className="rounded-[1.4rem] border border-[#d7eee2] bg-[#f7fcf9] p-4">
                  <p className="text-base leading-7 text-slate-600">{buddyState.summary}</p>
                </div>

                <Link
                  href="/buddy"
                  className="inline-flex items-center justify-center rounded-full bg-[#0ea56a] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#0c935f]"
                >
                  Open Buddy
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function buildTrendArray(baseValue, selectedRange, hasData, breakdown) {
  console.log('buildTrendArray called with:', { baseValue, selectedRange, hasData, breakdownLength: breakdown?.length, breakdown })
  // Use real breakdown data if available
  if (breakdown && breakdown.length > 0) {
    if (selectedRange === 'today' && breakdown.length === 24) {
      // Aggregate 24 hours into 6 buckets
      const bucketed = [0, 0, 0, 0, 0, 0]
      const bucketSize = Math.ceil(24 / 6)
      
      breakdown.forEach((value, index) => {
        const bucketIndex = Math.floor(index / bucketSize)
        if (bucketIndex < 6) {
          bucketed[bucketIndex] += value
        }
      })
      
      console.log('Aggregated today breakdown:', bucketed)
      return bucketed
    }
    
    // For week and month, just return the breakdown as-is
    if (breakdown.length === 7) {
      console.log('Using week breakdown:', breakdown)
      return breakdown
    }
    if (breakdown.length === 4) {
      console.log('Using month breakdown:', breakdown)
      return breakdown
    }
  }

  // Fallback to generated data if no breakdown available
  console.log('Using fallback for range:', selectedRange)
  if (!hasData) {
    const zeros = selectedRange === 'today' ? [0, 0, 0, 0, 0, 0] : selectedRange === 'week' ? [0, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0]
    return zeros
  }

  const value = Number(baseValue || 0)

  if (selectedRange === 'today') {
    return [
      Math.max(0.5, value * 0.45),
      Math.max(0.5, value * 0.8),
      Math.max(0.5, value * 0.6),
      Math.max(0.5, value * 1.0),
      Math.max(0.5, value * 0.7),
      Math.max(0.5, value * 0.9),
    ]
  }

  if (selectedRange === 'week') {
    return [
      Math.max(1, value * 0.7),
      Math.max(1, value * 1.0),
      Math.max(1, value * 0.85),
      Math.max(1, value * 1.1),
      Math.max(1, value * 0.95),
      Math.max(1, value * 0.8),
      Math.max(1, value * 1.05),
    ]
  }

  return [
    Math.max(2, value * 0.65),
    Math.max(2, value * 0.8),
    Math.max(2, value * 0.75),
    Math.max(2, value * 0.95),
  ]
}

function buildAverageTrend(selectedRange, userAverage) {
  if (!userAverage || !userAverage.avgTokensPerDay) {
    // Fallback to hardcoded defaults if no user average available
    if (selectedRange === 'today') return [2, 2, 2, 2, 2, 2]
    if (selectedRange === 'week') return [5, 5, 5, 5, 5, 5, 5]
    return [14, 14, 14, 14]
  }

  const avgTokens = Math.max(1, userAverage.avgTokensPerDay)

  if (selectedRange === 'today') {
    // Distribute daily average across 6 buckets (4 hours each)
    const perBucket = avgTokens / 6
    return [perBucket, perBucket, perBucket, perBucket, perBucket, perBucket]
  }

  if (selectedRange === 'week') {
    // One value per day for the week
    return Array(7).fill(avgTokens)
  }

  // Month: weekly average (avgTokens * 7 per week)
  const perWeek = avgTokens * 7
  return [perWeek, perWeek, perWeek, perWeek]
}

function getTrendLabels(selectedRange) {
  if (selectedRange === 'today') {
    // Labels aligned with the 6 aggregated buckets
    return ['20h ago', '16h ago', '12h ago', '8h ago', '4h ago', 'now']
  }
  if (selectedRange === 'week') return ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', '1d ago', 'now']
  return ['3w ago', '2w ago', '1w ago', 'now']
}

function RangeButton({ label, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-6 py-3 text-lg font-medium transition ${
        isActive
          ? 'bg-[#2fd37c] text-white shadow-sm'
          : 'text-slate-600 hover:bg-[#cdeedd]'
      }`}
    >
      {label}
    </button>
  )
}

function MetricCard({ accent, icon, label, value, sublabel }) {
  return (
    <div className="overflow-hidden rounded-[1.7rem] border border-[#dbece3] bg-white shadow-[0_2px_10px_rgba(35,83,61,0.04)]">
      <div className={`h-2 w-full ${accent}`} />
      <div className="p-5">
        <p className="text-[1.05rem] font-medium text-slate-500">
          {icon} {label}
        </p>
        <p className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        <p className="mt-3 text-base text-slate-400">{sublabel}</p>
      </div>
    </div>
  )
}

function InfoPill({ label }) {
  return (
    <div className="rounded-full border border-[#cfe8dc] bg-[#e6f6ee] px-4 py-2 text-base font-medium text-slate-700">
      {label}
    </div>
  )
}

function TrendChart({ values, average, labels }) {
  const maxValue = Math.max(...values, ...(average || [0]), 1);
  const width = 1000; // SVG coordinate system width
  const height = 200; // SVG coordinate system height
  const padding = 40;

  // Helper to calculate SVG coordinates
  const getCoordinates = (data) => {
    return data.map((val, i) => {
      const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - (val / maxValue) * (height - padding * 2) - padding;
      return { x, y };
    });
  };

  const points = getCoordinates(values);
  const avgPoints = average ? getCoordinates(average) : null;

  // Format points for the SVG polyline attribute
  const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const avgPointsStr = avgPoints ? avgPoints.map(p => `${p.x},${p.y}`).join(' ') : '';

  return (
    <div className="space-y-4">
      <div className="relative h-56 w-full rounded-[1.6rem] bg-white p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Average Benchmark Line (Dashed) */}
          {average && (
            <polyline
              points={avgPointsStr}
              fill="none"
              stroke="#f3c14b"
              strokeWidth="3"
              strokeDasharray="8,8"
              className="transition-all duration-500"
            />
          )}

          {/* Main Data Line */}
          <polyline
            points={pointsStr}
            fill="none"
            stroke="#2fd37c"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-500"
          />

          {/* Data Points (Dots) */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="8"
              fill="white"
              stroke="#2fd37c"
              strokeWidth="4"
            />
          ))}
        </svg>

        {/* X-Axis Labels */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-[4%]">
          {labels.map((label, i) => (
            <span key={i} className="text-xs font-medium text-slate-400">
              {label}
            </span>
          ))}
        </div>
      </div>

      {average && (
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-8 border-t-2 border-dashed border-[#f3c14b]" />
          <p className="text-xs text-slate-400">Your average</p>
        </div>
      )}
    </div>
  );
}