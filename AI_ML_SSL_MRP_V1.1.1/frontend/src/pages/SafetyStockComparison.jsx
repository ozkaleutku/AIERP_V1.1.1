import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Layers, Calendar, ArrowLeft, Save, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const SafetyStockComparison = () => {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [comparisonData, setComparisonData] = useState([]);

    const [filters, setFilters] = useState({
        itemId: "",
        level: "",
        month: ""
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await api.get("/safety-stock/temporary");
            setData(response.data);

            // Initialize comparison data structure
            const initial = response.data.map(item => ({
                ...item,
                preference: "AI", // Default
                manualInput: "",
                finalAmount: item.amount // Default to AI amount
            }));
            setComparisonData(initial);
        } catch (error) {
            console.error("Error fetching safety stock data:", error);
        } finally {
            setLoading(false);
        }
    };

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
            const matchesLevel = filters.level ? item.status === filters.level : true;
            const matchesMonth = filters.month ? item.date.startsWith(filters.month) : true;
            return matchesId && matchesLevel && matchesMonth;
        });
    }, [comparisonData, filters]);

    const handleApprove = async () => {
        if (!window.confirm("Bu tabloyu 'Nihai Emniyet Stoğu' olarak kaydetmek istediğinize emin misiniz? (Önceki kayıtlar silinecektir)")) return;

        const payload = comparisonData.map(item => ({
            item_id: item.item_id,
            date: item.date,
            amount: item.finalAmount,
            item_quantity_type: item.item_quantity_type
        }));

        try {
            await api.post("/safety-stock/approve", payload);
            alert("Emniyet stokları başarıyla güncellendi!");
            navigate("/safety-stock");
        } catch (error) {
            console.error("Approval error:", error);
            alert("Onaylama sırasında hata oluştu.");
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
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
                        onClick={handleApprove}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                        <Save size={20} />
                        Onayla ve Kaydet
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        list="compare-item-options"
                        placeholder="Ürün Ara..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        onChange={(e) => setFilters(prev => ({ ...prev, itemId: e.target.value }))}
                    />
                    <datalist id="compare-item-options">
                        {[...new Set(comparisonData.map(d => d.item_id))].map(id => (
                            <option key={id} value={id} />
                        ))}
                    </datalist>
                </div>

                <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                        onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                    >
                        <option value="">Tüm Seviyeler</option>
                        <option value="Level 0">Level 0</option>
                        <option value="Level 1">Level 1</option>
                        <option value="Level 2">Level 2</option>
                    </select>
                </div>

                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="month"
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                    />
                </div>
            </div>

            {/* Comparison Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Ürün</th>
                                <th className="px-6 py-4">Seviye</th>
                                <th className="px-6 py-4 bg-emerald-50 text-emerald-700 border-l border-emerald-100">AI Sonucu</th>
                                <th className="px-6 py-4 bg-blue-50 text-blue-700 border-l border-blue-100">Formül</th>
                                <th className="px-6 py-4 bg-orange-50 text-orange-700 border-l border-orange-100">Manuel Giriş</th>
                                <th className="px-6 py-4 border-l border-gray-200">Tercih</th>
                                <th className="px-6 py-4 bg-gray-100 font-bold border-l border-gray-200">Sonuç</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map((row, index) => {
                                // Important: We need the index in the ORIGINAL array to update state correctly
                                // But filteredData is a subset.
                                // Instead of index mapping, let's find the item in comparisonData by unique key if possible.
                                // However, simple mapping back is tricky if we don't have unique IDs. 
                                // Since we iterate filteredData, let's look up the index in the original data. 
                                // Better approach: Pass the actual item and find index. Or filteredData should be derived from comparisonData + indices?
                                // Let's just use comparisonData.indexOf(row) which is safe since row objects are references.
                                const realIndex = comparisonData.indexOf(row);

                                return (
                                    <tr key={index} className="bg-white hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-gray-600">{row.date}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{row.item_id}</td>
                                        <td className="px-6 py-4 text-gray-500">{row.status}</td>

                                        <td className="px-6 py-4 font-bold text-emerald-600 bg-emerald-50/30 border-l border-emerald-100">
                                            {row.amount} {row.item_quantity_type}
                                        </td>

                                        <td className="px-6 py-4 text-blue-700 bg-blue-50/30 border-l border-blue-100">
                                            {row.formula_result || 0}
                                        </td>

                                        <td className="px-6 py-4 bg-orange-50/30 border-l border-orange-100">
                                            <input
                                                type="number"
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
                                            {row.finalAmount}
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
                </div>
            </div>
        </div>
    );
};

export default SafetyStockComparison;
