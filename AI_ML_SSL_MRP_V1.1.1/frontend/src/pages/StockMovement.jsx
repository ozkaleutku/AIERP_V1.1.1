import { useState, useMemo, useEffect } from "react";
import { Search, Plus, X, Filter, Calendar, Factory, Boxes, XCircle, ArrowRightLeft } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const StockMovement = () => {
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
        purpose: "",
        startDate: "",
        endDate: "",
        orderId: "",
    });

    // UI State for Modal and Sidebar
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [activeOrders, setActiveOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [movementForm, setMovementForm] = useState({
        item_id: "",
        amount: "",
        purpose: "giriş",
        order_id: "",
        date: new Date().toISOString().split('T')[0]
    });

    // Fetch Movements and Orders on Mount
    useEffect(() => {
        fetchMovements();
        fetchActiveOrders();
        fetchProducts();

        // Polling for active orders (every 2 minutes) to keep sidebar updated without F5
        const interval = setInterval(fetchActiveOrders, 120000);
        return () => clearInterval(interval);
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await api.get("/products?limit=10000");
            setProducts(response.data.data || []);
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    const fetchActiveOrders = async () => {
        try {
            const response = await api.get("/customer-orders");
            const active = response.data.filter(o => ['Bekleniyor', 'Üretimde', 'Hazır'].includes(o.status));
            setActiveOrders(active);
        } catch (error) {
            console.error("Error fetching orders:", error);
        }
    };

    const fetchMovements = async () => {
        setLoading(true);
        try {
            const response = await api.get("/stock-movements");
            setMovements(response.data);
        } catch (error) {
            console.error("Error fetching stock movements:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return movements.filter((item) => {
            const matchesId = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());
            const matchesPurpose = filters.purpose ? item.purpose === filters.purpose : true;
            const matchesOrderId = filters.orderId ? (item.order_id && item.order_id.toString().includes(filters.orderId)) : true;

            let matchesDate = true;
            if (filters.startDate || filters.endDate) {
                const itemDate = new Date(item.date);
                if (filters.startDate) matchesDate = matchesDate && itemDate >= new Date(filters.startDate);
                if (filters.endDate) matchesDate = matchesDate && itemDate <= new Date(filters.endDate);
            }

            return matchesId && matchesPurpose && matchesDate && matchesOrderId;
        });
    }, [movements, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", purpose: "", startDate: "", endDate: "", orderId: "" });
    };

    const openMovementModal = () => {
        setMovementForm({
            item_id: "",
            amount: "",
            purpose: "giriş",
            order_id: "",
            date: new Date().toISOString().split('T')[0]
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
                date: movementForm.date || new Date().toISOString().split('T')[0]
            };

            if (movementForm.order_id && movementForm.order_id.toString().trim() !== '') {
                payload.order_id = parseInt(movementForm.order_id);
            }

            await api.post("/stock-movements", payload);
            toast.success("Stok hareketi başarıyla eklendi.");
            setIsMovementModalOpen(false);
            setFilters({ itemId: "", purpose: "", startDate: "", endDate: "", orderId: "" });
            fetchMovements();
            fetchActiveOrders(); // Refresh sidebar immediately
        } catch (error) {
            console.error("Error creating movement:", error);
            toast.error("İşlem başarısız: " + (error.response?.data?.detail || error.message));
        }
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="flex gap-6 h-full">
            {/* Main Content */}
            <div className="flex-1 flex flex-col space-y-4 min-h-0">
                {/* Header */}
                <div className="flex justify-between items-start flex-shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                            Depo Hareketleri
                        </h1>
                        <p className="text-gray-500 mt-1">Stok giriş-çıkış hareketlerini izleyin.</p>
                    </div>
                    <button
                        onClick={() => openMovementModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <ArrowRightLeft size={18} />
                        Yeni Hareket Ekle
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 flex-shrink-0">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="relative md:col-span-1">
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
                        <div className="relative md:col-span-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                name="orderId"
                                placeholder="Sipariş No Ara..."
                                value={filters.orderId}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <select
                                name="purpose"
                                value={filters.purpose}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                            >
                                <option value="">Tüm Amaçlar</option>
                                <option value="giriş">Giriş</option>
                                <option value="çıkış">Çıkış</option>
                                <option value="üretime_giden">Üretime Giden</option>
                                <option value="satış_çıkışı">Satış Çıkışı</option>
                            </select>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                            />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
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

                {/* Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full relative">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tarih</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sip. No</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ürün Kodu</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Miktar</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Amaç</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleData.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-600">{item.date}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                                            {item.order_id ? `#${item.order_id}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                        <td className={`px-6 py-4 text-sm font-semibold ${item.purpose === 'giriş' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {item.purpose === 'giriş' ? '+' : '-'}{item.amount}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="capitalize px-2 py-1 bg-gray-100 rounded text-gray-600 text-xs">
                                                {item.purpose.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
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

            {/* Right Sidebar - Active Orders (Collapsible) */}
            <div className={`bg-white border-l border-gray-200 transition-all duration-300 ease-in-out h-[calc(100vh-2rem)] sticky top-4 flex flex-col z-[60] ${isSidebarOpen ? 'w-80 p-4 opacity-100' : 'w-0 p-0 opacity-0 overflow-hidden border-none'}`}>
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
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'Üretimde' ? 'bg-orange-100 text-orange-700' : order.status === 'Hazır' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-700'}`}>
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

            {/* Modal */}
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
                                    list="products-list-movement"
                                    required
                                    placeholder="Ürün seçin veya yazın..."
                                    value={movementForm.item_id}
                                    onChange={e => setMovementForm({ ...movementForm, item_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <datalist id="products-list-movement">
                                    {products.map(p => (
                                        <option key={p.item_id} value={p.item_id}>
                                            {p.item_type ? `${p.item_id} - ${p.item_type}` : p.item_id}
                                        </option>
                                    ))}
                                </datalist>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                                    <input
                                        type="date"
                                        required
                                        value={movementForm.date}
                                        onChange={e => setMovementForm({ ...movementForm, date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Amacı (Tür)</label>
                                <select
                                    value={movementForm.purpose}
                                    onChange={e => setMovementForm({ ...movementForm, purpose: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="üretime_giden">Üretime Giden</option>
                                    <option value="satış_çıkışı">Satış Çıkışı</option>
                                    <option value="giriş">Giriş (Stok Artır)</option>
                                    <option value="çıkış">Çıkış (Diğer Stok Düşür)</option>
                                </select>
                            </div>

                            {/* Order Selection - Visible always */}
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <label className="block text-sm font-medium text-yellow-800 mb-1 flex items-center gap-1">
                                    <Factory size={14} />
                                    Hangi Sipariş İçin?
                                </label>
                                <input
                                    type="text"
                                    list="active-orders-list"
                                    placeholder="Sipariş No (Örn: 1024) Ara (Opsiyonel)"
                                    value={movementForm.order_id}
                                    onChange={e => setMovementForm({ ...movementForm, order_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none bg-white font-medium"
                                />
                                <datalist id="active-orders-list">
                                    <option value="">-- Genel Stok İşlemi (Siparişsiz) --</option>
                                    {activeOrders.map(order => (
                                        <option key={order.id} value={order.id}>
                                            #{order.id} - {order.customer_name} ({order.item_id})
                                        </option>
                                    ))}
                                </datalist>
                                <p className="text-xs text-yellow-600 mt-1">
                                    Eğer bir sipariş için işlem yapıyorsanız buradan seçiniz. Üretim çıkışı ise simülasyon bu miktarı düşecektir.
                                </p>
                            </div>

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

export default StockMovement;
