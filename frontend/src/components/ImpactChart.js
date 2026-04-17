'use client'

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts'

export default function ImpactChart({ data, showBenchmark }) {
  // If no data yet, show a placeholder
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <p className="text-slate-400 text-sm italic">Waiting for usage data to generate chart...</p>
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 10, fill: '#64748b' }} 
            tickFormatter={(str) => {
              const date = new Date(str);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }}
            minTickGap={30}
          />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} unit="g" />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              fontSize: '12px'
            }}
          />
          <Legend verticalAlign="top" height={36} iconType="circle" />
          
          {/* Main CO2 Line - Success Scenario */}
          <Line 
            name="Your CO2 Impact"
            type="monotone" 
            dataKey="co2" 
            stroke="#10b981" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />

          {/* Benchmark Line - Alternate Course */}
          {showBenchmark && (
            <Line 
              name="Avg User Benchmark"
              type="monotone" 
              dataKey="benchmark" 
              stroke="#cbd5e1" 
              strokeDasharray="5 5" 
              dot={false} 
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}