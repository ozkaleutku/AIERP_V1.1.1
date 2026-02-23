import { useState, useMemo, useEffect } from "react";
import { Search, RefreshCw, CheckCircle2, Edit2, Save, X } from "lucide-react";
import api from "../api";
import toast from "react-hot-toast";
import ConfirmModal from "../components/ConfirmModal";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const DemandForecast = () => {
    const [forecasts, setForecasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [filters, setFilters] = useState({
        itemId: "",
        startDate: "",
        endDate: "",
    });

    // Editing State
    const [editingKey, setEditingKey] = useState(null); // combined item_id and date
    const [editAmount, setEditAmount] = useState("");
    const [isApproved, setIsApproved] = useState(
        localStorage.getItem("forecast_approved") === "true"
    );

    // Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState({ isOpen: false, title: "", message: "", onConfirm: () => { }, type: "danger" });

    // Fetch Forecasts on Mount
    useEffect(() => {
        fetchForecasts();
    }, []);

    const fetchForecasts = async () => {
        setLoading(true);
        try {
            const response = await api.get("/forecast/temporary");
            setForecasts(response.data);
            // Reset approved state when fetching fresh data if needed, 
            // but usually approval is a session-based lock for current draft
        } catch (error) {
            console.error("Error fetching forecasts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRecalculate = async () => {
        setCalculating(true);
        const toastId = toast.loading("Tahminler hesaplanıyor...");
        try {
            await api.post("/forecast/calculate");
            await fetchForecasts();
            setIsApproved(false);
            localStorage.setItem("forecast_approved", "false"); // Persist state
            toast.success("Tahminler güncellendi.", { id: toastId });
        } catch (error) {
            console.error("Error recalculating:", error);
            toast.error("Hesaplama sırasında hata oluştu.", { id: toastId });
        } finally {
            setCalculating(false);
        }
    };

    const triggerRecalculate = () => {
        setConfirmAction({
            isOpen: true,
            title: "Tahminleri Yeniden Hesapla",
            message: "Bütün tahminleri yeniden hesaplamak istediğinize emin misiniz? Bu işlem biraz zaman alabilir.",
            onConfirm: handleRecalculate,
            type: "warning"
        });
    };

    const handleApprove = async () => {
        const toastId = toast.loading("Tahminler onaylanıyor...");
        try {
            await api.post("/forecast/approve");
            setIsApproved(true);
            localStorage.setItem("forecast_approved", "true"); // Persist state
            toast.success("Tahminler başarıyla onaylandı ve kaydedildi.", { id: toastId });
        } catch (error) {
            console.error("Error approving:", error);
            toast.error("Onaylama başarısız oldu.", { id: toastId });
        }
    };

    const triggerApprove = () => {
        setConfirmAction({
            isOpen: true,
            title: "Tahminleri Onayla",
            message: "Bu tahminleri onaylayıp geçmiş verilerine kaydetmek istediğinize emin misiniz?",
            onConfirm: handleApprove,
            type: "info"
        });
    };

    const startEditing = (item) => {
        if (isApproved) return;
        setEditingKey(`${item.item_id}-${item.date}`);
        setEditAmount(Math.round(item.amount).toString());
    };

    const cancelEditing = () => {
        setEditingKey(null);
        setEditAmount("");
    };

    const saveEditing = async (item_id, date) => {
        const toastId = toast.loading("Güncelleniyor...");
        try {
            await api.put("/forecast/update", {
                item_id,
                date,
                amount: parseFloat(editAmount)
            });

            setForecasts(prev => prev.map(f =>
                (f.item_id === item_id && f.date === date)
                    ? { ...f, amount: parseFloat(editAmount) }
                    : f
            ));

            toast.success("Tahmin güncellendi.", { id: toastId });
            setEditingKey(null);
        } catch (error) {
            console.error("Error updating forecast:", error);
            toast.error("Güncelleme başarısız.", { id: toastId });
        }
    };

    const clearFilters = () => {
        setFilters({
            itemId: "",
            startDate: "",
            endDate: "",
        });
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return forecasts.filter((item) => {
            const matchesId = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());
            const matchesStart = !filters.startDate || item.date >= filters.startDate;
            const matchesEnd = !filters.endDate || item.date <= filters.endDate;
            return matchesId && matchesStart && matchesEnd;
        });
    }, [forecasts, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    if (loading && !calculating) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex-shrink-0 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        Tahminleme
                    </h1>
                    <p className="text-gray-500 mt-1">Gelecek dönem talep ve üretim tahminleri.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={triggerApprove}
                        disabled={loading || filteredData.length === 0 || isApproved}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white shadow-lg active:scale-95 transition-all
                            ${isApproved ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 shadow-green-500/20"}`}
                    >
                        <CheckCircle2 size={20} />
                        <span>{isApproved ? "Onaylandı" : "Onayla"}</span>
                    </button>
                    <button
                        onClick={triggerRecalculate}
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
            <div className="flex-shrink-0 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
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

                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleInputChange}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium text-gray-700"
                        title="Başlangıç Tarihi"
                    />
                    <input
                        type="date"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleInputChange}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium text-gray-700"
                        title="Bitiş Tarihi"
                    />
                </div>

                <div className="flex items-center gap-3 ml-auto">
                    <button
                        onClick={clearFilters}
                        className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-200"
                    >
                        Temizle
                    </button>

                    {isApproved && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 text-sm font-medium animate-in slide-in-from-right-2 duration-300">
                            <CheckCircle2 size={16} />
                            Düzenleme Kilitli
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 relative">
                <div className="flex-1 overflow-y-auto w-full">
                    <table className="w-full relative">
                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tahmin Edilen Miktar</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.length > 0 ? (
                                visibleData.map((item, index) => {
                                    const key = `${item.item_id}-${item.date}`;
                                    const isEditing = editingKey === key;
                                    return (
                                        <tr key={`${key}-${index}`} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? "bg-indigo-50/30" : ""}`}>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{item.date}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                            <td className="px-6 py-4 text-sm">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editAmount}
                                                        onChange={(e) => setEditAmount(e.target.value)}
                                                        className="w-32 px-2 py-1 border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-indigo-700"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="font-bold text-indigo-600">
                                                        {Math.round(item.amount)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => saveEditing(item.item_id, item.date)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Kaydet"
                                                        >
                                                            <Save size={18} />
                                                        </button>
                                                        <button
                                                            onClick={cancelEditing}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="İptal"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEditing(item)}
                                                        disabled={isApproved}
                                                        className={`p-1.5 rounded-lg transition-colors ${isApproved
                                                            ? "text-gray-300 cursor-not-allowed"
                                                            : "text-indigo-600 hover:bg-indigo-50"}`}
                                                        title="Düzenle"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        Tahmin verisi bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {/* Infinite scroll loader */}
                    {hasMore && (
                        <div ref={loaderRef} className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    )}
                    <div className="text-center text-sm text-gray-400 py-2">
                        {visibleCount} / {totalCount} kayıt gösteriliyor
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmAction.isOpen}
                onClose={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                onConfirm={confirmAction.onConfirm}
                title={confirmAction.title}
                message={confirmAction.message}
                type={confirmAction.type}
            />
        </div>
    );
};

export default DemandForecast;
