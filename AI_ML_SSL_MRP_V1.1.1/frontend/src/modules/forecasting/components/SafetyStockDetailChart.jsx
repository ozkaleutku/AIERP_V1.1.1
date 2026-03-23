import { useState, useEffect, useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import {
    ComposedChart, Area, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import api from "../../../api";

const MONTH_NAMES = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
];

const SafetyStockDetailChart = ({ itemId, hideTable }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/safety-stock/detail/${itemId}`);
                setData(res.data);
            } catch (err) {
                console.error("Safety stock detail error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [itemId]);

    const chartData = useMemo(() => {
        if (!data) return [];
        const map = {};

        const predictionDates = new Set(
            data.predictions?.map(p => p.date.slice(0, 7)) || []
        );

        // 1. History (Requirement proxy)
        if (data.sales_history) {
            data.sales_history.forEach(s => {
                const key = `${s.year}-${String(s.month).padStart(2, "0")}`;
                if (!map[key]) map[key] = { date: key };
                map[key].requirement = Math.round(s.total_sales);
            });
        }

        // 2. Historical AI recommendations
        if (data.ai_history) {
            data.ai_history.forEach(h => {
                const key = `${h.year}-${String(h.month).padStart(2, "0")}`;
                // Only add AI history if it's NOT a date with a current prediction
                if (!predictionDates.has(key)) {
                    if (!map[key]) map[key] = { date: key };
                    map[key].aiHistory = Math.round(h.ai_amount);
                }
            });
        }

        // 3. Current Predictions
        if (data.predictions) {
            data.predictions.forEach(p => {
                const dateStr = p.date.slice(0, 7);
                if (!map[dateStr]) map[dateStr] = { date: dateStr };
                map[dateStr].predicted = Math.round(p.predicted_ss);
                map[dateStr].status = p.is_approved ? "Approved" : "Proposed";
            });
        }

        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    }, [data]);

    const historyYears = useMemo(() => {
        if (!data || !data.sales_history) return [];
        return [...new Set(data.sales_history.map(s => s.year))].sort((a, b) => a - b);
    }, [data]);

    const monthHistory = useMemo(() => {
        if (!data || (!data.predictions?.length && !data.sales_history?.length)) return [];

        const predM = data.predictions ? data.predictions.map(f => parseInt(f.date.slice(5, 7))) : [];
        const histM = data.sales_history ? data.sales_history.map(s => s.month) : [];
        const allMonths = [...new Set([...predM, ...histM])].sort((a, b) => a - b);

        const years = data.sales_history ? [...new Set(data.sales_history.map(s => s.year))].sort((a, b) => a - b) : [];

        return allMonths.map(month => {
            const row = { month, monthName: MONTH_NAMES[month - 1] };
            years.forEach(year => {
                const sale = data.sales_history?.find(s => s.month === month && s.year === year);
                row[`y${year}`] = sale ? Math.round(sale.total_sales) : null;
            });
            const pred = data.predictions?.find(p => parseInt(p.date.slice(5, 7)) === month);
            if (pred) {
                row.predicted = Math.round(pred.predicted_ss);
                row.status = pred.is_approved ? "Onaylı" : "Öneri";
            }
            return row;
        });
    }, [data]);

    if (loading) return (
        <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
    );

    if (!data || (!data.predictions?.length && !data.sales_history?.length)) {
        return <div className="text-center py-8 text-gray-400 text-sm">Veri bulunamadı.</div>;
    }

    return (
        <div className="px-6 py-5 space-y-6 animate-in slide-in-from-top-2 duration-300">
            {/* Header & Line/Area Chart */}
            <div className="bg-gradient-to-br from-emerald-50/30 via-white to-slate-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                        <ShieldAlert size={16} className="text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-gray-700 text-sm">
                        {itemId} — Emniyet Stok Trend Analizi
                    </h3>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 p-2 shadow-sm">
                    <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickFormatter={val => {
                                    const parts = val.split('-');
                                    if (parts.length < 2) return val;
                                    const [y, m] = parts;
                                    return `${MONTH_NAMES[parseInt(m) - 1]} '${y.slice(2)}`;
                                }}
                                axisLine={{ stroke: '#e2e8f0' }}
                            />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />

                            <Area
                                type="monotone"
                                dataKey="requirement"
                                name="Gerçek Tüketim (BOM Patlatılmış)"
                                fill="#fecaca"
                                stroke="#ef4444"
                                fillOpacity={0.1}
                                strokeWidth={2}
                                dot={{ fill: "#ef4444", r: 3, strokeWidth: 1, stroke: "#fff" }}
                            />
                            <Line
                                type="monotone"
                                dataKey="aiHistory"
                                name="Geçmiş AI Önerisi"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ fill: "#3b82f6", r: 3, strokeWidth: 1, stroke: "#fff" }}
                            />
                            <Line
                                type="stepAfter"
                                dataKey="predicted"
                                name="Planlanan Emniyet Stok"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                dot={{ fill: "#10b981", r: 4, strokeWidth: 2, stroke: "#fff" }}
                                activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2, fill: "#fff" }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-gray-400 italic mt-2">
                    * Kırmızı alan geçmiş aylardaki BOM-patlatılmış toplam tüketimi (satış+üretim), mavi kesikli çizgi o zamanki AI önerisini, yeşil çizgi ise mevcut/gelecek planı ifade eder.
                </p>
            </div>

            {/* Table Section */}
            {!hideTable && monthHistory.length > 0 && historyYears.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm mt-4">
                    <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-emerald-50/30 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-700 text-sm">
                            Hedef/Gerçekleşen Analizi — Son {historyYears.length} Yıl
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-4 py-3 text-left font-semibold text-gray-500 text-xs uppercase">Ay</th>
                                    {historyYears.map(y => (
                                        <th key={y} className="px-4 py-3 text-right font-semibold text-gray-500 text-xs uppercase">
                                            {y} (Gerçek)
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right font-semibold text-emerald-600 text-xs uppercase bg-emerald-50/50">
                                        Emniyet Stok
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
                                        <td className="px-4 py-2.5 text-right font-bold text-emerald-600 bg-emerald-50/30 tabular-nums flex items-center justify-end gap-2">
                                            {row.predicted != null ? row.predicted.toLocaleString("tr-TR") : "—"}
                                            {row.status && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${row.status === 'Onaylı' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                                                    {row.status}
                                                </span>
                                            )}
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

export default SafetyStockDetailChart;
