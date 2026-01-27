import { useState, useMemo, useEffect } from "react";
import { Search, RefreshCw, CheckCircle2 } from "lucide-react";
import api from "../api";

const DemandForecast = () => {
    const [forecasts, setForecasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [filters, setFilters] = useState({
        itemId: "",
    });

    // Fetch Forecasts on Mount
    useEffect(() => {
        fetchForecasts();
    }, []);

    const fetchForecasts = async () => {
        setLoading(true);
        try {
            const response = await api.get("/forecast/temporary");
            setForecasts(response.data);
        } catch (error) {
            console.error("Error fetching forecasts:", error);
        } finally {
            setLoading(false);
        }
    };

    // Recalculate Logic
    const handleRecalculate = async () => {
        if (!window.confirm("Bütün tahminleri yeniden hesaplamak istediğinize emin misiniz? Bu işlem biraz zaman alabilir.")) {
            return;
        }

        setCalculating(true);
        try {
            // Trigger calculation - usually triggers background job
            await api.post("/forecast/calculate");
            await fetchForecasts();
            alert("Tahminler güncellendi.");
        } catch (error) {
            console.error("Error recalculating:", error);
            alert("Hesaplama sırasında hata oluştu.");
        } finally {
            setCalculating(false);
        }
    };

    const handleApprove = async () => {
        if (!window.confirm("Bu tahminleri onaylayıp geçmiş verilerine kaydetmek istediğinize emin misiniz?")) {
            return;
        }
        try {
            await api.post("/forecast/approve");
            alert("Tahminler başarıyla onaylandı ve kaydedildi.");
        } catch (error) {
            console.error("Error approving:", error);
            alert("Onaylama başarısız oldu.");
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return forecasts.filter((item) => {
            return item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());
        });
    }, [forecasts, filters]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    if (loading && !calculating) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        Tahminleme
                    </h1>
                    <p className="text-gray-500 mt-1">Gelecek dönem talep ve üretim tahminleri.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleApprove}
                        disabled={loading || filteredData.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                    >
                        <CheckCircle2 size={20} />
                        <span>Onayla</span>
                    </button>
                    <button
                        onClick={handleRecalculate}
                        disabled={calculating}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 ${calculating
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
                            }`}
                    >
                        <RefreshCw size={20} className={calculating ? "animate-spin" : ""} />
                        <span>{calculating ? "Hesaplanıyor..." : "Hesapla"}</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="itemId"
                        placeholder="Ürün Kodu Ara..."
                        value={filters.itemId}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tahmin Edilen Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Güven Aralığı</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.length > 0 ? (
                                filteredData.map((item, index) => (
                                    <tr key={`${item.item_id}-${item.date}-${index}`} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">{item.date}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-indigo-600">
                                            {Math.round(item.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            ± 5% {/* Mock confidence interval if not in API */}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        Tahmin verisi bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DemandForecast;
