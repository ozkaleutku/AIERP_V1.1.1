import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, ShieldCheck, Play, Loader2, Calendar, Layers } from "lucide-react";
import api from "../../../api";
import toast from "react-hot-toast";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { useInfiniteScroll } from "../../../shared/hooks/useInfiniteScroll";

const formatQuantity = (value, unit) => {
    if (value == null) return "0";
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    if (unit && unit.toLowerCase() === "adet") {
        return Math.round(num).toString();
    }

    const hasDecimals = num % 1 !== 0;
    if (hasDecimals) {
        return parseFloat(num.toFixed(4)).toString();
    }
    return num.toString();
};

const SafetyStock = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [filters, setFilters] = useState({
        itemId: "",
        month: "", // Format: YYYY-MM
    });

    // Confirmation Modal State
    const [confirmCalculate, setConfirmCalculate] = useState(false);

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
        setCalculating(true);
        const toastId = toast.loading("AI hesaplaması başlatılıyor...");
        try {
            await api.post("/safety-stock/calculate");
            toast.success("Hesaplama tamamlandı. Karşılaştırma sayfasına yönlendiriliyorsunuz.", { id: toastId });
            navigate("/safety-stock/compare");
        } catch (error) {
            console.error("Calculation error:", error);
            toast.error("Hesaplama sırasında hata oluştu: " + (error.response?.data?.detail || error.message), { id: toastId });
        } finally {
            setCalculating(false);
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return data.filter((item) => {
            const matchesId = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());

            let matchesMonth = true;
            if (filters.month && item.date) {
                matchesMonth = String(item.date).startsWith(filters.month);
            }

            return matchesId && matchesMonth;
        });
    }, [data, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", month: "" });
    };


    const handleOpenCompare = () => {
        navigate("/safety-stock/compare");
    };

    if (loading && !data.length) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="h-full flex flex-col space-y-6">
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
                        onClick={() => setConfirmCalculate(true)}
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
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1 w-full md:w-auto">
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

                <div className="relative w-full md:w-48">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="month"
                        name="month"
                        value={filters.month}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                </div>

                <button
                    onClick={handleClearFilters}
                    className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-200 w-full md:w-auto"
                >
                    Temizle
                </button>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Ürün Kodu</th>
                                <th className="px-6 py-4">Emniyet Stoku (Hedef)</th>
                                <th className="px-6 py-4">Mevcut Stok</th>
                                <th className="px-6 py-4">Fark</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">{item.date}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{item.item_id}</td>
                                    <td className="px-6 py-4 font-bold text-emerald-600">{formatQuantity(item.safety_stock, item.item_quantity_type)} {item.item_quantity_type}</td>
                                    <td className="px-6 py-4 text-gray-600">{formatQuantity(item.current_stock, item.item_quantity_type)} {item.item_quantity_type}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${item.stock_difference < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {formatQuantity(Math.abs(item.stock_difference), item.item_quantity_type)} {item.stock_difference < 0 ? 'Eksik' : 'Fazla'}
                                        </span>
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

            <ConfirmModal
                isOpen={confirmCalculate}
                onClose={() => setConfirmCalculate(false)}
                onConfirm={handleCalculate}
                title="AI Hesaplamayı Başlat"
                message="Bu işlem yeni bir AI hesaplaması başlatacak ve sizi karşılaştırma sayfasına yönlendirecektir. Onaylamadığınız sürece mevcut veriler değişmez. Devam etmek istiyor musunuz?"
                type="warning"
                confirmText="Hesaplamayı Başlat"
            />
        </div>
    );
};

export default SafetyStock;
