import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Trash2, Edit2, X, CheckCircle2, History, Calendar } from "lucide-react";
import api from "../api";

const SalesHistory = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
        startDate: "",
        endDate: "",
    });
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Inline Editing States
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

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

    const handleAddSale = async (newSale) => {
        try {
            await api.post("/sales", newSale);
            fetchSales();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error adding sale:", error);
            alert("Satış eklenirken hata oluştu.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu satış kaydını silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/sales/${id}`);
            fetchSales();
        } catch (error) {
            console.error("Error deleting sale:", error);
            alert("Silme işlemi başarısız.");
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
            fetchSales();
            setEditingId(null);
        } catch (error) {
            console.error("Error updating sale:", error);
            alert("Güncelleme başarısız.");
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

    const handleInputChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", startDate: "", endDate: "" });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <History className="text-purple-600" /> Satış Geçmişi
                    </h1>
                    <p className="text-gray-500 mt-1">Gerçekleşen satış çıkış kayıtları ve düzeltmeleri.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Yeni Satış Ekle</span>
                </button>
            </div>

            {/* Filter */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-4">
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Miktar</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map((item) => {
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
                                                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg">
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
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && <NewSaleModal onClose={() => setIsModalOpen(false)} onSubmit={handleAddSale} />}
        </div>
    );
};

const NewSaleModal = ({ onClose, onSubmit }) => {
    const [products, setProducts] = useState([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.get("/products");
                setProducts(response.data.data || response.data || []);
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        fetchProducts();
    }, []);

    const [formData, setFormData] = useState({
        item_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            amount: parseFloat(formData.amount)
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Yeni Satış Kaydı</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Kodu</label>
                        <input
                            type="text"
                            required
                            list="product-options"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                            value={formData.item_id}
                            onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                            placeholder="Ürün Seçiniz veya Yazınız"
                        />
                        <datalist id="product-options">
                            {products.map((p) => (
                                <option key={p.item_id} value={p.item_id} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Miktar</label>
                        <input
                            type="number"
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                        <input
                            type="date"
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-medium shadow-lg shadow-purple-500/20"
                        >
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SalesHistory;
