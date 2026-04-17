'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
const STORAGE_KEY = 'tamagotgpt_buddy_ui_state'

const initialStats = {
  date: '-',
  messageCount: 0,
  activeMinutes: 0,
  totalEstimatedTokens: 0,
  productivityInsight: 'No insight yet.',
  source: 'unknown',
}

export default function BuddyPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [stats, setStats] = useState(initialStats)
  const [status, setStatus] = useState('Loading...')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastSync, setLastSync] = useState('Not synced yet')

  const [activeModal, setActiveModal] = useState(null)
  const [simulateAssetFailure, setSimulateAssetFailure] = useState(false)
  const [assetError, setAssetError] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
      return
    }

    if (user) {
      const savedUiState = localStorage.getItem(STORAGE_KEY)

      if (savedUiState) {
        try {
          const parsed = JSON.parse(savedUiState)
          const shouldSimulateFailure = Boolean(parsed.simulateAssetFailure)
          setSimulateAssetFailure(shouldSimulateFailure)
          setAssetError(shouldSimulateFailure)
        } catch (err) {
          console.error('Failed to parse Buddy UI state:', err)
        }
      }

      loadBuddyData()
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        simulateAssetFailure,
      })
    )

    setAssetError(simulateAssetFailure)
  }, [simulateAssetFailure, user])

  const loadBuddyData = async () => {
    try {
      setIsRefreshing(true)

      const session = await supabase.auth.getSession()
      const response = await fetch(`${API_BASE_URL}/api/stats/daily`, {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      setStats({
        date: data.date ?? '-',
        messageCount: data.messageCount ?? 0,
        activeMinutes: data.activeMinutes ?? 0,
        totalEstimatedTokens: data.totalEstimatedTokens ?? 0,
        productivityInsight: data.productivityInsight ?? 'No insight yet.',
        source: data.source ?? 'unknown',
      })

      setStatus(`Connected (${data.source || 'unknown'})`)
      setLastSync('just now')
    } catch (err) {
      console.error('Failed to load Buddy data:', err)
      setStatus(`Error: ${err.message}`)
    } finally {
      setIsRefreshing(false)
    }
  }

  const buddyState = useMemo(() => {
    const tokens = Number(stats.totalEstimatedTokens || 0)
    const messages = Number(stats.messageCount || 0)
    const minutes = Number(stats.activeMinutes || 0)
  
    // Simple benchmark values for comparison
    const avgMessages = 12
    const avgMinutes = 18
    const avgTokens = 2500
  
    const compareToAverage = (value, average) => {
      if (value === 0) return 'no meaningful activity yet'
      const ratio = value / average
      if (ratio < 0.85) return 'below average'
      if (ratio <= 1.15) return 'about average'
      return 'above average'
    }
  
    const messageComparison = compareToAverage(messages, avgMessages)
    const minuteComparison = compareToAverage(minutes, avgMinutes)
    const tokenComparison = compareToAverage(tokens, avgTokens)
  
    const benchmarkSentence =
      tokens === 0 && messages === 0 && minutes === 0
        ? 'No tracked usage has been recorded yet, so Buddy is waiting for more activity before showing a stronger reaction.'
        : `Right now, your tracked prompt count is ${messageComparison}, your active time is ${minuteComparison}, and your token usage is ${tokenComparison} compared with a typical user session.`
  
    if (tokens === 0 && messages === 0 && minutes === 0) {
      return {
        health: 'Unknown',
        mood: 'Neutral',
        impact: 'Limited Activity',
        badge: '🌱 Limited Activity',
        image: '/neutral_buddy.png',
        accent: 'from-slate-100 to-slate-50',
        explanation: `${benchmarkSentence} Buddy reflects environmental impact using AI usage metadata such as token volume, which serves as a proxy for computational effort.`,
        tips: [
          'Send a few tracked prompts to initialize Buddy with real usage data.',
          'Refresh this page after interacting with ChatGPT to update Buddy’s state.',
          'Use the dashboard to compare your usage pattern against the average-user benchmark.',
        ],
      }
    }
  
    if (tokens < 1500) {
      return {
        health: 'Good',
        mood: 'Happy',
        impact: 'Low Impact',
        badge: '🌱 Low Impact',
        image: '/good_buddy.png',
        accent: 'from-emerald-100 to-green-50',
        explanation: `${benchmarkSentence} Your current token usage is efficient enough to keep Buddy in a healthy state. Lower token volume usually means less computation and lower estimated environmental impact.`,
        tips: [
          `Your current token usage (${tokens}) is ${tokenComparison}, so keep writing clear prompts to avoid unnecessary retries.`,
          'Batch related questions into one stronger prompt instead of sending many small ones.',
          'You are in a good range right now—maintaining focused sessions will help keep Buddy healthy.',
        ],
      }
    }
  
    if (tokens < 6000) {
      return {
        health: 'Fair',
        mood: 'Tired',
        impact: 'Moderate Impact',
        badge: '🍃 Moderate Impact',
        image: '/neutral_buddy.png',
        accent: 'from-yellow-100 to-lime-50',
        explanation: `${benchmarkSentence} Your recent usage is moderately heavy, which increases the computational work required to process your requests. Buddy is still stable, but this level of activity is starting to wear it down.`,
        tips: [
          `Your token usage (${tokens}) is ${tokenComparison}; try combining follow-up prompts instead of sending multiple separate ones.`,
          `Your active time (${minutes} min) is ${minuteComparison}; shortening long sessions can reduce impact spikes.`,
          'Refine previous prompts instead of restarting the conversation with large repeated inputs.',
        ],
      }
    }
  
    return {
      health: 'Low',
      mood: 'Stressed',
      impact: 'High Impact',
      badge: '🌍 High Impact',
      image: '/poor_buddy.png',
      accent: 'from-rose-100 to-orange-50',
      explanation: `${benchmarkSentence} Your current usage is high-impact. Large token volumes and sustained interaction increase estimated energy use, so Buddy is showing a stressed state to reflect that higher environmental footprint.`,
      tips: [
        `Your token usage (${tokens}) is ${tokenComparison}; reducing repeated large prompts would help immediately.`,
        `Your prompt count (${messages}) is ${messageComparison}; try consolidating related tasks into fewer requests.`,
        'Use the dashboard trend view to identify your heaviest usage periods and reduce those spikes over time.',
      ],
    }
  }, [stats])
  
  const handleImageError = () => {
    setAssetError(true)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#eef8f2] flex items-center justify-center text-slate-700">
        Loading...
      </div>
    )
  }

  return (
    <>
      <main className="min-h-screen bg-[#eef8f2] px-5 py-8 text-slate-800 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2d9b72]">
                  TamagotGPT
                </p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
                  Buddy Status
                </h1>
                <p className="mt-3 max-w-2xl text-lg text-slate-500">
                  View Buddy’s current state and see how recent AI usage has affected its
                  health and mood.
                </p>
                <p className="mt-4 text-sm font-medium text-emerald-700">{status}</p>
              </div>

              <div className="flex flex-col gap-3 lg:items-end">
                <div className="min-w-[220px] rounded-[1.35rem] border border-[#c9eadc] bg-[#dff3e9] px-5 py-4">
                  <p className="text-xl font-semibold text-[#145c43]">
                    {isRefreshing ? 'Refreshing...' : 'Buddy loaded'}
                  </p>
                  <p className="mt-2 text-base text-slate-500">Last sync: {lastSync}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={loadBuddyData}
                    disabled={isRefreshing}
                    className="rounded-full bg-[#0ea56a] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#0c935f] disabled:cursor-not-allowed disabled:bg-[#8ed8bc]"
                  >
                    {isRefreshing ? 'Refreshing...' : 'Refresh Buddy State'}
                  </button>

                  <Link
                    href="/dashboard"
                    className="rounded-full border border-[#d7e3ef] bg-[#f8fafc] px-5 py-3 text-base font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Dashboard
                  </Link>

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

          <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Current Buddy State</h2>
                    <p className="mt-2 text-lg text-slate-500">
                      Buddy reflects the environmental impact of your most recent tracked AI usage.
                    </p>
                  </div>

                  <div
                    className={`rounded-full bg-gradient-to-r ${buddyState.accent} px-4 py-2 text-sm font-semibold text-slate-700`}
                  >
                    {buddyState.badge}
                  </div>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-3">
                  <MetricCard
                    accent="bg-[#2fd37c]"
                    icon="💚"
                    label="Health"
                    value={buddyState.health}
                    sublabel="current condition"
                  />
                  <MetricCard
                    accent="bg-[#53a8ff]"
                    icon="🙂"
                    label="Mood"
                    value={buddyState.mood}
                    sublabel="emotional state"
                  />
                  <MetricCard
                    accent="bg-[#f3c14b]"
                    icon="🌍"
                    label="Impact"
                    value={buddyState.impact}
                    sublabel="impact level"
                    compact
                  />
                </div>

                <div className="mt-7 rounded-[1.7rem] border border-[#d7eee2] bg-[#f7fcf9] p-5">
                  <h3 className="text-xl font-bold text-slate-900">Buddy Summary</h3>
                  <p className="mt-3 text-lg leading-8 text-slate-600">
                    {buddyState.explanation}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <InfoPill label={`Health: ${buddyState.health}`} />
                    <InfoPill label={`Mood: ${buddyState.mood}`} />
                    <InfoPill label={buddyState.badge} />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveModal('explanation')}
                      className="rounded-full bg-[#2fd37c] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#28bf70]"
                    >
                      Impact Explanation 🔎
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal('tips')}
                      className="rounded-full border border-[#cfe8dc] bg-[#e6f6ee] px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-[#dff3e9]"
                    >
                      Get Tips 🌱
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
                <h2 className="text-2xl font-bold text-slate-900">Tracked Usage Snapshot</h2>
                <p className="mt-2 text-lg text-slate-500">
                  Real usage data currently influencing Buddy’s state.
                </p>

                <div className="mt-6 grid gap-5 md:grid-cols-3">
                  <MetricCard
                    accent="bg-[#2fd37c]"
                    icon="💬"
                    label="Messages"
                    value={stats.messageCount}
                    sublabel="tracked prompts"
                  />
                  <MetricCard
                    accent="bg-[#53a8ff]"
                    icon="⏱️"
                    label="Active Minutes"
                    value={stats.activeMinutes}
                    sublabel="session time"
                  />
                  <MetricCard
                    accent="bg-[#f3c14b]"
                    icon="🧠"
                    label="Estimated Tokens"
                    value={stats.totalEstimatedTokens}
                    sublabel="usage volume"
                  />
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-[#d7eee2] bg-[#f7fcf9] p-4 text-sm text-slate-600">
                  Source: {stats.source || 'unknown'} • Date: {stats.date || '-'}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
                <h2 className="text-center text-2xl font-bold text-slate-900">Buddy Visual</h2>
                <p className="mt-2 text-center text-lg text-slate-500">
                  Visual representation of Buddy’s current condition.
                </p>

                <div className="mt-6 relative flex h-[340px] w-full items-center justify-center overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-[#eef8f2] to-[#f7fcf9]">
                  {assetError ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-[1.7rem] border border-dashed border-red-300 bg-red-50 p-8 text-center">
                      <div className="text-6xl">⚠️</div>
                      <p className="text-2xl font-bold text-red-700">Asset Load Error</p>
                      <p className="max-w-sm text-base leading-7 text-red-600">
                        Buddy’s visual asset could not be loaded. A placeholder state is being shown instead.
                      </p>
                    </div>
                  ) : (
                    <Image
                      src={buddyState.image}
                      alt="Buddy visual state"
                      fill
                      className="object-contain p-8"
                      priority
                      onError={handleImageError}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <button
        onClick={() => setSimulateAssetFailure((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition ${
          simulateAssetFailure
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-slate-300 hover:bg-slate-400'
        }`}
        aria-label="Toggle asset failure simulation"
        title="Toggle asset failure simulation"
      >
        {simulateAssetFailure ? '⚠️' : '🧪'}
      </button>

      {activeModal === 'explanation' && (
        <Modal title="Impact Explanation" onClose={() => setActiveModal(null)}>
          <p className="text-base leading-7 text-slate-700">{buddyState.explanation}</p>

          <div className="mt-5 grid gap-3">
            <DetailRow label="Health Level" value={buddyState.health} />
            <DetailRow label="Mood" value={buddyState.mood} />
            <DetailRow label="Impact Level" value={buddyState.impact} />
            <DetailRow label="Tracked Messages" value={stats.messageCount} />
            <DetailRow label="Estimated Tokens" value={stats.totalEstimatedTokens} />
          </div>
        </Modal>
      )}

      {activeModal === 'tips' && (
        <Modal title="Sustainability Tips" onClose={() => setActiveModal(null)}>
          <p className="text-base leading-7 text-slate-700">
            These suggestions are based on Buddy’s current state and recent tracked usage behavior.
          </p>

          <ul className="mt-5 space-y-3">
            {buddyState.tips.map((tip) => (
              <li
                key={tip}
                className="rounded-2xl border border-[#d7eee2] bg-[#f7fcf9] px-4 py-4 text-sm leading-7 text-slate-700"
              >
                {tip}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}

function MetricCard({ accent, icon, label, value, sublabel, compact = false }) {
  return (
    <div className="overflow-hidden rounded-[1.7rem] border border-[#dbece3] bg-white shadow-[0_2px_10px_rgba(35,83,61,0.04)]">
      <div className={`h-2 w-full ${accent}`} />
      <div className="p-5">
        <p className="text-[1.05rem] font-medium text-slate-500">
          {icon} {label}
        </p>
        <p
          className={`mt-4 font-bold tracking-tight text-slate-900 ${
            compact ? 'text-3xl leading-tight' : 'text-4xl'
          }`}
        >
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

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#d7eee2] bg-[#f7fcf9] px-4 py-3">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[1.8rem] border border-[#d7eee2] bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}