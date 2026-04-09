import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import analyticsService from '../services/analyticsService';
import TextInput from '../components/forms/TextInput';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ErrorBanner from '../components/ErrorBanner';
import { formatCurrency } from '../utils/format';

const pieColors = ['#1d9f9a', '#f5ab2a', '#176462', '#b8700e'];

function AnalyticsPage() {
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    revenue: { totalRevenue: 0, revenuePerDay: [] },
    occupancy: { occupancyRate: 0, perDay: [] },
    ota: { performance: [] },
    metrics: { ADR: 0, RevPAR: 0, occupancyRate: 0 },
  });

  const loadAnalytics = async (nextFilters = filters) => {
    try {
      setLoading(true);
      setError(null);

      const [revenue, occupancy, ota, metrics] = await Promise.all([
        analyticsService.getRevenue({ startDate: nextFilters.startDate, endDate: nextFilters.endDate }),
        analyticsService.getOccupancy({
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate,
        }),
        analyticsService.getOtaPerformance(),
        analyticsService.getMetrics({ startDate: nextFilters.startDate, endDate: nextFilters.endDate }),
      ]);

      setData({ revenue, occupancy, ota, metrics });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const otaPieData = useMemo(
    () => data.ota.performance.map((item) => ({ name: item.otaSource, value: item.bookings })),
    [data.ota.performance],
  );

  const onApplyFilters = (e) => {
    e.preventDefault();
    loadAnalytics(filters);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-72" />
        <div className="grid gap-4 md:grid-cols-3">
          <LoadingSkeleton className="h-24" />
          <LoadingSkeleton className="h-24" />
          <LoadingSkeleton className="h-24" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LoadingSkeleton className="h-80" />
          <LoadingSkeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-extrabold">Advanced Analytics</h2>
      <ErrorBanner message={error} />

      <form onSubmit={onApplyFilters} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
        <TextInput
          label="Start Date"
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          required
        />
        <TextInput
          label="End Date"
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          required
        />
        <button className="rounded-md bg-brand-700 px-4 py-2 font-semibold text-white">Apply</button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase text-slate-500">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data.revenue.totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase text-slate-500">ADR</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data.metrics.ADR)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs uppercase text-slate-500">RevPAR</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(data.metrics.RevPAR)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-lg font-bold">Revenue Over Time</h3>
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={data.revenue.revenuePerDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#1d9f9a" fill="#aee9e3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="h-80 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-lg font-bold">Occupancy Rate Trend</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data.occupancy.perDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="occupancy" stroke="#f5ab2a" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-80 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-lg font-bold">OTA Distribution</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie data={otaPieData} dataKey="value" nameKey="name" outerRadius={110} label>
                {otaPieData.map((_, idx) => (
                  <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="h-80 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-lg font-bold">Revenue by OTA</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data.ota.performance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="otaSource" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#176462" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
