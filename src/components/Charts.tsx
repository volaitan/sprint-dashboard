import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Burndown, Velocity } from '../api/types';
import { shortDate } from '../lib/dates';

const BLUE = '#2f5fd0';
const GREY = '#9aa4b2';
const GREEN = '#2e9e6a';

export function BurndownChart({ data }: { data: Burndown }) {
  const rows = data.days.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <div className="chart" role="img" aria-label={`Burndown chart: ${data.committed_points} points committed`}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#eef1f6" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="linear" dataKey="ideal" name="Ideal" stroke={GREY} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="remaining" name="Remaining" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VelocityChart({ data }: { data: Velocity }) {
  if (data.sprints.length === 0) return <p className="muted">Complete a sprint to see velocity.</p>;
  return (
    <div className="chart" role="img" aria-label={`Velocity chart: average ${data.average} points`}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data.sprints} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#eef1f6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="committed" name="Committed" fill="#c9d4ee" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="completed" name="Completed" fill={GREEN} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <ReferenceLine y={data.forecast_next} stroke={BLUE} strokeDasharray="4 3" label={{ value: `Forecast ${data.forecast_next}`, fontSize: 11, fill: BLUE, position: 'insideTopLeft' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
