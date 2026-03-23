import { useState, useMemo, useEffect, Fragment } from "react";
import {
    Search, Layers, ArrowLeft, Save, CheckCircle,
    ChevronDown, ChevronUp
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../../api";
import toast from "react-hot-toast";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import SafetyStockDetailChart from "../components/SafetyStockDetailChart";

const MONTH_NAMES = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"
];

const formatQuantity = (value, unit) => {
    if (value == null) return "0";
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    if (unit && unit.toLowerCase() === "adet") {
        return Math.round(num).toLocaleString("tr-TR");
    }

    const hasDecimals = num % 1 !== 0;
    if (hasDecimals) {
        return parseFloat(num.toFixed(2)).toLocaleString("tr-TR");
    }
    return num.toLocaleString("tr-TR");
};

/* ── Expanded content for a single product ── */
const ProductExpandedContent = ({ product, onRowApprove, onPreferenceChange, onManualChange }) => {
    return (
        <div className="border-t border-gray-100 p-6 bg-gray-50/30 animate-in slide-in-from-top-2 duration-300">
            {/* AI Chart Component */}
            <div className="mb-8">
                <SafetyStockDetailChart itemId={product.item_id} hideTable={true} />
            </div>

            {/* Inline Monthly 12-Month Approval Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-emerald-50/30 border-b border-gray-200 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800 text-sm">Aylık Emniyet Stok Onay Tablosu</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-5 py-3 text-left font-semibold text-gray-500 uppercase text-xs">Tarih</th>
                                <th className="px-5 py-3 text-right font-semibold text-emerald-600 uppercase text-xs bg-emerald-50/30">AI Sonucu</th>
                                <th className="px-5 py-3 text-right font-semibold text-blue-600 uppercase text-xs bg-blue-50/30">Formül</th>
                                <th className="px-5 py-3 text-right font-semibold text-orange-600 uppercase text-xs bg-orange-50/30">Manuel Giriş</th>
                                <th className="px-5 py-3 text-center font-semibold text-gray-500 uppercase text-xs">Tercih</th>
                                <th className="px-5 py-3 text-right font-semibold text-gray-700 uppercase text-xs bg-gray-50">Sonuç</th>
                                <th className="px-5 py-3 text-right font-semibold text-gray-500 uppercase text-xs">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {product.months.map((row) => {
                                const monthIndex = parseInt(row.date.slice(5, 7), 10);
                                const monthName = MONTH_NAMES[monthIndex - 1];
                                const yearStr = row.date.slice(0, 4);
                                const displayDate = `${monthName} ${yearStr}`;

                                return (
                                    <tr key={row.ui_id} className={row.isApproved ? "bg-gray-50/40 text-gray-500" : "hover:bg-emerald-50/20"}>
                                        <td className="px-5 py-3 font-medium whitespace-nowrap">{displayDate}</td>

                                        {/* AI Result */}
                                        <td className="px-5 py-3 text-right font-bold text-emerald-600 bg-emerald-50/20 tabular-nums">
                                            {formatQuantity(row.amount, row.item_quantity_type)}
                                            <span className="text-xs font-normal text-gray-400 ml-1">{row.item_quantity_type}</span>
                                        </td>

                                        {/* Formula Result */}
                                        <td className="px-5 py-3 text-right text-blue-700 bg-blue-50/20 tabular-nums">
                                            {formatQuantity(row.formula_result, row.item_quantity_type)}
                                        </td>

                                        {/* Manual Input */}
                                        <td className="px-5 py-3 text-right bg-orange-50/20">
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-24 border border-orange-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-gray-700 bg-white text-right"
                                                value={row.manualInput}
                                                onChange={(e) => onManualChange(row.ui_id, e.target.value)}
                                                placeholder="Miktar"
                                            />
                                        </td>

                                        {/* Preference Dropdown */}
                                        <td className="px-5 py-3 text-center">
                                            <select
                                                className={`border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer text-xs ${row.isApproved ? "bg-gray-50 text-gray-500 border-transparent" : "bg-white focus:border-emerald-500"}`}
                                                value={row.preference}
                                                onChange={(e) => onPreferenceChange(row.ui_id, e.target.value)}
                                            >
                                                <option value="AI">AI (Öneri)</option>
                                                <option value="Formula">Formül</option>
                                                <option value="Manual">Manuel</option>
                                            </select>
                                        </td>

                                        {/* Final Result */}
                                        <td className={`px-5 py-3 text-right font-bold tabular-nums ${row.isApproved ? "text-gray-500" : "text-gray-900"} bg-gray-50/30`}>
                                            {formatQuantity(row.finalAmount, row.item_quantity_type)}
                                            <span className="text-xs font-normal text-gray-400 ml-1">{row.item_quantity_type}</span>
                                        </td>

                                        {/* Approve Button */}
                                        <td className="px-5 py-3 text-right">
                                            {row.isApproved ? (
                                                <button disabled className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg font-medium text-xs cursor-not-allowed border border-gray-200 ml-auto">
                                                    <CheckCircle size={14} /> Onaylandı
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onRowApprove(row)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm font-medium text-xs active:scale-95 transition-all ml-auto"
                                                >
                                                    <CheckCircle size={14} /> Onayla
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/* ── Main Component ── */
const SafetyStockComparison = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [comparisonData, setComparisonData] = useState([]);

    const [filters, setFilters] = useState({ itemId: "" });
    const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
    const [expandedItemKey, setExpandedItemKey] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await api.get("/safety-stock/temporary");

            // Initialize comparison data structure
            const initial = response.data.map((item, index) => {
                let manualInput = item.active_safety_stock !== undefined && item.active_safety_stock !== null ? item.active_safety_stock : "";

                // Default to AI, unless we have a saved preference from the database
                let preference = "AI";
                let finalAmount = item.amount;
                let isApproved = false;

                if (item.active_safety_stock !== undefined && item.active_safety_stock !== null) {
                    isApproved = true;

                    if (item.active_preference) {
                        preference = item.active_preference;
                    }

                    if (preference === "AI") {
                        finalAmount = item.amount;
                    } else if (preference === "Formula") {
                        finalAmount = item.formula_result;
                    } else if (preference === "Manual") {
                        const activeVal = parseFloat(item.active_safety_stock) || 0;
                        manualInput = activeVal;
                        finalAmount = activeVal;
                    }
                }

                return {
                    ...item,
                    ui_id: `v_${Date.now()}_${index}`,
                    preference,
                    manualInput,
                    finalAmount,
                    isApproved
                };
            });
            setComparisonData(initial);
        } catch (error) {
            console.error("Error fetching safety stock data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePreferenceChange = (ui_id, value) => {
        setComparisonData(prev => prev.map(row => {
            if (row.ui_id !== ui_id) return row;
            let finalAmount = row.amount;
            if (value === "Formula") finalAmount = row.formula_result || 0;
            else if (value === "Manual") finalAmount = parseFloat(row.manualInput) || 0;
            return { ...row, preference: value, finalAmount, isApproved: false };
        }));
    };

    const handleManualChange = (ui_id, value) => {
        setComparisonData(prev => prev.map(row => {
            if (row.ui_id !== ui_id) return row;
            const updated = { ...row, manualInput: value, isApproved: false };
            if (row.preference === "Manual") {
                updated.finalAmount = parseFloat(value) || 0;
            }
            return updated;
        }));
    };

    const handleRowApprove = async (row) => {
        const tid = toast.loading("Onaylanıyor...");
        try {
            await api.post("/safety-stock/approve", [{
                item_id: row.item_id,
                date: row.date,
                amount: row.finalAmount,
                item_quantity_type: row.item_quantity_type,
                preference: row.preference
            }]);
            toast.success("Onaylandı!", { id: tid });

            // Update state locally
            setComparisonData(prev => prev.map(r =>
                r.ui_id === row.ui_id ? { ...r, isApproved: true } : r
            ));
        } catch (err) {
            toast.error("Hata!", { id: tid });
        }
    };

    const handleBulkApprove = async () => {
        const payload = comparisonData.map(item => ({
            item_id: item.item_id,
            date: item.date,
            amount: item.finalAmount,
            item_quantity_type: item.item_quantity_type,
            preference: item.preference
        }));

        const toastId = toast.loading("Emniyet stokları güncelleniyor...");
        try {
            await api.post("/safety-stock/approve", payload);
            toast.success("Emniyet stokları başarıyla güncellendi!", { id: toastId });
            // Mark all as approved
            setComparisonData(prev => prev.map(r => ({ ...r, isApproved: true })));
        } catch (error) {
            console.error("Approval error:", error);
            toast.error("Onaylama sırasında hata oluştu.", { id: toastId });
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ itemId: "" });
    };

    // Filter
    const filteredData = useMemo(() => {
        return comparisonData.filter(item => {
            return item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());
        });
    }, [comparisonData, filters]);

    // Group by product
    const groupedProducts = useMemo(() => {
        const productMap = {};
        filteredData.forEach(item => {
            if (!productMap[item.item_id]) {
                productMap[item.item_id] = {
                    item_id: item.item_id,
                    item_quantity_type: item.item_quantity_type,
                    totalAI: 0,
                    approvedCount: 0,
                    totalCount: 0,
                    months: []
                };
            }
            productMap[item.item_id].totalAI += parseFloat(item.amount) || 0;
            productMap[item.item_id].totalCount += 1;
            if (item.isApproved) productMap[item.item_id].approvedCount += 1;
            productMap[item.item_id].months.push(item);
        });

        // Sort months within each product
        Object.values(productMap).forEach(prod => {
            prod.months.sort((a, b) => a.date.localeCompare(b.date));
        });

        return Object.values(productMap).sort((a, b) => a.item_id.localeCompare(b.item_id));
    }, [filteredData]);

    if (loading) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                    <p className="text-gray-500 mt-1">Ürün bazlı AI, Formül ve Manuel değerleri karşılaştırıp nihai stoğu belirleyin.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsApproveConfirmOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                        <Save size={20} />
                        Hepsini Onayla ve Kaydet
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex-shrink-0 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
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
                        {groupedProducts.map(p => (
                            <option key={p.item_id} value={p.item_id} />
                        ))}
                    </datalist>
                </div>

                <button
                    onClick={clearFilters}
                    className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-200"
                >
                    Temizle
                </button>
            </div>

            {/* Product Cards */}
            <div className="flex-1 overflow-y-auto">
                {groupedProducts.length > 0 ? (
                    <div className="space-y-4">
                        {groupedProducts.map((product) => {
                            const isExpanded = expandedItemKey === product.item_id;
                            const allApproved = product.approvedCount === product.totalCount;

                            return (
                                <div key={product.item_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    {/* Product Main Row */}
                                    <div
                                        onClick={() => setExpandedItemKey(isExpanded ? null : product.item_id)}
                                        className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{product.item_id}</h3>
                                                <p className="text-sm text-gray-500">
                                                    Toplam AI Önerisi: <span className="font-semibold text-emerald-600">{formatQuantity(product.totalAI, product.item_quantity_type)} {product.item_quantity_type}</span>
                                                    <span className="mx-2">|</span>
                                                    Onay: <span className={`font-semibold ${allApproved ? "text-gray-400" : "text-orange-600"}`}>{product.approvedCount}/{product.totalCount}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {allApproved && (
                                            <div className="flex items-center gap-1.5 text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200">
                                                <CheckCircle size={14} /> Tümü Onaylı
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <ProductExpandedContent
                                            product={product}
                                            onRowApprove={handleRowApprove}
                                            onPreferenceChange={handlePreferenceChange}
                                            onManualChange={handleManualChange}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-gray-400 text-center py-20 bg-white rounded-2xl border border-gray-100">
                        Gösterilecek ürün veya emniyet stoğu bulunamadı.
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={isApproveConfirmOpen}
                onClose={() => setIsApproveConfirmOpen(false)}
                onConfirm={handleBulkApprove}
                title="Tümünü Onayla"
                message="Tüm emniyet stoklarını mevcut tercihler ile onaylamak istediğinize emin misiniz?"
                type="info"
            />
        </div>
    );
};

export default SafetyStockComparison;
