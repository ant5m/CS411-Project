'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ImpactChart from '@/components/ImpactChart'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

export default function ImpactPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [range, setRange] = useState('daily')
  const [showBenchmark, setShowBenchmark] = useState(false)
  const [chartData, setChartData] = useState([])
  const [hasHistory, setHasHistory] = useState(true)
  const [stats, setStats] = useState({
    co2Grams: 0,
    messageCount: 0,
    productivityInsight: 'No insight yet.'
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
      return
    }

    if (user) {
      loadImpactData()
    }
  }, [user, authLoading, range])

  const loadImpactData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${API_BASE_URL}/api/stats/dashboard?range=${range}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json()
      
      if (result.hasData === false) {
        setHasHistory(false)
      } else {
        setHasHistory(true)
        setStats({
          messageCount: result.impact.messageCount,
          co2Grams: result.impact.co2Grams,
          productivityInsight: result.impact.benchmarkComparison === 'Above Average' 
            ? 'High usage detected. Your carbon footprint is currently above the daily average.' 
            : 'Eco-conscious usage! You are performing better than the average benchmark.'
        })
        setChartData(result.chartData)
      }
    } catch (err) {
      console.error("Failed to load impact data:", err)
    }
  }

  if (authLoading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center">Loading...</div>

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* Navigation & Back Button */}
        <div className="flex items-center justify-between">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors group"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              fill="currentColor" 
              viewBox="0 0 256 256"
              className="group-hover:-translate-x-1 transition-transform"
            >
              <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
            </svg>
            Back to Dashboard
          </Link>
          
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-200">
            Environmental Report
          </span>
        </div>

        {/* Main Header Card */}
        <header className="rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
          <h1 className="text-3xl font-extrabold text-emerald-900">Carbon Footprint Analysis</h1>
          <p className="mt-2 text-slate-600">Deep dive into your AI environmental statistics and benchmarks.</p>
          
          <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-100">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
              {['daily', 'weekly', 'monthly'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                    range === r ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600">
              <input 
                type="checkbox" 
                checked={showBenchmark} 
                onChange={(e) => setShowBenchmark(e.target.checked)} 
                className="w-4 h-4 accent-emerald-600"
              />
              Show Benchmark Line
            </label>
          </div>
        </header>

        {/* Data Display Logic */}
        {!hasHistory ? (
          <section className="rounded-2xl bg-amber-50 border border-amber-200 p-12 text-center">
            <h2 className="text-xl font-bold text-amber-900">No Historical Data</h2>
            <p className="mt-2 text-amber-800">We couldn't find any recorded impact for this specific period.</p>
          </section>
        ) : (
          <>
            <section className="grid gap-6 sm:grid-cols-2">
              <article className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total CO2 for Period</h3>
                <p className="mt-2 text-4xl font-black text-emerald-600">{stats.co2Grams}g</p>
              </article>
              <article className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Efficiency Status</h3>
                <p className="mt-2 text-4xl font-black text-slate-900">
                  {showBenchmark ? "Comparing" : "Active"}
                </p>
              </article>
            </section>

            {/* Interactive Chart Section */}
            <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Carbon Emission Trend</h2>
              <ImpactChart data={chartData} showBenchmark={showBenchmark} />
            </section>

            {/* Insights Section */}
            <section className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Eco-Insight</h2>
              <p className="mt-2 text-slate-700 leading-relaxed">{stats.productivityInsight}</p>
              {showBenchmark && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 italic">
                  * Benchmark comparison based on 15g CO2/day average for power users.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}