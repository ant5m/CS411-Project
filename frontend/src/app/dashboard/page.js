'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

const initialStats = {
  date: '-',
  messageCount: 0,
  activeMinutes: 0,
  totalEstimatedTokens: 0,
  productivityInsight: 'No insight yet.',
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState(initialStats)
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
      return
    }

    if (user) {
      loadStats()
    }
  }, [user, authLoading, router])

  const loadStats = async () => {
    try {
      const session = await supabase.auth.getSession()
      const response = await fetch(`${API_BASE_URL}/api/stats/daily`, {
        headers: {
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      setStats(data)
      setStatus(`Connected (${data.source || 'unknown'})`)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">ChatGPT Usage Dashboard</h1>
              <p className="mt-2 text-sm text-slate-600">
                Track your API usage and get productivity insights.
              </p>
              <p className="mt-3 text-sm font-medium text-emerald-700">{status}</p>
            </div>
            <Link
              href="/settings"
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Settings
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Date" value={stats.date} />
          <Card title="Messages Today" value={String(stats.messageCount)} />
          <Card title="Active Minutes" value={String(stats.activeMinutes)} />
          <Card title="Estimated Tokens" value={String(stats.totalEstimatedTokens)} />
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Productivity Insight</h2>
          <p className="mt-2 text-slate-700">{stats.productivityInsight}</p>
        </section>
      </div>
    </main>
  )
}

function Card({ title, value }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </article>
  )
}
