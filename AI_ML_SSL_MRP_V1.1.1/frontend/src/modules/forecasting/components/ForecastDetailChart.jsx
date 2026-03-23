import { useState, useEffect, useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
    ComposedChart, Area, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import api from "../../../api";

const MONTH_NAMES = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
];

const ForecastDetailChart = ({ itemId, hideTable }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/forecast/detail/${itemId}`);
                setData(res.data);
            } catch (err) {
                console.error("Forecast detail error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [itemId]);

    // Build chart data: merge forecast and sales into one timeline
    const chartData = useMemo(() => {
        if (!data) return [];

        const map = {};

        // Add historical sales (monthly totals)
        if (data.sales_history) {
            data.sales_history.forEach(s => {
                const key = `${s.year}-${String(s.month).padStart(2, "0")}`;
                if (!map[key]) map[key] = { date: key, month: s.month, year: s.year };
                map[key].actual = Math.round(s.total_sales);
            });
        }

        // Add forecast data
        if (data.forecast) {
            data.forecast.forEach(f => {
                const dateStr = f.date.slice(0, 7);
                const month = parseInt(f.date.slice(5, 7));
                const year = parseInt(f.date.slice(0, 4));
                if (!map[dateStr]) map[dateStr] = { date: dateStr, month, year };
                map[dateStr].forecast = Math.round(f.yhat);
                if (f.yhat_lower != null && f.yhat_upper != null) {
                    map[dateStr].confidenceRange = [Math.round(f.yhat_lower), Math.round(f.yhat_upper)];
                }
            });
        }

        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    }, [data]);

    // Build month-specific history table
    const monthHistory = useMemo(() => {
        if (!data || (!data.forecast?.length && !data.sales_history?.length)) return [];

        const forecastM = data.forecast ? data.forecast.map(f => parseInt(f.date.slice(5, 7))) : [];
        const historyM = data.sales_history ? data.sales_history.map(s => s.month) : [];
        const allMonths = [...new Set([...forecastM, ...historyM])].sort((a, b) => a - b);

        const years = data.sales_history ? [...new Set(data.sales_history.map(s => s.year))].sort((a, b) => a - b) : [];

        return allMonths.map(month => {
            const row = { month, monthName: MONTH_NAMES[month - 1] };
            years.forEach(year => {
                const sale = data.sales_history?.find(s => s.month === month && s.year === year);
                row[`y${year}`] = sale ? Math.round(sale.total_sales) : null;
            });
            const fc = data.forecast?.find(f => parseInt(f.date.slice(5, 7)) === month);
            if (fc) {
                row.forecast = Math.round(fc.yhat);
                row.lower = fc.yhat_lower != null ? Math.round(fc.yhat_lower) : null;
                row.upper = fc.yhat_upper != null ? Math.round(fc.yhat_upper) : null;
            }
            return row;
        });
    }, [data]);

    const historyYears = useMemo(() => {
        if (!data || !data.sales_history) return [];
        return [...new Set(data.sales_history.map(s => s.year))].sort((a, b) => a - b);
    }, [data]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 text-gray-500">Yükleniyor...</span>
            </div>
        );
    }

    if (!data || (!data.forecast?.length && !data.sales_history?.length)) {
        return (
            <div className="text-center py-8 text-gray-400">
                Bu ürün için veri bulunamadı.
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-gray-100 text-sm min-w-[180px]">
                <p className="font-bold text-gray-800 mb-2 border-b pb-1">
                    {(() => {
                        const parts = label.split("-");
                        return `${MONTH_NAMES[parseInt(parts[1]) - 1]} ${parts[0]}`;
                    })()}
                </p>
                {payload.map((p, i) => {
                    if (p.dataKey === "confidenceRange") {
                        return (
                            <div key={i} className="flex justify-between items-center gap-4 py-0.5">
                                <span className="text-purple-500 flex items-center gap-1.5">
                                    <span className="w-3 h-2 bg-purple-200 rounded-sm inline-block"></span>
                                    Güven Aralığı
                                </span>
                                <span className="font-semibold text-purple-600">
                                    {p.value[0]} – {p.value[1]}
                                </span>
                            </div>
                        );
                    }
                    const labels = { actual: "Gerçek Satış", forecast: "Prophet Tahmini" };
                    const colors = { actual: "#3b82f6", forecast: "#6366f1" };
                    return (
                        <div key={i} className="flex justify-between items-center gap-4 py-0.5">
                            <span style={{ color: colors[p.dataKey] || p.color }} className="flex items-center gap-1.5">
                                <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: colors[p.dataKey] || p.color }}></span>
                                {labels[p.dataKey] || p.name}
                            </span>
                            <span className="font-bold" style={{ color: colors[p.dataKey] || p.color }}>
                                {typeof p.value === "number" ? p.value.toLocaleString("tr-TR") : p.value}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="px-6 py-5 space-y-6 animate-in slide-in-from-top-2 duration-300">
            {/* Chart */}
            <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 rounded-xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                        <TrendingUp size={16} className="text-indigo-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800">
                        {itemId} — Aylık Tahmin & Satış Trendi
                    </h3>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <defs>
                            <linearGradient id={`confidence-${itemId}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.7} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            tickFormatter={(val) => {
                                const parts = val.split("-");
                                return `${MONTH_NAMES[parseInt(parts[1]) - 1]} '${parts[0].slice(2)}`;
                            }}
                            axisLine={{ stroke: '#d1d5db' }}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: "#6b7280" }}
                            axisLine={{ stroke: '#d1d5db' }}
                            tickFormatter={(val) => val.toLocaleString("tr-TR")}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                            formatter={(value) => {
                                const map = {
                                    actual: "Gerçek Satış",
                                    forecast: "Prophet Tahmini",
                                    confidenceRange: "Güven Aralığı (%95)"
                                };
                                return <span className="text-gray-600">{map[value] || value}</span>;
                            }}
                        />

                        {/* Confidence interval - shaded area */}
                        <Area
                            dataKey="confidenceRange"
                            fill={`url(#confidence-${itemId})`}
                            stroke="#8b5cf6"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                            strokeOpacity={0.4}
                            fillOpacity={1}
                            name="confidenceRange"
                            connectNulls={false}
                        />

                        {/* Actual sales line */}
                        <Line
                            type="monotone"
                            dataKey="actual"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ fill: "#3b82f6", r: 4, strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2, fill: "#fff" }}
                            name="actual"
                            connectNulls={false}
                        />

                        {/* Forecast line */}
                        <Line
                            type="monotone"
                            dataKey="forecast"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            strokeDasharray="8 4"
                            dot={{ fill: "#6366f1", r: 4, strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6, stroke: "#6366f1", strokeWidth: 2, fill: "#fff" }}
                            name="forecast"
                            connectNulls={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Month-specific Sales History Table */}
            {!hideTable && monthHistory.length > 0 && historyYears.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-700 text-sm">
                            Aylık Satış Geçmişi — Son {historyYears.length} Yıl
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase">Ay</th>
                                    {historyYears.map(y => (
                                        <th key={y} className="px-4 py-2.5 text-right font-semibold text-gray-500 text-xs uppercase">
                                            {y}
                                        </th>
                                    ))}
                                    <th className="px-4 py-2.5 text-right font-semibold text-indigo-500 text-xs uppercase bg-indigo-50/50">
                                        Tahmin
                                    </th>
                                    <th className="px-4 py-2.5 text-right font-semibold text-purple-400 text-xs uppercase bg-purple-50/30">
                                        Güven Aralığı
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {monthHistory.map(row => (
                                    <tr key={row.month} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-2.5 font-medium text-gray-700">{row.monthName}</td>
                                        {historyYears.map(y => (
                                            <td key={y} className="px-4 py-2.5 text-right text-gray-600 tabular-nums">
                                                {row[`y${y}`] != null ? row[`y${y}`].toLocaleString("tr-TR") : "—"}
                                            </td>
                                        ))}
                                        <td className="px-4 py-2.5 text-right font-bold text-indigo-600 bg-indigo-50/30 tabular-nums">
                                            {row.forecast != null ? row.forecast.toLocaleString("tr-TR") : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-purple-500 bg-purple-50/20 tabular-nums text-xs">
                                            {row.lower != null && row.upper != null
                                                ? `${row.lower.toLocaleString("tr-TR")} – ${row.upper.toLocaleString("tr-TR")}`
                                                : "—"
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForecastDetailChart;
