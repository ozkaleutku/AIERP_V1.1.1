import { useState, useMemo, useEffect } from "react";
import { Search, Trash2, Edit2, X, CheckCircle2, History, Calendar } from "lucide-react";
import api from "../../../api";
import toast from "react-hot-toast";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { useInfiniteScroll } from "../../../shared/hooks/useInfiniteScroll";

const SalesHistory = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
        startDate: "",
        endDate: "",
    });

    // Inline Editing States
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Confirmation Modal State
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const response = await api.get("/sales");
            setSales(response.data);
        } catch (error) {
            console.error("Error fetching sales:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/sales/${id}`);
            toast.success("Satış kaydı silindi.");
            fetchSales();
        } catch (error) {
            console.error("Error deleting sale:", error);
            toast.error("Silme işlemi başarısız.");
        }
    };

    // Inline Updating
    const startEditing = (record) => {
        setEditingId(record.id);
        setEditForm({ ...record });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEditing = async () => {
        try {
            await api.put(`/sales/${editingId}`, {
                id: editingId,
                item_id: editForm.item_id,
                amount: parseFloat(editForm.amount),
                date: editForm.date
            });
            toast.success("Satış kaydı güncellendi.");
            fetchSales();
            setEditingId(null);
        } catch (error) {
            console.error("Error updating sale:", error);
            toast.error("Güncelleme başarısız.");
        }
    };

    // Filters
    const filteredData = useMemo(() => {
        return sales.filter((item) => {
            const matchesId = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());

            let matchesDate = true;
            if (filters.startDate) {
                matchesDate = matchesDate && new Date(item.date) >= new Date(filters.startDate);
            }
            if (filters.endDate) {
                matchesDate = matchesDate && new Date(item.date) <= new Date(filters.endDate);
            }

            return matchesId && matchesDate;
        });
    }, [sales, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", startDate: "", endDate: "" });
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <History className="text-purple-600" /> Satış Geçmişi
                    </h1>
                    <p className="text-gray-500 mt-1">Gerçekleşen satış çıkış kayıtları ve düzeltmeleri.</p>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4 shrink-0">
                <div className="relative flex-1 w-full md:min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="itemId"
                        placeholder="Ürün Kodu Ara..."
                        value={filters.itemId}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <div className="relative flex-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                            placeholder="Başlangıç Tarihi"
                        />
                    </div>
                    <span className="text-gray-400">-</span>
                    <div className="relative flex-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                            placeholder="Bitiş Tarihi"
                        />
                    </div>
                </div>
                <button
                    onClick={handleClearFilters}
                    className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-200 w-full md:w-auto"
                >
                    Temizle
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full relative">
                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sip No</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Müşteri</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((item) => {
                                const isEditing = editingId === item.id;
                                return (
                                    <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? "bg-purple-50/50" : ""}`}>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editForm.date}
                                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                                    className="border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500 outline-none"
                                                />
                                            ) : (
                                                item.date
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {item.item_id}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-800">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editForm.amount}
                                                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                                    className="w-24 border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500 outline-none"
                                                />
                                            ) : (
                                                item.amount
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {item.order_id ? `#${item.order_id}` : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {item.customer_name || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={saveEditing} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-lg">
                                                        <CheckCircle2 size={18} />
                                                    </button>
                                                    <button onClick={cancelEditing} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg">
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-lg">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => setConfirmDelete({ isOpen: true, id: item.id })} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {/* Infinite scroll loader */}
                    {hasMore && (
                        <div ref={loaderRef} className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    )}
                    <div className="text-center text-sm text-gray-400 py-2">
                        {visibleCount} / {totalCount} kayıt gösteriliyor
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={() => handleDelete(confirmDelete.id)}
                title="Satış Kaydını Sil"
                message="Bu satış kaydını silmek istediğinize emin misiniz? Bu işlem stokları geri döndürmez."
            />
        </div>
    );
};

export default SalesHistory;
