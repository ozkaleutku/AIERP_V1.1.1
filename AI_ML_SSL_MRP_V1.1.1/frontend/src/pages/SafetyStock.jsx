import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, ShieldCheck, Play, Loader2, Calendar, Layers } from "lucide-react";
import api from "../api";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const SafetyStock = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [filters, setFilters] = useState({
        itemId: "",
        level: "",
        month: "", // Format: YYYY-MM
        itemType: "",
    });

    // Fetch Data on Mount
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await api.get("/safety-stock");
            setData(response.data);
        } catch (error) {
            console.error("Error fetching safety stock data:", error);
        } finally {
            setLoading(false);
        }
    };

    const navigate = useNavigate();

    const handleCalculate = async () => {
        // Warning dialog as requested
        if (!window.confirm("Bu işlem yeni bir AI hesaplaması başlatacak ve sizi karşılaştırma sayfasına yönlendirecektir. Onaylamadığınız sürece mevcut veriler değişmez. Devam etmek istiyor musunuz?")) return;

        setCalculating(true);
        try {
            await api.post("/safety-stock/calculate");
            navigate("/safety-stock/compare");
        } catch (error) {
            console.error("Calculation error:", error);
            alert("Hesaplama sırasında hata oluştu: " + (error.response?.data?.detail || error.message));
        } finally {
            setCalculating(false);
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return data.filter((item) => {
            const matchesId = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());


            let matchesMonth = true;
            if (filters.month) {
                // item.date format YYYY-MM-DD
                matchesMonth = item.date.startsWith(filters.month);
            }

            // itemType might come from join
            const matchesType = filters.itemType ? item.item_quantity_type === filters.itemType : true; // Note: filter logic might need adjustment if column name differs

            return matchesId && matchesMonth && matchesType;
        });
    }, [data, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", level: "", month: "", itemType: "" });
    };


    const handleOpenCompare = () => {
        navigate("/safety-stock/compare");
    };

    if (loading && !data.length) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-2">
                        <ShieldCheck className="text-emerald-600" /> Emniyet Stoku (Nihai)
                    </h1>
                    <p className="text-gray-500 mt-1">Onaylanmış nihai emniyet stokları ve mevcut stok durumu.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleCalculate}
                        disabled={calculating}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium transition-all shadow-lg shadow-emerald-500/20 active:scale-95 ${calculating ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                    >
                        {calculating ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                        <span>{calculating ? "Hesaplanıyor..." : "AI Hesaplamayı Başlat"}</span>
                    </button>
                    {/* Compare Button redundant if Calculate redirects, but keep for manual navigation */}
                    <button
                        onClick={handleOpenCompare}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-emerald-700 bg-emerald-100 hover:bg-emerald-200 font-medium transition-all"
                    >
                        <Layers size={20} />
                        Karşılaştırma
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            name="itemId"
                            placeholder="Ürün Kodu Ara..."
                            value={filters.itemId}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    {/* Level Filter removed as it might not be relevant for Final Table or data structure changed */}

                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="month"
                            name="month"
                            value={filters.month}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={handleClearFilters}
                        className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-200"
                    >
                        Filtreleri Temizle
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Emniyet Stoku (Hedef)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mevcut Stok</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fark</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.date}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">{item.safety_stock} {item.item_quantity_type}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{item.current_stock}</td>
                                    <td className={`px-6 py-4 text-sm font-bold ${item.stock_difference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {item.stock_difference}
                                    </td>
                                </tr>
                            ))}
                            {visibleData.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        Veri bulunamadı. Lütfen "AI Hesaplamayı Başlat" ile yeni bir hesaplama yapın ve onaylayın.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {/* Infinite scroll loader */}
                    {hasMore && (
                        <div ref={loaderRef} className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    )}
                    <div className="text-center text-sm text-gray-400 py-2">
                        {visibleCount} / {totalCount} kayıt gösteriliyor
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SafetyStock;
