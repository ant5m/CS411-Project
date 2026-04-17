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
          console.error('❌ No user available')
          setExtensionConnected(false)
          return
        }

        try {
          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token

          console.log('🔐 Session token available:', !!token)

          if (!token) {
            console.warn('❌ No JWT token available')
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
                console.log('✅ Extension confirmed receipt of auth token')
                window.removeEventListener('message', handleResponse)
                setExtensionConnected(true)
                resolve(true)
              }
            }

            window.addEventListener('message', handleResponse)
          })

          console.log('📨 Sending JWT token via postMessage to injector (content script)')
          console.log('📤 Message type: CHATGPT_TRACKER_AUTH, userId:', user.id)

          window.postMessage(
            {
              type: 'CHATGPT_TRACKER_AUTH',
              token,
              userId: user.id,
            },
            '*'
          )

          console.log('✅ postMessage sent, waiting for extension to confirm...')
          await extensionResponsePromise
        } catch (err) {
          console.error('❌ Error sending token to extension:', err.message)
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        Loading...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
              <p className="text-slate-600 mt-1">
                Manage your account, extension status, and emissions notifications.
              </p>
            </div>

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

          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Account</h2>
              <p className="text-slate-600">
                Signed in as: <strong>{user?.email}</strong>
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Extension Status</h2>
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    extensionConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></div>
                <span className="text-slate-600">
                  {extensionConnected
                    ? '✅ Extension connected and tracking'
                    : '⚠️ Extension not connected. Install the extension to start tracking.'}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">
                    Notification Preferences
                  </h2>
                  <p className="text-slate-600">
                    Choose when TamagotGPT should alert you about higher-impact AI usage.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    notificationsEnabled
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
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

              <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Current saved setting:</strong>{' '}
                  {savedEnabled
                    ? `${capitalize(savedPreference)} notifications threshold`
                    : 'Notifications are currently off'}
                </p>
              </div>

              <div className="mt-4 flex items-start gap-3">
                <input
                  id="simulateFailure"
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="simulateFailure" className="text-sm text-slate-600">
                  Simulate save failure for testing
                </label>
              </div>

              {hasUnsavedChanges && (
                <div className="mt-4 bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-900">
                  You have unsaved changes.
                </div>
              )}

              {message && (
                <div
                  className={`mt-4 p-4 rounded-lg text-sm ${
                    messageType === 'error'
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="px-5 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Save and Exit
                </button>
                <button
                  type="button"
                  onClick={handleDiscardChanges}
                  className="px-5 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Discard Changes
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>📌 How tracking works:</strong> The ChatGPT Usage Tracker extension
                automatically records your messages on ChatGPT.com. Open the extension popup to
                see your stats and dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreferenceCard({ title, description, value, selected, onChange }) {
  const isSelected = selected === value

  return (
    <label
      className={`cursor-pointer rounded-lg border p-4 transition ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-slate-200 bg-white hover:border-emerald-300'
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
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
    </label>
  )
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}