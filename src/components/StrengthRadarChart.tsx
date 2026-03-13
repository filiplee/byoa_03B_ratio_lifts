import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { PrimaryGoal } from '../types'
import { getRadarChartData } from '../calculations'
import type { Lift1RM } from '../types'

interface StrengthRadarChartProps {
  oneRMs: Lift1RM[]
  goal: PrimaryGoal
  bodyweight?: number
  units: string
}

export function StrengthRadarChart({
  oneRMs,
  goal,
  bodyweight,
  units,
}: StrengthRadarChartProps) {
  const data = getRadarChartData(oneRMs, goal, bodyweight)

  return (
    <div className="rounded-xl border border-slate-500/50 bg-slate-600/50 p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-300">
        Strength profile
      </h3>
      <div className="h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart data={data} margin={{ top: 20, right: 24, bottom: 20, left: 24 }}>
            <PolarGrid stroke="rgb(100 116 139)" strokeOpacity={0.5} />
            <PolarAngleAxis
              dataKey="subject"
              tick={({ payload, x, y }) => {
                const row = data.find((d) => d.subject === payload.value)
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    fill="rgb(203 213 225)"
                    fontSize={10}
                    className="fill-slate-300"
                  >
                    {row?.subject === 'BW ratio' ? (
                      <>
                        <tspan x={x} dy={-4}>BW ratio</tspan>
                        <tspan x={x} dy={10}>{row.oneRM.toFixed(2)}</tspan>
                      </>
                    ) : (
                      <>
                        <tspan x={x} dy={-4}>{payload.value}</tspan>
                        <tspan x={x} dy={10}>{row ? `${row.oneRM} ${units}` : ''}</tspan>
                      </>
                    )}
                  </text>
                )
              }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'rgb(148 163 184)', fontSize: 9 }}
              tickCount={4}
            />
            <Radar
              name="Your profile"
              dataKey="user"
              stroke="rgb(94 234 212)"
              fill="rgb(94 234 212)"
              fillOpacity={0.35}
              strokeWidth={2}
            />
            <Radar
              name={`Ideal for ${goal}`}
              dataKey="ideal"
              stroke="rgb(203 213 225)"
              fill="transparent"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(51 65 85)',
                border: '1px solid rgb(71 85 105)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'rgb(203 213 225)' }}
              labelFormatter={(label) => label}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px' }}
              formatter={(value) => <span className="text-slate-200">{value}</span>}
              iconType="circle"
              iconSize={8}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-xs text-slate-400">
        Your shape vs ideal for {goal}. Axis labels show your 1RM ({units}).
      </p>
    </div>
  )
}
