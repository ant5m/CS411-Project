"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

const initialStats = {
  date: "-",
  messageCount: 0,
  activeMinutes: 0,
  totalEstimatedTokens: 0,
  productivityInsight: "No insight yet.",
};

export default function Home() {
  const [stats, setStats] = useState(initialStats);
  const [status, setStatus] = useState("Loading dashboard...");

  useEffect(() => {
    let ignore = false;

    async function loadStats() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/stats/daily?userId=local-dev-user`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!ignore) {
          setStats(data);
          setStatus(`Connected to backend (${data.source || "unknown source"}).`);
        }
      } catch {
        if (!ignore) {
          setStatus("Backend unavailable. Start backend on port 4000.");
        }
      }
    }

    loadStats();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold">ChatGPT Usage Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Next.js frontend skeleton connected to Express + Supabase-ready backend.
          </p>
          <p className="mt-3 text-sm font-medium text-emerald-700">{status}</p>
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
  );
}

function Card({ title, value }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </article>
  );
}
