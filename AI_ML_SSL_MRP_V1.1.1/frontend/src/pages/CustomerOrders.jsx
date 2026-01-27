import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Filter, Plus, Calendar as CalendarIcon, Edit2, X, Trash2, Users } from "lucide-react";
import api from "../api";

const BATCH_SIZE = 30; // Number of rows to load per batch

// New Customer Order Modal
const NewCustomerOrderModal = ({ onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        customer_name: "",
        item_id: "",
        amount: "",
        order_date: new Date().toISOString().split("T")[0],
        expected_delivery_date: "",
        production_time_days: "",
        delivery_date: "", // Real delivery date
        status: "Bekleniyor"
    });

    const [productSuggestions, setProductSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Dynamic Search for Products
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (formData.item_id && formData.item_id.length > 1) {
                try {
                    const response = await api.get("/products", {
                        params: {
                            search: formData.item_id,
                            limit: 10
                        }
                    });
                    // Response format: { data: [...], ... }
                    setProductSuggestions(response.data.data || []);
                    setShowSuggestions(true);
                } catch (error) {
                    console.error("Error searching products:", error);
                }
            } else {
                setProductSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [formData.item_id]);

    const selectProduct = (product) => {
        setFormData({ ...formData, item_id: product.item_id });
        setShowSuggestions(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            amount: parseFloat(formData.amount),
            production_time_days: parseInt(formData.production_time_days) || 0
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Müşteri Siparişi Oluştur</h2>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                </div>


                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Adı</label>
                            <input required type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                                placeholder="Müşteri/Firma Adı" />
                        </div>
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ürün</label>
                            <input
                                required
                                type="text"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.item_id}
                                onChange={e => setFormData({ ...formData, item_id: e.target.value })}
                                onFocus={() => formData.item_id && setShowSuggestions(true)}
                                placeholder="Ürün Ara (Kod)..."
                                autoComplete="off"
                            />
                            {showSuggestions && productSuggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                    {productSuggestions.map(p => (
                                        <div
                                            key={p.item_id}
                                            onClick={() => selectProduct(p)}
                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b border-gray-50 last:border-none flex justify-between"
                                        >
                                            <span className="font-medium">{p.item_id}</span>
                                            <span className="text-gray-400 text-xs">{p.item_quantity_type}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Miktar</label>
                            <input required type="number" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Üretim (Gün)</label>
                            <input type="number" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.production_time_days} onChange={e => setFormData({ ...formData, production_time_days: e.target.value })}
                                placeholder="Örn: 5" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                            <select className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                <option value="Bekleniyor">Bekleniyor</option>
                                <option value="Üretimde">Üretimde</option>
                                <option value="Hazır">Hazır</option>
                                <option value="Sevk Edildi">Sevk Edildi</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sipariş Tarihi</label>
                            <input required type="date" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.order_date} onChange={e => setFormData({ ...formData, order_date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Beklenen Teslim</label>
                            <input type="date" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.expected_delivery_date} onChange={e => setFormData({ ...formData, expected_delivery_date: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gerçekleşen Teslim</label>
                            <input type="date" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={formData.delivery_date} onChange={e => setFormData({ ...formData, delivery_date: e.target.value })} />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg transition-colors font-medium">İptal</button>
                        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Missing Supplier Warning Modal
const MissingSupplierModal = ({ items, onClose, onSaved }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [formData, setFormData] = useState({
        supplier_id: "",
        given_leadtime: 7,
        given_leadtime_deviation: 2,
        lot_size: 1,
        min_size: 1,
        max_size: 1000,
        calculated: false,
        status: "Aktif"
    });
    const [saving, setSaving] = useState(false);

    const currentItem = items[currentIndex];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post("/suppliers", {
                item_id: currentItem,
                ...formData
            });

            if (currentIndex < items.length - 1) {
                // Move to next item
                setCurrentIndex(currentIndex + 1);
                setFormData({ ...formData, supplier_id: "" }); // Reset supplier_id for next
            } else {
                // All done
                onSaved();
            }
        } catch (error) {
            console.error("Error adding supplier:", error);
            alert("Tedarikçi eklenirken hata oluştu.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
                <div className="mb-4">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-xl font-bold">Tedarikçi Bilgisi Gerekli</h2>
                    </div>
                    <p className="text-gray-600 text-sm">
                        <strong className="text-gray-900">{currentItem}</strong> ürünü için aktif tedarikçi tanımlanmamış.
                        Simülasyonun doğru çalışması için lütfen tedarikçi bilgilerini girin.
                    </p>
                    {items.length > 1 && (
                        <p className="text-xs text-gray-400 mt-1">
                            {currentIndex + 1} / {items.length} ürün
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tedarikçi Kodu *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                            value={formData.supplier_id}
                            onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                            placeholder="Tedarikçi kodu girin"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Temin Süresi (Gün)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                value={formData.given_leadtime}
                                onChange={e => setFormData({ ...formData, given_leadtime: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sapma (Gün)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                value={formData.given_leadtime_deviation}
                                onChange={e => setFormData({ ...formData, given_leadtime_deviation: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                        >
                            Şimdilik Atla
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-2 text-white bg-amber-600 hover:bg-amber-700 rounded-lg font-medium disabled:opacity-50"
                        >
                            {saving ? "Kaydediliyor..." : items.length > 1 && currentIndex < items.length - 1 ? "Kaydet ve Sonraki" : "Kaydet"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CustomerOrders = () => {
    // ... (Keep existing State)
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: "",
        status: "",
        startDate: "", // New
        endDate: "",   // New
    });
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Missing supplier modal state
    const [missingSuppliers, setMissingSuppliers] = useState([]);
    const [showMissingSupplierModal, setShowMissingSupplierModal] = useState(false);

    // Infinite scroll state
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
    const loaderRef = useRef(null);

    // Inline Updating State
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Fetch Data
    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await api.get("/customer-orders");
            setOrders(response.data);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    // Create
    const handleCreate = async (newOrder) => {
        try {
            const response = await api.post("/customer-orders", newOrder);

            // Check for warnings (missing suppliers)
            if (response.data.warnings && response.data.warnings.length > 0) {
                const missingItems = response.data.warnings
                    .filter(w => w.type === "missing_supplier")
                    .map(w => w.item_id);

                if (missingItems.length > 0) {
                    setMissingSuppliers(missingItems);
                    setShowMissingSupplierModal(true);
                }
            }

            fetchOrders();
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("Hata oluştu.");
        }
    };

    // Handle missing supplier modal close
    const handleMissingSupplierSaved = () => {
        setShowMissingSupplierModal(false);
        setMissingSuppliers([]);
        // Optionally refresh suggestions if OrderMap is open
    };

    // Update
    const startEditing = (order) => {
        setEditingId(order.id);
        setEditForm({ ...order });
    };

    const saveEditing = async () => {
        try {
            await api.put(`/customer-orders/${editingId}`, {
                id: editingId,
                amount: parseFloat(editForm.amount),
                status: editForm.status,
                expected_delivery_date: editForm.expected_delivery_date,
                delivery_date: editForm.delivery_date,
                production_time_days: parseInt(editForm.production_time_days)
            });
            fetchOrders();
            setEditingId(null);
        } catch (error) {
            console.error(error);
            alert("Güncelleme hatası.");
        }
    };

    // Delete
    const handleDelete = async (id) => {
        if (!window.confirm("Bu siparişi silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/customer-orders/${id}`);
            fetchOrders();
        } catch (error) {
            console.error(error);
        }
    };

    // Filter Logic
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const search = filters.search.toLowerCase();
            const matchesSearch =
                order.customer_name.toLowerCase().includes(search) ||
                order.item_id.toLowerCase().includes(search);
            const matchesStatus = filters.status ? order.status === filters.status : true;

            let matchesDate = true;
            if (filters.startDate || filters.endDate) {
                const orderDate = new Date(order.order_date).getTime();
                if (filters.startDate) {
                    const start = new Date(filters.startDate).getTime();
                    if (orderDate < start) matchesDate = false;
                }
                if (filters.endDate) {
                    const end = new Date(filters.endDate).getTime();
                    if (orderDate > end) matchesDate = false;
                }
            }

            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [orders, filters]);

    // Slice to visible count for infinite scroll
    const visibleOrders = useMemo(() => filteredOrders.slice(0, visibleCount), [filteredOrders, visibleCount]);
    const hasMore = visibleCount < filteredOrders.length;

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(BATCH_SIZE);
    }, [filters]);

    // IntersectionObserver for table rows
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setVisibleCount(prev => prev + BATCH_SIZE);
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore]);

    if (loading) return <div className="p-8">Yükleniyor...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                        <Users className="text-blue-600" /> Müşteri Siparişleri
                    </h1>
                    <p className="text-gray-500 mt-1">Müşterilerden gelen aktif siparişlerin takibi.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Yeni Sipariş Ekle</span>
                </button>
            </div>

            {/* Filters ... (Keep Existing) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Müşteri veya Ürün Ara..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    />
                </div>
                <div className="relative w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Tüm Durumlar</option>
                        <option value="Bekleniyor">Bekleniyor</option>
                        <option value="Üretimde">Üretimde</option>
                        <option value="Hazır">Hazır</option>
                        <option value="Sevk Edildi">Sevk Edildi</option>
                    </select>
                </div>
                {/* Date Filters */}
                <div className="flex gap-2">
                    <input
                        type="date"
                        className="pl-2 pr-2 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        value={filters.startDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                    <input
                        type="date"
                        className="pl-2 pr-2 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        value={filters.endDate}
                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                </div>
            </div>


            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '120px' }}>Müşteri</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '100px' }}>Ürün</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '80px' }}>Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '100px' }}>Sipariş Tarihi</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '110px' }}>Beklenen T.</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '110px' }}>Gerçekleşen T.</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '90px' }}>Üretim (Gün)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: '90px' }}>Durum</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase" style={{ width: '80px' }}>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleOrders.map(order => {
                                const isEditing = editingId === order.id;
                                return (
                                    <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? "bg-blue-50/30" : ""}`}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.customer_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{order.item_id}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-700">
                                            {isEditing ? (
                                                <input type="number" className="w-20 border rounded px-1 py-0.5"
                                                    value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
                                            ) : order.amount}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{order.order_date}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {isEditing ? (
                                                <input type="date" className="border rounded px-1 py-0.5 w-32"
                                                    value={editForm.expected_delivery_date || ""} onChange={e => setEditForm({ ...editForm, expected_delivery_date: e.target.value })} />
                                            ) : order.expected_delivery_date || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {isEditing ? (
                                                <input type="date" className="border rounded px-1 py-0.5 w-32"
                                                    value={editForm.delivery_date || ""} onChange={e => setEditForm({ ...editForm, delivery_date: e.target.value })} />
                                            ) : order.delivery_date || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {isEditing ? (
                                                <input type="number" className="border rounded px-1 py-0.5 w-16"
                                                    value={editForm.production_time_days || ""} onChange={e => setEditForm({ ...editForm, production_time_days: e.target.value })} />
                                            ) : order.production_time_days ? `${order.production_time_days} gün` : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {isEditing ? (
                                                <select className="border rounded px-1 py-0.5 text-xs"
                                                    value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                                    <option value="Bekleniyor">Bekleniyor</option>
                                                    <option value="Üretimde">Üretimde</option>
                                                    <option value="Hazır">Hazır</option>
                                                    <option value="Sevk Edildi">Sevk Edildi</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                    ${order.status === 'Hazır' ? 'bg-green-100 text-green-800' :
                                                        order.status === 'Üretimde' ? 'bg-yellow-100 text-yellow-800' :
                                                            order.status === 'Sevk Edildi' ? 'bg-gray-100 text-gray-600' :
                                                                'bg-blue-100 text-blue-800'}`}>
                                                    {order.status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={saveEditing} className="text-green-600 hover:text-green-800"><Edit2 size={16} /></button>
                                                    <button onClick={() => setEditingId(null)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => startEditing(order)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(order.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
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
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                    {/* Show count */}
                    <div className="text-center text-sm text-gray-400 py-2">
                        {visibleOrders.length} / {filteredOrders.length} kayıt gösteriliyor
                    </div>
                </div>
            </div>

            {isModalOpen && <NewCustomerOrderModal onClose={() => setIsModalOpen(false)} onSubmit={handleCreate} />}

            {/* Missing Supplier Warning Modal */}
            {showMissingSupplierModal && missingSuppliers.length > 0 && (
                <MissingSupplierModal
                    items={missingSuppliers}
                    onClose={() => { setShowMissingSupplierModal(false); setMissingSuppliers([]); }}
                    onSaved={handleMissingSupplierSaved}
                />
            )}
        </div >
    );
};

export default CustomerOrders;
