'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [extensionConnected, setExtensionConnected] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/sign-in')
      return
    }

    if (user) {
      console.log('👤 User logged in, user.id:', user.id);
      
      const notifyExtensionOfUser = async () => {
        // Send Supabase JWT token to extension for authenticated tracking
        console.log('🔔 notifyExtensionOfUser() called');
        console.log('👤 Current user in function:', user.id);
        
        if (!user) {
          console.error('❌ No user available');
          setExtensionConnected(false);
          return;
        }
        
        try {
          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token
          
          console.log('🔐 Session token available:', !!token);
          
          if (!token) {
            console.warn('❌ No JWT token available');
            setExtensionConnected(false);
            return;
          }
          
          // Create a promise that resolves when extension confirms it received the message
          const extensionResponsePromise = new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.warn('⏱️ No response from extension within 2 seconds');
              setExtensionConnected(false);
              resolve(false);
            }, 2000);
            
            const handleResponse = (event) => {
              if (event.data.type === 'CHATGPT_TRACKER_AUTH_ACK') {
                clearTimeout(timeout);
                console.log('✅ Extension confirmed receipt of auth token');
                window.removeEventListener('message', handleResponse);
                setExtensionConnected(true);
                resolve(true);
              }
            };
            
            window.addEventListener('message', handleResponse);
          });
          
          console.log('📨 Sending JWT token via postMessage to injector (content script)');
          console.log('📤 Message type: CHATGPT_TRACKER_AUTH, userId:', user.id);
          
          // Send token via postMessage - this always works on any webpage
          // The injector (content script) will receive this and forward to background worker
          window.postMessage({
            type: 'CHATGPT_TRACKER_AUTH',
            token,
            userId: user.id,
          }, '*');
          
          console.log('✅ postMessage sent, waiting for extension to confirm...');
          
          // Wait for extension response
          await extensionResponsePromise;
        } catch (err) {
          console.error('❌ Error sending token to extension:', err.message);
          setExtensionConnected(false);
        }
      };
      
      notifyExtensionOfUser().catch((err) => console.error('Error in notifyExtensionOfUser:', err));
    }
  }, [user, authLoading]);

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

          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Account</h2>
              <p className="text-slate-600">Signed in as: <strong>{user?.email}</strong></p>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Extension Status</h2>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${extensionConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-slate-600">
                  {extensionConnected 
                    ? '✅ Extension connected and tracking' 
                    : '⚠️ Extension not connected. Install the extension to start tracking.'}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>📌 How tracking works:</strong> The ChatGPT Usage Tracker extension automatically records your messages on ChatGPT.com. 
                Open the extension popup to see your stats and dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
