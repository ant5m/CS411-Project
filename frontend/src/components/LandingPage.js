import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#eef8f2]">
      {/* Navigation */}
      <nav className="px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl flex justify-between items-center">
          <div className="text-2xl font-bold text-[#0ea56a]">TamagotGPT</div>
          <div className="flex gap-4">
            <Link
              href="/sign-in"
              className="px-6 py-2 text-slate-700 font-semibold hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-6 py-2 bg-[#0ea56a] text-white rounded-full font-semibold hover:bg-[#0c935f]"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div>
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2d9b72]">
                Welcome to TamagotGPT
              </p>
            </div>
            <h1 className="text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Track Your AI Impact on the Environment
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Monitor your ChatGPT usage, understand its environmental impact, and make sustainable choices with our digital companion Buddy.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/sign-up"
                className="px-8 py-4 bg-[#0ea56a] text-white rounded-full font-semibold text-lg hover:bg-[#0c935f] transition text-center"
              >
                Get Started
              </Link>
              <Link
                href="/sign-in"
                className="px-8 py-4 border-2 border-[#d7eee2] text-slate-700 rounded-full font-semibold text-lg hover:bg-[#f7fcf9] transition text-center"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-5 py-16 sm:px-8 sm:py-24 bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2d9b72] mb-4">
              Key Features
            </p>
            <h2 className="text-4xl font-bold text-slate-900">What You Get</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-[2rem] border border-[#d7eee2] bg-[#f7fcf9] p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Track Usage</h3>
              <p className="text-slate-600">
                Automatically track your ChatGPT messages and see detailed analytics of your usage patterns.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#d7eee2] bg-[#f7fcf9] p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Environmental Impact</h3>
              <p className="text-slate-600">
                Understand the estimated CO2 emissions from your AI usage and make informed decisions.
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#d7eee2] bg-[#f7fcf9] p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-3">Meet Buddy</h3>
              <p className="text-slate-600">
                Your digital companion that reflects your usage patterns and encourages sustainable AI habits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[2rem] border border-[#d7eee2] bg-white px-8 py-12 sm:px-12 sm:py-16 text-center shadow-[0_4px_18px_rgba(35,83,61,0.06)]">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-slate-600 mb-8">
              Join thousands of users who are tracking their environmental impact and building sustainable AI habits.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/sign-up"
                className="px-8 py-3 bg-[#0ea56a] text-white rounded-full font-semibold hover:bg-[#0c935f] transition"
              >
                Create Account
              </Link>
              <Link
                href="/sign-in"
                className="px-8 py-3 border-2 border-[#d7eee2] text-slate-700 rounded-full font-semibold hover:bg-[#f7fcf9] transition"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 sm:px-8 border-t border-[#d7eee2]">
        <div className="mx-auto max-w-7xl text-center text-slate-600">
          <p>2024 TamagotGPT. Sustainable AI tracking for everyone.</p>
        </div>
      </footer>
    </main>
  );
}
