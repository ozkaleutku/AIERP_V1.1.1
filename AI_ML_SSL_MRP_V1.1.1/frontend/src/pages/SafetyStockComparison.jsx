import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Layers, Calendar, ArrowLeft, Save, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";
import ConfirmModal from "../components/ConfirmModal";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

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

const SafetyStockComparison = () => {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [comparisonData, setComparisonData] = useState([]);

    const [filters, setFilters] = useState({
        itemId: "",
        month: ""
    });

    const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await api.get("/safety-stock/temporary");
            setData(response.data);

            // Initialize comparison data structure
            const initial = response.data.map((item, index) => {
                let preference = "AI";
                let manualInput = "";
                let finalAmount = item.amount;

                if (item.active_safety_stock !== undefined && item.active_safety_stock !== null) {
                    const activeVal = parseFloat(item.active_safety_stock) || 0;
                    const aiVal = parseFloat(item.amount) || 0;
                    const formVal = parseFloat(item.formula_result) || 0;

                    if (Math.abs(activeVal - aiVal) < 0.001) {
                        preference = "AI";
                        finalAmount = item.amount;
                    } else if (Math.abs(activeVal - formVal) < 0.001) {
                        preference = "Formula";
                        finalAmount = item.formula_result;
                    } else {
                        preference = "Manual";
                        manualInput = activeVal;
                        finalAmount = activeVal;
                    }
                }

                return {
                    ...item,
                    ui_id: `v_${Date.now()}_${index}`, // Unique identifier for reliable indexing
                    preference,
                    manualInput,
                    finalAmount
                };
            });
            setComparisonData(initial);
        } catch (error) {
            console.error("Error fetching safety stock data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Removed availableLevels memo as it's no longer used

    const handlePreferenceChange = (index, value) => {
        const newData = [...comparisonData];
        newData[index].preference = value;

        // Update final amount based on selection
        if (value === "AI") newData[index].finalAmount = newData[index].amount;
        else if (value === "Formula") newData[index].finalAmount = newData[index].formula_result || 0;
        else if (value === "Manual") newData[index].finalAmount = parseFloat(newData[index].manualInput) || 0;

        setComparisonData(newData);
    };

    const handleManualChange = (index, value) => {
        const newData = [...comparisonData];
        newData[index].manualInput = value;
        if (newData[index].preference === "Manual") {
            newData[index].finalAmount = parseFloat(value) || 0;
        }
        setComparisonData(newData);
    };

    const filteredData = useMemo(() => {
        return comparisonData.filter(item => {
            const matchesId = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());
            const matchesMonth = filters.month ? item.date.startsWith(filters.month) : true;
            return matchesId && matchesMonth;
        });
    }, [comparisonData, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleApprove = async () => {
        const payload = comparisonData.map(item => ({
            item_id: item.item_id,
            date: item.date,
            amount: item.finalAmount,
            item_quantity_type: item.item_quantity_type
        }));

        const toastId = toast.loading("Emniyet stokları güncelleniyor...");
        try {
            await api.post("/safety-stock/approve", payload);
            toast.success("Emniyet stokları başarıyla güncellendi!", { id: toastId });
            navigate("/safety-stock");
        } catch (error) {
            console.error("Approval error:", error);
            toast.error("Onaylama sırasında hata oluştu.", { id: toastId });
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", month: "" });
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

    return (
        <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col space-y-6 animate-in fade-in duration-300 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => navigate("/safety-stock")}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2 transition-colors"
                    >
                        <ArrowLeft size={18} /> Geri Dön
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        <Layers className="text-emerald-600" /> Karşılaştırma ve Onay
                    </h1>
                    <p className="text-gray-500 mt-1">AI, Formül ve Manuel değerleri karşılaştırıp nihai stoğu belirleyin.</p>
                </div>
                <div>
                    <button
                        onClick={() => setIsApproveConfirmOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                        <Save size={20} />
                        Onayla ve Kaydet
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
                        list="compare-item-options"
                    />
                    <datalist id="compare-item-options">
                        {[...new Set(comparisonData.map(d => d.item_id))].map(id => (
                            <option key={id} value={id} />
                        ))}
                    </datalist>
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

            {/* Comparison Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Ürün</th>
                                <th className="px-6 py-4 bg-emerald-50 text-emerald-700 border-l border-emerald-100">AI Sonucu</th>
                                <th className="px-6 py-4 bg-blue-50 text-blue-700 border-l border-blue-100">Formül</th>
                                <th className="px-6 py-4 bg-orange-50 text-orange-700 border-l border-orange-100">Manuel Giriş</th>
                                <th className="px-6 py-4 border-l border-gray-200">Tercih</th>
                                <th className="px-6 py-4 bg-gray-100 font-bold border-l border-gray-200">Sonuç</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((row) => {
                                // Use unique ui_id to find exact index in original array
                                const realIndex = comparisonData.findIndex(
                                    (d) => d.ui_id === row.ui_id
                                );

                                return (
                                    <tr key={row.ui_id} className="bg-white hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-gray-600">{row.date}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{row.item_id}</td>

                                        <td className="px-6 py-4 font-bold text-emerald-600 bg-emerald-50/30 border-l border-emerald-100">
                                            {formatQuantity(row.amount, row.item_quantity_type)} <span className="text-xs font-normal text-gray-500">{row.item_quantity_type}</span>
                                        </td>

                                        <td className="px-6 py-4 text-blue-700 bg-blue-50/30 border-l border-blue-100">
                                            {formatQuantity(row.formula_result, row.item_quantity_type)}
                                        </td>

                                        <td className="px-6 py-4 bg-orange-50/30 border-l border-orange-100">
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-24 border border-orange-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-gray-700 bg-white"
                                                value={row.manualInput}
                                                onChange={(e) => handleManualChange(realIndex, e.target.value)}
                                                placeholder="Amount"
                                            />
                                        </td>

                                        <td className="px-6 py-4 border-l border-gray-200">
                                            <select
                                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                                                value={row.preference}
                                                onChange={(e) => handlePreferenceChange(realIndex, e.target.value)}
                                            >
                                                <option value="AI">AI (Öneri)</option>
                                                <option value="Formula">Formül</option>
                                                <option value="Manual">Manuel</option>
                                            </select>
                                        </td>

                                        <td className="px-6 py-4 font-bold text-gray-900 bg-gray-50 border-l border-gray-200">
                                            {formatQuantity(row.finalAmount, row.item_quantity_type)} <span className="text-xs font-normal text-gray-500">{row.item_quantity_type}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                        Filtrelere uygun kayıt bulunamadı.
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
                isOpen={isApproveConfirmOpen}
                onClose={() => setIsApproveConfirmOpen(false)}
                onConfirm={handleApprove}
                title="Emniyet Stoklarını Onayla"
                message="Bu tabloyu 'Nihai Emniyet Stoğu' olarak kaydetmek istediğinize emin misiniz? (Önceki kayıtlar silinecektir)"
                confirmText="Onayla ve Kaydet"
                type="warning"
            />
        </div>
    );
};

export default SafetyStockComparison;
