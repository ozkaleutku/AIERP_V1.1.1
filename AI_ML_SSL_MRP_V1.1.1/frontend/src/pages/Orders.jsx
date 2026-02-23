import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Plus, Calendar as CalendarIcon, Edit2, X, Trash2, CheckCircle2 } from "lucide-react";
import api from "../api";
import toast from "react-hot-toast";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import MissingSupplierPopup from "../components/MissingSupplierPopup";
import ConfirmModal from "../components/ConfirmModal";

// New Order Modal
const NewOrderModal = ({ onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        item_id: "",
        supplier_id: "",
        amount: "",
        purpose: "normal_sipariş",
        purchase_date: new Date().toISOString().split("T")[0],
        expected_coming_date: "",
    });

    const [products, setProducts] = useState([]);
    const [allSupplierItems, setAllSupplierItems] = useState([]); // All supplier-item relations
    const [filteredSuppliers, setFilteredSuppliers] = useState([]); // Filtered by selected item
    const [selectedSupplierInfo, setSelectedSupplierInfo] = useState(null); // Details to show
    const [isMissingSupplierOpen, setIsMissingSupplierOpen] = useState(false);

    const fetchSuppliersData = async () => {
        try {
            const supRes = await api.get("/suppliers");
            setAllSupplierItems(supRes.data);
        } catch (error) {
            console.error("Error fetching suppliers:", error);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const prodRes = await api.get("/products");
                setProducts(prodRes.data.data || prodRes.data || []);
                await fetchSuppliersData();
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    // Filter suppliers when item_id changes
    useEffect(() => {
        if (formData.item_id) {
            const relevant = allSupplierItems.filter(s => s.item_id === formData.item_id);
            setFilteredSuppliers(relevant);

            // If current supplier not in new list, clear it
            if (!relevant.find(s => s.supplier_id === formData.supplier_id)) {
                setFormData(prev => ({ ...prev, supplier_id: "" }));
                setSelectedSupplierInfo(null);
            }
        } else {
            setFilteredSuppliers([]);
            setSelectedSupplierInfo(null);
        }
    }, [formData.item_id, allSupplierItems]);

    // Update info when supplier changes
    useEffect(() => {
        if (formData.item_id && formData.supplier_id) {
            const info = allSupplierItems.find(s => s.item_id === formData.item_id && s.supplier_id === formData.supplier_id);
            setSelectedSupplierInfo(info || null);
        } else {
            setSelectedSupplierInfo(null);
        }
    }, [formData.item_id, formData.supplier_id, allSupplierItems]);

    let amountError = null;
    if (selectedSupplierInfo && formData.amount) {
        const amt = parseFloat(formData.amount);
        const min = parseFloat(selectedSupplierInfo.min_size) || 0;
        const max = parseFloat(selectedSupplierInfo.max_size) || 0;
        const lot = parseFloat(selectedSupplierInfo.lot_size) || 0;

        if (min > 0 && amt < min) {
            amountError = "Uygunsuz miktar (min)";
        } else if (max > 0 && amt > max) {
            amountError = "Uygunsuz miktar (max)";
        } else if (lot > 0 && amt % lot !== 0) {
            amountError = "Uygunsuz miktar (lot)";
        }
    }

    const isSupplierPassive = selectedSupplierInfo?.activity_status === 'Pasif';
    const isSubmitDisabled = !formData.item_id || !formData.supplier_id || !formData.amount || amountError !== null || isSupplierPassive;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSubmitDisabled) return;
        onSubmit({
            ...formData,
            amount: parseFloat(formData.amount)
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Yeni Sipariş Oluştur</h2>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* LEFT COLUMN: Product & Supplier Selection */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Kodu</label>
                                <input
                                    type="text"
                                    list="order-product-list"
                                    required
                                    placeholder="Ürün Kodu Ara veya Yaz"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium bg-white"
                                    value={formData.item_id}
                                    onChange={e => setFormData({ ...formData, item_id: e.target.value })}
                                />
                                <datalist id="order-product-list">
                                    {products
                                        .filter(p => !allSupplierItems.some(s => s.item_id === p.item_id && s.supplier_id === 'DAHİLİ'))
                                        .map(p => (
                                            <option key={p.item_id} value={p.item_id}>{p.item_id}</option>
                                        ))
                                    }
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tedarikçi</label>
                                <select
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={formData.supplier_id}
                                    onChange={e => setFormData({ ...formData, supplier_id: e.target.value })}
                                    disabled={!formData.item_id}
                                >
                                    <option value="">{formData.item_id ? "Tedarikçi Seçiniz" : "Önce Ürün Seçiniz"}</option>
                                    {filteredSuppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_id}</option>)}
                                </select>
                                {formData.item_id && filteredSuppliers.length === 0 && (
                                    <div className="mt-2 space-y-2">
                                        <p className="text-xs text-red-500">Bu ürün için tanımlı tedarikçi bulunamadı.</p>
                                        <button
                                            type="button"
                                            onClick={() => setIsMissingSupplierOpen(true)}
                                            className="text-xs w-full py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition-colors border border-blue-200"
                                        >
                                            + Yeni Tedarikçi Tanımla
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* supplier info box */}
                            {selectedSupplierInfo && (
                                <div className={`border rounded-lg p-4 text-sm space-y-2 ${selectedSupplierInfo.activity_status === 'Pasif' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-blue-50 border-blue-100 text-blue-900'}`}>
                                    <h4 className="font-semibold flex items-center gap-2">
                                        {selectedSupplierInfo.activity_status === 'Pasif' ? '⚠️ Tedarikçi Pasif Durumda' : 'ℹ️ Tedarikçi Koşulları'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        <span>Lot Size: <span className="font-medium">{selectedSupplierInfo.lot_size || 0}</span></span>
                                        <span>Min Sipariş: <span className="font-medium">{selectedSupplierInfo.min_size || 0}</span></span>
                                        <span>Max Sipariş: <span className="font-medium">{selectedSupplierInfo.max_size || 0}</span></span>
                                        <span>Leadtime: <span className="font-medium">{selectedSupplierInfo.given_leadtime} Gün</span></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Order Details */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Miktar</label>
                                <input required type="number"
                                    className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${amountError ? 'border-red-300 focus:border-red-500 bg-red-50 text-red-900' : 'border-gray-200 focus:border-blue-500 bg-white'}`}
                                    value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                                {amountError && <p className="text-xs text-red-600 font-medium mt-1">{amountError}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amaç</label>
                                <select
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={formData.purpose}
                                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                >
                                    <option value="normal_sipariş">Normal Sipariş</option>
                                    <option value="emniyet_stoku_için">Emniyet Stoku İçin</option>
                                    <option value="acil_sipariş">Acil Sipariş</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sipariş Tarihi</label>
                                <input required type="date" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Beklenen Tarih</label>
                                <input required type="date" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={formData.expected_coming_date} onChange={e => setFormData({ ...formData, expected_coming_date: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg transition-colors font-medium">İptal</button>
                        <button type="submit" disabled={isSubmitDisabled} className={`flex-1 px-4 py-2.5 rounded-lg transition-colors font-medium shadow-lg ${isSubmitDisabled ? 'bg-gray-300 text-gray-500 shadow-none cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}>Sipariş Oluştur</button>
                    </div>
                </form>

                <MissingSupplierPopup
                    isOpen={isMissingSupplierOpen}
                    missingItems={[{ item_id: formData.item_id }]}
                    onComplete={() => {
                        setIsMissingSupplierOpen(false);
                        fetchSuppliersData(); // Refresh the list
                    }}
                />
            </div>
        </div>
    );
};

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemSupplier: "", // Search in Item ID or Supplier ID
        startDate: "",
        endDate: "",
        status: "",
        purpose: "",
    });
    const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

    // Inline Arrival State
    const [editingArrivalId, setEditingArrivalId] = useState(null);
    const [editArrivalDate, setEditArrivalDate] = useState("");

    // Confirmation Modal State
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

    // Fetch Orders on Mount
    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await api.get("/orders");
            setOrders(response.data);
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return orders.filter((order) => {
            const search = filters.itemSupplier.toLowerCase();
            const matchesSearch =
                order.item_id.toLowerCase().includes(search) ||
                order.supplier_id.toLowerCase().includes(search);

            let matchesDate = true;
            if (filters.startDate || filters.endDate) {
                const orderDate = new Date(order.purchase_date).getTime();
                if (filters.startDate) {
                    const start = new Date(filters.startDate).getTime();
                    if (orderDate < start) matchesDate = false;
                }
                if (filters.endDate) {
                    const end = new Date(filters.endDate).getTime();
                    if (orderDate > end) matchesDate = false;
                }
            }

            const matchesStatus = filters.status ? order.status === filters.status : true;
            const matchesPurpose = filters.purpose ? order.purpose === filters.purpose : true;

            return matchesSearch && matchesDate && matchesStatus && matchesPurpose;
        });
    }, [orders, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemSupplier: "", startDate: "", endDate: "", status: "", purpose: "" });
    };

    // New Order Handler
    const handleCreateOrder = async (newOrder) => {
        try {
            await api.post("/orders", newOrder);
            toast.success("Sipariş başarıyla oluşturuldu.");
            fetchOrders();
            setIsNewOrderModalOpen(false);
        } catch (error) {
            console.error("Error creating order:", error);
            toast.error("Sipariş oluşturulamadı: " + (error.response?.data?.detail || error.message));
        }
    };

    // Arrival Handlers
    const startArrivalEdit = (order) => {
        if (!order.actual_coming_date) {
            setEditingArrivalId(order.id);
            setEditArrivalDate(new Date().toISOString().split('T')[0]);
        }
    };

    const cancelArrivalEdit = () => {
        setEditingArrivalId(null);
        setEditArrivalDate("");
    };

    const handleConfirmArrival = async (orderId) => {
        if (!editArrivalDate) return;
        try {
            await api.put("/orders/receive", {
                id: orderId,
                actual_coming_date: editArrivalDate
            });

            toast.success("Sipariş girişi onaylandı.");
            // Optimistically update
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, actual_coming_date: editArrivalDate, status: 'Geldi' } : o));
            setEditingArrivalId(null);
            setEditArrivalDate("");
        } catch (error) {
            console.error("Error updating order:", error);
            toast.error("İşlem başarısız.");
        }
    };

    const handleDeleteOrder = async (id) => {
        try {
            await api.delete(`/orders/${id}`);
            toast.success("Sipariş silindi.");
            fetchOrders();
        } catch (error) {
            console.error("Error deleting order:", error);
            toast.error("Silme işlemi başarısız.");
        }
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        Satın Alım Siparişleri
                    </h1>
                    <p className="text-gray-500 mt-1">Tedarikçilerden beklenen siparişleri takip edin.</p>
                </div>
                <button
                    onClick={() => setIsNewOrderModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 group"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    <span>Yeni Sipariş</span>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center shrink-0 flex-wrap">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="itemSupplier"
                        placeholder="Ürün veya Tedarikçi Ara..."
                        value={filters.itemSupplier}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
                <div className="relative flex-1 w-full md:w-auto">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="date"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                    />
                </div>
                <div className="relative flex-1 w-full md:w-auto">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="date"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                    />
                </div>
                <div className="relative w-full md:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        name="purpose"
                        value={filters.purpose}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                    >
                        <option value="">Tüm Amaçlar</option>
                        <option value="normal_sipariş">Normal Sipariş</option>
                        <option value="emniyet_stoku_için">Emniyet Stoku</option>
                        <option value="acil_sipariş">Acil Sipariş</option>
                    </select>
                </div>
                <div className="relative w-full md:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        name="status"
                        value={filters.status}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                    >
                        <option value="">Tüm Durumlar</option>
                        <option value="Bekleniyor">Bekleniyor</option>
                        <option value="Geldi">Geldi</option>
                    </select>
                </div>
                <button
                    onClick={handleClearFilters}
                    className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-200 w-full md:w-auto"
                >
                    Filtreleri Temizle
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full relative">
                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tedarikçi</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Birim</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Amacı</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sipariş T.</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Beklenen T.</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Gerçekleşen T.</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Durum</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((order) => {
                                const isEditable = !order.actual_coming_date;
                                return (
                                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.item_id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{order.supplier_id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">{order.amount}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{order.unit}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {order.purpose ? (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${order.purpose === 'acil_sipariş' ? 'bg-red-100 text-red-800' :
                                                    order.purpose === 'emniyet_stoku_için' ? 'bg-orange-100 text-orange-800' :
                                                        'bg-indigo-50 text-indigo-700'
                                                    }`}>
                                                    {order.purpose.replace(/_/g, ' ')}
                                                </span>
                                            ) : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{order.purchase_date}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{order.expected_coming_date}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {editingArrivalId === order.id ? (
                                                <input
                                                    type="date"
                                                    value={editArrivalDate}
                                                    onChange={(e) => setEditArrivalDate(e.target.value)}
                                                    className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            ) : (
                                                order.actual_coming_date || "-"
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'Geldi' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {editingArrivalId === order.id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleConfirmArrival(order.id)} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-lg" title="Kaydet">
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                    <button onClick={cancelArrivalEdit} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg" title="İptal">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {isEditable && (
                                                        <button
                                                            onClick={() => startArrivalEdit(order)}
                                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                                            title="Düzenle"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    )}
                                                    {order.status === 'Bekleniyor' && (
                                                        <button
                                                            onClick={() => setConfirmDelete({ isOpen: true, id: order.id })}
                                                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-2"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </>
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
                    <div className="text-center text-sm text-gray-400 py-2">
                        {visibleCount} / {totalCount} kayıt gösteriliyor
                    </div>
                </div>
            </div>

            {/* New Order Modal */}
            {isNewOrderModalOpen && (
                <NewOrderModal
                    onClose={() => setIsNewOrderModalOpen(false)}
                    onSubmit={handleCreateOrder}
                />
            )}

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={() => handleDeleteOrder(confirmDelete.id)}
                title="Siparişi Sil"
                message="Bu satın alım siparişini silmek istediğinize emin misiniz?"
            />

        </div>
    );
};

export default Orders;
