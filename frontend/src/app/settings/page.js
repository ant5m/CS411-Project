'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'tamagotgpt_notification_preference'

export default function Settings() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [extensionConnected, setExtensionConnected] = useState(false)

  const [savedPreference, setSavedPreference] = useState('medium')
  const [selectedPreference, setSelectedPreference] = useState('medium')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [savedEnabled, setSavedEnabled] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [simulateFailure, setSimulateFailure] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
      return
    }

    if (user) {
      console.log('👤 User logged in, user.id:', user.id)

      const saved = localStorage.getItem(STORAGE_KEY)

      if (saved) {
        const parsed = JSON.parse(saved)
        const preference = parsed.preference || 'medium'
        const enabled =
          typeof parsed.enabled === 'boolean' ? parsed.enabled : preference !== 'off'

        setSavedPreference(preference)
        setSelectedPreference(preference)
        setSavedEnabled(enabled)
        setNotificationsEnabled(enabled)
      } else {
        const defaultData = { preference: 'medium', enabled: true }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData))
      }

      const notifyExtensionOfUser = async () => {
        console.log('🔔 notifyExtensionOfUser() called')
        console.log('👤 Current user in function:', user.id)

        if (!user) {
          console.error(' No user available')
          setExtensionConnected(false)
          return
        }

        try {
          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token

          console.log(' Session token available:', !!token)

          if (!token) {
            console.warn(' No JWT token available')
            setExtensionConnected(false)
            return
          }

          const extensionResponsePromise = new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('⏱️ No response from extension within 2 seconds')
              setExtensionConnected(false)
              resolve(false)
            }, 2000)

            const handleResponse = (event) => {
              if (event.data.type === 'CHATGPT_TRACKER_AUTH_ACK') {
                clearTimeout(timeout)
                console.log(' Extension confirmed receipt of auth token')
                window.removeEventListener('message', handleResponse)
                setExtensionConnected(true)
                resolve(true)
              }
            }

            window.addEventListener('message', handleResponse)
          })

          console.log(' Sending JWT token via postMessage to injector (content script)')
          console.log(' Message type: CHATGPT_TRACKER_AUTH, userId:', user.id)

          window.postMessage(
            {
              type: 'CHATGPT_TRACKER_AUTH',
              token,
              userId: user.id,
            },
            '*'
          )

          console.log(' postMessage sent, waiting for extension to confirm...')
          await extensionResponsePromise
        } catch (err) {
          console.error(' Error sending token to extension:', err.message)
          setExtensionConnected(false)
        }
      }

      notifyExtensionOfUser().catch((err) =>
        console.error('Error in notifyExtensionOfUser:', err)
      )
    }
  }, [user, authLoading, router])

  const hasUnsavedChanges =
    selectedPreference !== savedPreference || notificationsEnabled !== savedEnabled

  const handleOptionChange = (value) => {
    setSelectedPreference(value)
    setNotificationsEnabled(value !== 'off')
    setMessage('')
  }

  const handleToggleNotifications = () => {
    const nextEnabled = !notificationsEnabled
    setNotificationsEnabled(nextEnabled)

    if (!nextEnabled) {
      setSelectedPreference('off')
    } else if (selectedPreference === 'off') {
      setSelectedPreference(savedPreference === 'off' ? 'medium' : savedPreference)
    }

    setMessage('')
  }

  const handleSavePreferences = () => {
    setMessage('')

    if (simulateFailure) {
      setMessageType('error')
      setMessage('Unable to save changes. Please try again.')
      return
    }

    const finalPreference = notificationsEnabled ? selectedPreference : 'off'
    const payload = {
      preference: finalPreference,
      enabled: notificationsEnabled && finalPreference !== 'off',
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))

    setSavedPreference(payload.preference)
    setSelectedPreference(payload.preference)
    setSavedEnabled(payload.enabled)
    setNotificationsEnabled(payload.enabled)

    setMessageType('success')
    setMessage('Notification preferences saved successfully.')
  }

  const handleDiscardChanges = () => {
    setSelectedPreference(savedPreference)
    setNotificationsEnabled(savedEnabled)
    setMessage('')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

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
                Settings
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-500">
                Manage your account, extension status, and emissions notifications.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-full border border-[#d7e3ef] bg-[#f8fafc] px-5 py-3 text-base font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                ← Home
              </button>
              <button
                onClick={handleSignOut}
                className="rounded-full bg-[#0ea56a] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#0c935f]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
            <h2 className="text-2xl font-bold text-slate-900">Account</h2>
            <p className="mt-3 text-lg text-slate-500">
              Signed in as: <strong className="text-slate-800">{user?.email}</strong>
            </p>
          </div>

          <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
            <h2 className="text-2xl font-bold text-slate-900">Extension Status</h2>
            <div className="mt-4 flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  extensionConnected ? 'bg-[#0ea56a]' : 'bg-red-500'
                }`}
              ></div>
              <span className="text-lg text-slate-600">
                {extensionConnected
                  ? ' Extension connected and tracking'
                  : ' Extension not connected. Install the extension to start tracking.'}
              </span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-7 py-6 shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Notification Preferences
                </h2>
                <p className="mt-3 text-lg text-slate-500">
                  Choose when TamagotGPT should alert you about higher-impact AI usage.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`rounded-full px-5 py-3 text-base font-semibold transition ${
                  notificationsEnabled
                    ? 'bg-[#0ea56a] text-white hover:bg-[#0c935f]'
                    : 'border border-[#d7eee2] bg-[#f8fafc] text-slate-600 hover:bg-slate-50'
                }`}
              >
                {notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
              </button>
            </div>

            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <PreferenceCard
                title="Low"
                description="Trigger alerts sooner for smaller increases in impact."
                value="low"
                selected={selectedPreference}
                onChange={handleOptionChange}
              />
              <PreferenceCard
                title="Medium"
                description="Balanced option for regular monitoring."
                value="medium"
                selected={selectedPreference}
                onChange={handleOptionChange}
              />
              <PreferenceCard
                title="High"
                description="Only alert when environmental impact becomes more significant."
                value="high"
                selected={selectedPreference}
                onChange={handleOptionChange}
              />
              <PreferenceCard
                title="Off"
                description="Turn off emissions notifications."
                value="off"
                selected={selectedPreference}
                onChange={handleOptionChange}
              />
            </div>

            <div className="mt-7 rounded-[1.6rem] border border-dashed border-[#c9dad1] bg-[#f7fcf9] p-6">
              <p className="text-base text-slate-700">
                <strong>Current saved setting:</strong>{' '}
                {savedEnabled
                  ? `${capitalize(savedPreference)} notifications threshold`
                  : 'Notifications are currently off'}
              </p>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <input
                id="simulateFailure"
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="simulateFailure" className="text-slate-600">
                Simulate save failure for testing
              </label>
            </div>

            {hasUnsavedChanges && (
              <div className="mt-4 rounded-[1.35rem] border border-[#f5cc7d] bg-[#fffbeb] p-4 text-slate-700">
                You have unsaved changes.
              </div>
            )}

            {message && (
              <div
                className={`mt-4 rounded-[1.35rem] border p-4 ${
                  messageType === 'error'
                    ? 'border-red-300 bg-red-50 text-red-800'
                    : 'border-[#c9eadc] bg-[#dff3e9] text-[#145c43]'
                }`}
              >
                {message}
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="rounded-full bg-[#0ea56a] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#0c935f]"
              >
                Save and Exit
              </button>
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="rounded-full border border-[#d7eee2] bg-white px-5 py-3 text-base font-semibold text-slate-600 transition hover:bg-[#f7fcf9]"
              >
                Discard Changes
              </button>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-dashed border-[#c9dad1] bg-[#f7fcf9] p-6">
            <p className="text-base text-slate-700">
              <strong> How tracking works:</strong> The ChatGPT Usage Tracker extension
              automatically records your messages on ChatGPT.com. Open the extension popup to
              see your stats and dashboard.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function PreferenceCard({ title, description, value, selected, onChange }) {
  const isSelected = selected === value

  return (
    <label
      className={`cursor-pointer rounded-[1.35rem] border p-5 transition ${
        isSelected
          ? 'border-[#2fd37c] bg-[#dff3e9]'
          : 'border-[#d7eee2] bg-white hover:border-[#a8e6d1]'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name="notification-threshold"
          value={value}
          checked={isSelected}
          onChange={() => onChange(value)}
          className="mt-1"
        />
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-2 text-slate-600">{description}</p>
        </div>
      </div>
    </label>
  )
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}