import { useState, useMemo, useEffect } from "react";
import { Search, Edit2, CheckCircle2, XCircle, ArrowRightLeft, Factory, Truck, Info, Boxes } from "lucide-react";
import api from "../api";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const Inventory = () => {
    const [inventory, setInventory] = useState([]);
    const [activeOrders, setActiveOrders] = useState([]); // Active Customer Orders
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
    });

    // Inline Edit State
    const [editingId, setEditingId] = useState(null);
    const [editAmount, setEditAmount] = useState(0);

    // Stock Movement Modal State
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sidebar starts open on desktop
    const [movementForm, setMovementForm] = useState({
        item_id: "",
        amount: "",
        purpose: "üretim_çıkışı",
        order_id: "" // For partial consumption
    });

    // Fetch Data on Mount
    useEffect(() => {
        fetchInventory();
        fetchActiveOrders();
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

    const fetchActiveOrders = async () => {
        try {
            const response = await api.get("/customer-orders");
            // Filter only active orders (Bekleniyor, Üretimde)
            const active = response.data.filter(o => ['Bekleniyor', 'Üretimde'].includes(o.status));
            setActiveOrders(active);
        } catch (error) {
            console.error("Error fetching orders:", error);
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

    // Inline Edit Handlers (For quick correction)
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

            setInventory(prev => prev.map(item =>
                item.item_id === itemId ? { ...item, amount: parseFloat(editAmount) } : item
            ));
            setEditingId(null);
        } catch (error) {
            console.error("Error updating inventory:", error);
            alert("Güncelleme başarısız oldu.");
        }
    };

    // Stock Movement Handlers
    const openMovementModal = (item = null) => {
        setMovementForm({
            item_id: item ? item.item_id : "",
            amount: "",
            purpose: "üretim_çıkışı",
            order_id: ""
        });
        setIsMovementModalOpen(true);
    };

    const handleMovementSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                item_id: movementForm.item_id,
                amount: parseFloat(movementForm.amount),
                purpose: movementForm.purpose,
                date: new Date().toISOString().split('T')[0]
            };

            // Only send order_id if purpose is production related
            if (movementForm.purpose === 'üretim_çıkışı' && movementForm.order_id) {
                payload.order_id = parseInt(movementForm.order_id);
            }

            await api.post("/stock-movements", payload);

            alert("Stok hareketi başarıyla işlendi.");
            setIsMovementModalOpen(false);
            fetchInventory(); // Refresh stock
        } catch (error) {
            console.error("Error creating movement:", error);
            alert("İşlem başarısız: " + (error.response?.data?.detail || error.message));
        }
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="flex gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-6 min-w-0">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                            Envanter Durumu
                        </h1>
                        <p className="text-gray-500 mt-1">Stok takibi ve üretim çıkış işlemleri.</p>
                    </div>
                    <button
                        onClick={() => openMovementModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <ArrowRightLeft size={18} />
                        Stok Hareketi Ekle
                    </button>
                </div>

                {/* Stats Cards - Omitted for brevity, kept same as before generally */}
                {!loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2 mb-1">
                                <Boxes className="text-blue-600" size={18} />
                                <span className="text-blue-600 text-sm font-semibold">Çeşit</span>
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{inventory.length}</div>
                        </div>
                        {/* More stats can be here */}
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            name="itemId"
                            placeholder="Ürün Kodu Ara..."
                            value={filters.itemId}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </div>

                {/* Main Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Ürün Kodu</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Mevcut Stok</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Birim</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleData.map((item) => {
                                    const isEditing = editingId === item.item_id;
                                    return (
                                        <tr key={item.item_id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-800">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editAmount}
                                                        onChange={(e) => setEditAmount(e.target.value)}
                                                        className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                ) : item.amount}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{item.unit || '-'}</td>
                                            <td className="px-6 py-4 text-right text-sm font-medium flex justify-end gap-2">
                                                <button
                                                    onClick={() => openMovementModal(item)}
                                                    className="text-orange-600 hover:text-orange-900 bg-orange-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                                    title="Hızlı Hareket Ekle"
                                                >
                                                    <ArrowRightLeft size={16} />
                                                </button>

                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => saveEditing(item.item_id)} className="text-green-600 bg-green-50 p-1.5 rounded-lg"><CheckCircle2 size={18} /></button>
                                                        <button onClick={cancelEditing} className="text-red-600 bg-red-50 p-1.5 rounded-lg"><XCircle size={18} /></button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => startEditing(item)} className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {hasMore && <div ref={loaderRef} className="h-4 w-full"></div>}
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Active Orders (Collapsible) */}
            <div className={`bg-white border-l border-gray-200 transition-all duration-300 ease-in-out h-[calc(100vh-2rem)] sticky top-4 flex flex-col ${isSidebarOpen ? 'w-80 p-4 opacity-100' : 'w-0 p-0 opacity-0 overflow-hidden border-none'}`}>
                <div className="flex items-center justify-between mb-4 min-w-[280px]">
                    <div className="flex items-center gap-2">
                        <Factory className="text-blue-600" size={20} />
                        <h2 className="text-lg font-bold text-gray-800">Aktif Üretim Emirleri</h2>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 min-w-[280px]">
                    <p className="text-xs text-gray-500 mb-4">Depodan çıkış yaparken aşağıdaki sipariş ID'lerini referans alınız.</p>

                    <div className="space-y-3">
                        {activeOrders.map(order => (
                            <div key={order.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-900">#{order.id}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'Üretimde' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {order.status}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-700 font-medium truncate" title={order.customer_name}>{order.customer_name}</div>
                                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                                    <span className="flex items-center gap-1"><Boxes size={12} /> {order.item_id}</span>
                                    <span>{parseFloat(order.amount).toLocaleString()} adet</span>
                                </div>
                                <div className="mt-2 text-xs text-gray-400">
                                    Teslim: {order.expected_delivery_date || '-'}
                                </div>
                            </div>
                        ))}
                        {activeOrders.length === 0 && (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                Aktif sipariş bulunmuyor.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar Toggle Button (Visible when sidebar is closed) */}
            {!isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="fixed right-0 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-l-lg shadow-lg hover:bg-blue-700 transition-colors z-40"
                    title="Aktif Siparişleri Göster"
                >
                    <Factory size={20} />
                </button>
            )}

            {/* Stock Movement Modal */}
            {isMovementModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <ArrowRightLeft className="text-blue-600" />
                            Stok Hareketi Ekle
                        </h2>

                        <form onSubmit={handleMovementSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Kodu</label>
                                <input
                                    type="text"
                                    required
                                    value={movementForm.item_id}
                                    onChange={e => setMovementForm({ ...movementForm, item_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amaç</label>
                                    <select
                                        value={movementForm.purpose}
                                        onChange={e => setMovementForm({ ...movementForm, purpose: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="üretim_çıkışı">Üretime Çıkış</option>
                                        <option value="satış_çıkışı">Doğrudan Satış</option>
                                        <option value="giriş">Stok Girişi</option>
                                        <option value="zayi">Zayi / Fire</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Miktar</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        value={movementForm.amount}
                                        onChange={e => setMovementForm({ ...movementForm, amount: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Order Selection - Visible only for production out */}
                            {movementForm.purpose === 'üretim_çıkışı' && (
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <label className="block text-sm font-medium text-yellow-800 mb-1 flex items-center gap-1">
                                        <Factory size={14} />
                                        Hangi Sipariş İçin?
                                    </label>
                                    <select
                                        value={movementForm.order_id}
                                        onChange={e => setMovementForm({ ...movementForm, order_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white"
                                    >
                                        <option value="">-- Genel Stok Çıkışı (Siparişsiz) --</option>
                                        {activeOrders.map(order => (
                                            <option key={order.id} value={order.id}>
                                                #{order.id} - {order.customer_name} ({order.item_id})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-yellow-600 mt-1">
                                        Eğer bir sipariş için çıkış yapıyorsanız buradan seçiniz. Simülasyon bu miktarı düşecektir.
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsMovementModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
