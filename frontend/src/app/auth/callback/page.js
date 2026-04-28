'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BU_EMAIL_DOMAIN = '@bu.edu'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (!data?.session?.user) {
          throw new Error('No user session found')
        }

        const user = data.session.user
        const userEmail = user.email

        // Validate email domain
        if (!userEmail.endsWith(BU_EMAIL_DOMAIN)) {
          setError(`Only ${BU_EMAIL_DOMAIN} emails are allowed. Your email: ${userEmail}`)
          
          // Sign out the user since they don't have a valid domain
          await supabase.auth.signOut()
          
          setTimeout(() => {
            router.push('/sign-in')
          }, 3000)
          
          return
        }

        // Email is valid, send token to extension
        const token = data.session.access_token
        const userId = user.id

        // Send token to extension via postMessage
        window.postMessage({
          type: 'CHATGPT_TRACKER_AUTH',
          token,
          userId,
        }, '*')

        console.log('📤 Sent auth token to extension')

        // Proceed to dashboard
        router.push('/dashboard')
      } catch (err) {
        setError(err.message)
        setTimeout(() => {
          router.push('/sign-in')
        }, 3000)
      } finally {
        setChecking(false)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {checking && !error && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
            <h1 className="text-xl font-semibold text-slate-900">Verifying your account...</h1>
            <p className="text-sm text-slate-600 mt-2">Please wait while we validate your email domain.</p>
          </>
        )}

        {error && (
          <>
            <div className="text-red-600 text-4xl mb-4">✕</div>
            <h1 className="text-xl font-semibold text-slate-900">Access Denied</h1>
            <p className="text-sm text-red-600 mt-2">{error}</p>
            <p className="text-xs text-slate-500 mt-4">Redirecting to sign in in 3 seconds...</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
            <h1 className="text-xl font-semibold text-slate-900">Loading...</h1>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
