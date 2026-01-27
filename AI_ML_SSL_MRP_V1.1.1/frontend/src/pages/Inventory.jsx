import { useState, useMemo, useEffect } from "react";
import { Search, Edit2, CheckCircle2, XCircle } from "lucide-react";
import api from "../api";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
    });
    const [editingId, setEditingId] = useState(null);
    const [editAmount, setEditAmount] = useState(0);

    // Fetch Inventory on Mount
    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const response = await api.get("/inventory");
            setInventory(response.data);
        } catch (error) {
            console.error("Error fetching inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return inventory.filter((item) => {
            const matchesId = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());
            return matchesId;
        });
    }, [inventory, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "" });
    };

    // Inline Edit Handlers
    const startEditing = (item) => {
        setEditingId(item.item_id);
        setEditAmount(item.amount);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditAmount(0);
    };

    const saveEditing = async (itemId) => {
        try {
            await api.put("/inventory/update", {
                item_id: itemId,
                amount: parseFloat(editAmount)
            });

            // Optimistic update or refresh
            setInventory(prev => prev.map(item =>
                item.item_id === itemId ? { ...item, amount: parseFloat(editAmount) } : item
            ));
            setEditingId(null);
        } catch (error) {
            console.error("Error updating inventory:", error);
            alert("Güncelleme başarısız oldu.");
        }
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Envanter Durumu
                </h1>
                <p className="text-gray-500 mt-1">Mevcut stok seviyeleri ve tampon stok durumu.</p>

                {/* Stats */}
                {!loading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <span className="text-blue-600 text-sm font-semibold">Toplam Malzeme Çeşidi</span>
                            <div className="text-2xl font-bold text-gray-800 mt-1">{inventory.length}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                            <span className="text-green-600 text-sm font-semibold">Toplam Adet</span>
                            <div className="text-2xl font-bold text-gray-800 mt-1">
                                {inventory.filter(i => i.unit === 'adet').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <span className="text-purple-600 text-sm font-semibold">Toplam Ağırlık (Gram)</span>
                            <div className="text-2xl font-bold text-gray-800 mt-1">
                                {inventory.filter(i => i.unit === 'gram').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                            <span className="text-orange-600 text-sm font-semibold">Toplam Hacim (Litre)</span>
                            <div className="text-2xl font-bold text-gray-800 mt-1">
                                {inventory.filter(i => i.unit === 'litre').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0).toLocaleString()}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="itemId"
                        placeholder="Ürün Kodu Ara..."
                        value={filters.itemId}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
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
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mevcut Stok</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Birim</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((item) => {
                                const isEditing = editingId === item.item_id;
                                return (
                                    <tr key={item.item_id} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-800">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editAmount}
                                                    onChange={(e) => setEditAmount(e.target.value)}
                                                    className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            ) : (
                                                item.amount
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{item.unit || '-'}</td>
                                        <td className="px-6 py-4 text-right text-sm font-medium">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => saveEditing(item.item_id)} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-lg transition-colors">
                                                        <CheckCircle2 size={18} />
                                                    </button>
                                                    <button onClick={cancelEditing} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg transition-colors">
                                                        <XCircle size={18} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ml-auto">
                                                    <Edit2 size={16} />
                                                    Düzenle
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {visibleData.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {/* Infinite scroll loader */}
                    {hasMore && (
                        <div ref={loaderRef} className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

export default Inventory;
