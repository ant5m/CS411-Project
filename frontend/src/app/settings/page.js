'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
      return
    }

    if (user) {
      fetchApiKey()
    }
  }, [user, authLoading])

  const fetchApiKey = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/user/api-key`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setApiKey(data.apiKey || '')
      }
    } catch (err) {
      console.error('Failed to fetch API key:', err)
    }
  }

  const handleSaveApiKey = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const session = await supabase.auth.getSession()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/user/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ apiKey }),
      })

      if (!response.ok) throw new Error('Failed to save API key')

      setMessage('✓ API key saved successfully')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage(`✗ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  if (authLoading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                ← Home
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-slate-600">Signed in as: <strong>{user?.email}</strong></p>
          </div>

          <form onSubmit={handleSaveApiKey} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-600 hover:text-slate-900"
                >
                  {showKey ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Your API key is encrypted and stored securely. Never shared publicly.
              </p>
            </div>

            {message && (
              <p className={`text-sm ${message.includes('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save API Key'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
