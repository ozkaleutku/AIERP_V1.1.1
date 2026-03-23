import { useState, useMemo, useEffect } from "react";
import { Search, Plus, X, Filter, Calendar, Factory, Boxes, XCircle, ArrowRightLeft } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../api";
import { useInfiniteScroll } from "../../../shared/hooks/useInfiniteScroll";

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
    const [locations, setLocations] = useState([]);
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
    const [movementForm, setMovementForm] = useState({
        item_id: "",
        amount: "",
        purpose: "giriş",
        order_id: "",
        source_location_id: "GİRİŞ_KALİTE",
        target_location_id: "ANA_DEPO",
        tracking_code: "",
        parent_id: "",
        is_completed: false,
        date: new Date().toISOString().split('T')[0]
    });

    const [productionForm, setProductionForm] = useState({
        item_id: "",
        amount: "",
        order_id: "",
        date: new Date().toISOString().split('T')[0]
    });

    // Fetch Movements and Orders on Mount
    useEffect(() => {
        fetchMovements();
        fetchActiveOrders();
        fetchProducts();
        fetchLocations();

        // Polling for active orders
        const interval = setInterval(fetchActiveOrders, 120000);
        return () => clearInterval(interval);
    }, []);

    // Auto-Determine Purpose based on Locations
    useEffect(() => {
        const src = movementForm.source_location_id;
        const tgt = movementForm.target_location_id;
        let newPurpose = movementForm.purpose;

        if (!src && tgt === 'ANA_DEPO') newPurpose = 'giriş';
        else if (!src && tgt === 'GİRİŞ_KALİTE') newPurpose = 'giriş';
        else if (src === 'GİRİŞ_KALİTE' && tgt === 'ANA_DEPO') newPurpose = 'giriş';
        else if (src === 'ANA_DEPO' && tgt === 'ÜRETİM') newPurpose = 'üretime_giden';
        else if (src === 'ÜRETİM' && tgt === 'ANA_DEPO') newPurpose = 'iade';
        else if (src === 'ÜRETİM' && tgt === 'ÇIKIŞ_KALİTE') newPurpose = 'çıkış';
        else if (src === 'ÇIKIŞ_KALİTE' && tgt === 'SEVKİYAT_DEPO') newPurpose = 'satış_çıkışı';
        else if (src === 'SEVKİYAT_DEPO' && !tgt) newPurpose = 'satış_çıkışı';
        else if (src && !tgt) newPurpose = 'çıkış'; // Dışarıya normal çıkış
        else if (!src && !tgt) newPurpose = 'çıkış'; // Should force at least one
        // Default to current if no specific rule matches

        if (newPurpose !== movementForm.purpose) {
            setMovementForm(prev => ({ ...prev, purpose: newPurpose }));
        }
    }, [movementForm.source_location_id, movementForm.target_location_id]);

    const fetchLocations = async () => {
        try {
            const response = await api.get("/locations");
            setLocations(response.data);
        } catch (error) {
            console.error("Error fetching locations:", error);
        }
    };

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
            source_location_id: "GİRİŞ_KALİTE",
            target_location_id: "ANA_DEPO",
            tracking_code: "",
            parent_id: "",
            is_completed: false,
            date: new Date().toISOString().split('T')[0]
        });
        setIsMovementModalOpen(true);
    };

    const handlePurposeChange = (purpose) => {
        let source = "";
        let target = "";
        if (purpose === 'üretime_giden') { source = "ANA_DEPO"; target = "ÜRETİM"; }
        else if (purpose === 'satış_çıkışı') { source = "ANA_DEPO"; target = "SEVKİYAT_DEPO"; }
        else if (purpose === 'giriş') { source = "GİRİŞ_KALİTE"; target = "ANA_DEPO"; }
        else if (purpose === 'iade') { source = "ÜRETİM"; target = "ANA_DEPO"; }

        setMovementForm(prev => ({
            ...prev,
            purpose,
            source_location_id: source,
            target_location_id: target
        }));
    }

    const handleMovementSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                item_id: movementForm.item_id,
                amount: parseFloat(movementForm.amount),
                purpose: movementForm.purpose,
                date: movementForm.date || new Date().toISOString().split('T')[0],
                source_location_id: movementForm.source_location_id || null,
                target_location_id: movementForm.target_location_id || null,
                tracking_code: movementForm.tracking_code || null,
                parent_id: movementForm.parent_id ? parseInt(movementForm.parent_id) : null,
                is_completed: movementForm.is_completed
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

    const handleProductionSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                item_id: productionForm.item_id,
                amount: parseFloat(productionForm.amount),
                purpose: "giriş",
                date: productionForm.date || new Date().toISOString().split('T')[0],
                source_location_id: null,
                target_location_id: "ANA_DEPO",
                tracking_code: null,
                parent_id: null,
                is_completed: false
            };
            if (productionForm.order_id && productionForm.order_id.toString().trim() !== '') {
                payload.order_id = parseInt(productionForm.order_id);
            }

            await api.post("/stock-movements", payload);
            toast.success("Üretim başarıyla kaydedildi.");
            setIsProductionModalOpen(false);
            setProductionForm({
                item_id: "",
                amount: "",
                order_id: "",
                date: new Date().toISOString().split('T')[0]
            });
            fetchMovements();
        } catch (error) {
            console.error("Error saving production:", error);
            toast.error("Üretim kaydedilemedi.");
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
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsProductionModalOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <Factory size={18} />
                            Üretimi Kaydet
                        </button>
                        <button
                            onClick={() => openMovementModal()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <ArrowRightLeft size={18} />
                            Yeni Hareket Ekle
                        </button>
                    </div>
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
                                <option value="iade">Üretimden İade</option>
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
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Takip ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Kaynak &rarr; Hedef</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sip. No</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ürün Kodu</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Miktar</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">İşlem / Durum</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleData.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-600">{item.date}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-gray-500 font-medium">
                                            {item.tracking_code || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-semibold text-gray-500 flex items-center gap-1">
                                            <span className="truncate max-w-[80px] bg-gray-100 px-1.5 py-0.5 rounded" title={item.source_location_id || '-'}>{item.source_location_id || '---'}</span>
                                            &rarr;
                                            <span className="truncate max-w-[80px] bg-gray-100 px-1.5 py-0.5 rounded" title={item.target_location_id || '-'}>{item.target_location_id || '---'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                                            {item.order_id ? `#${item.order_id}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                        <td className={`px-6 py-4 text-sm font-semibold ${item.purpose === 'giriş' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {item.purpose === 'giriş' ? '+' : '-'}{item.amount}
                                        </td>
                                        <td className="px-6 py-4 text-sm flex items-center gap-2">
                                            <span className="capitalize px-2 py-1 bg-gray-100 rounded text-gray-600 text-xs font-medium">
                                                {item.purpose.replace(/_/g, " ")}
                                            </span>
                                            {item.is_completed && <span className="bg-green-100 font-bold text-green-700 text-[10px] px-1.5 py-0.5 rounded shadow-sm border border-green-200">KAPALI</span>}
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kaynak Depo</label>
                                    <select
                                        value={movementForm.source_location_id}
                                        onChange={e => setMovementForm({ ...movementForm, source_location_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        <option value="">-- Dışarıdan --</option>
                                        {locations.map(loc => (
                                            <option key={loc.location_id} value={loc.location_id}>{loc.location_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Depo</label>
                                    <select
                                        value={movementForm.target_location_id}
                                        onChange={e => setMovementForm({ ...movementForm, target_location_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        <option value="">-- Dışarıya --</option>
                                        {locations.map(loc => (
                                            <option key={loc.location_id} value={loc.location_id}>{loc.location_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Amacı (Sistem Tarafından Belirlenir)</label>
                                <select
                                    value={movementForm.purpose}
                                    onChange={e => handlePurposeChange(e.target.value)}
                                    disabled={true}
                                    className="w-full px-3 py-2 border border-blue-200 bg-blue-50 bg-opacity-50 text-blue-900 rounded-lg focus:outline-none cursor-not-allowed font-medium"
                                >
                                    <option value="üretime_giden">Üretime Giden (Üretime Çıkış)</option>
                                    <option value="iade">Üretimden İade (Depoya Dönüş)</option>
                                    <option value="satış_çıkışı">Satış Çıkışı (Sevkıyat)</option>
                                    <option value="giriş">Giriş (Stok Artır)</option>
                                    <option value="çıkış">Çıkış / Diğer (Stok Düşür)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Takip Kodu (İsteğe Bağlı)</label>
                                <select
                                    value={movementForm.tracking_code}
                                    onChange={e => {
                                        const code = e.target.value;
                                        setMovementForm(prev => {
                                            const newState = { ...prev, tracking_code: code };
                                            if (code) {
                                                const parentMove = movements.find(m => m.tracking_code === code && m.purpose === 'üretime_giden');
                                                if (parentMove && parentMove.order_id) {
                                                    newState.order_id = parentMove.order_id;
                                                }
                                            }
                                            return newState;
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">-- Yeni Oluştur (Otomatik) --</option>
                                    {[...new Set(movements.filter(m => m.item_id === movementForm.item_id && m.tracking_code).map(m => m.tracking_code))].map(code => (
                                        <option key={code} value={code}>{code}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Order Selection - Visible always */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <label className="block text-sm font-medium text-blue-800 mb-1 flex items-center gap-1">
                                    <Factory size={14} />
                                    Hangi Sipariş İçin?
                                </label>
                                <input
                                    type="text"
                                    list="active-orders-list"
                                    placeholder="Sipariş No (Örn: 1024) Ara (Opsiyonel)"
                                    value={movementForm.order_id}
                                    onChange={e => setMovementForm({ ...movementForm, order_id: e.target.value })}
                                    disabled={!!movementForm.tracking_code}
                                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                />
                                <datalist id="active-orders-list">
                                    {activeOrders.map(order => (
                                        <option key={order.id} value={order.id}>
                                            #{order.id} - {order.customer_name} ({order.item_id})
                                        </option>
                                    ))}
                                </datalist>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isCompleted"
                                    checked={movementForm.is_completed}
                                    onChange={e => setMovementForm({ ...movementForm, is_completed: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="isCompleted" className="text-xs font-bold text-gray-700">Tümü Kullanıldı (Sipariş/Paket Kapatılsın)</label>
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

            {/* Production Modal Add-On */}
            {
                isProductionModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4 border border-green-200">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                                    <Factory size={24} className="text-green-600" />
                                    Üretimi Kaydet
                                </h2>
                                <button onClick={() => setIsProductionModalOpen(false)} className="text-gray-400 hover:text-red-500 transition">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleProductionSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Üretilen Ürün/Yarı Mamül</label>
                                    <select
                                        required
                                        value={productionForm.item_id}
                                        onChange={e => setProductionForm({ ...productionForm, item_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-medium"
                                    >
                                        <option value="">-- Ürün Seçiniz --</option>
                                        {products.map(p => (
                                            <option key={p.item_id} value={p.item_id}>
                                                {p.item_id} - {p.item_type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Miktar</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            min="0.01"
                                            value={productionForm.amount}
                                            onChange={e => setProductionForm({ ...productionForm, amount: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                                        <input
                                            type="date"
                                            required
                                            value={productionForm.date}
                                            onChange={e => setProductionForm({ ...productionForm, date: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                    <label className="block text-sm font-medium text-green-800 mb-1 flex items-center gap-1">
                                        Hangi Sipariş İçin? (Opsiyonel)
                                    </label>
                                    <input
                                        type="text"
                                        list="active-production-orders-list"
                                        placeholder="Sipariş No (Örn: 1024)"
                                        value={productionForm.order_id}
                                        onChange={e => setProductionForm({ ...productionForm, order_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white font-medium"
                                    />
                                    <datalist id="active-production-orders-list">
                                        {activeOrders.map(order => (
                                            <option key={order.id} value={order.id}>
                                                #{order.id} - {order.customer_name} ({order.item_id})
                                            </option>
                                        ))}
                                    </datalist>
                                    <p className="text-xs text-green-700 mt-2 font-medium">Not: Ürün doğrudan Ana Depo'ya eklenecektir.</p>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsProductionModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors"
                                    >
                                        Üretimi Kaydet
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

export default StockMovement;
