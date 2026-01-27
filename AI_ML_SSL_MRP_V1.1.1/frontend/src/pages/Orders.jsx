import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Plus, Calendar as CalendarIcon, Edit2, X, Trash2 } from "lucide-react";
import api from "../api";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, supRes] = await Promise.all([
                    api.get("/products"),
                    api.get("/suppliers")
                ]);
                setProducts(prodRes.data.data || prodRes.data || []);
                setAllSupplierItems(supRes.data);
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

    const handleSubmit = (e) => {
        e.preventDefault();
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
                                <select
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={formData.item_id}
                                    onChange={e => setFormData({ ...formData, item_id: e.target.value })}
                                >
                                    <option value="">Ürün Seçiniz</option>
                                    {products.map(p => <option key={p.item_id} value={p.item_id}>{p.item_id}</option>)}
                                </select>
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
                                    <p className="text-xs text-red-500 mt-1">Bu ürün için tanımlı tedarikçi bulunamadı.</p>
                                )}
                            </div>

                            {/* supplier info box */}
                            {selectedSupplierInfo && (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900 space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2">
                                        ℹ️ Tedarikçi Koşulları
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
                                <input required type="number" className="w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
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
                        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20">Sipariş Oluştur</button>
                    </div>
                </form>
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
    });
    const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

    // Arrival Modal State
    const [arrivalModalOpen, setArrivalModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [arrivalDate, setArrivalDate] = useState("");

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

            return matchesSearch && matchesDate && matchesStatus;
        });
    }, [orders, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemSupplier: "", startDate: "", endDate: "", status: "" });
    };

    // New Order Handler
    const handleCreateOrder = async (newOrder) => {
        try {
            await api.post("/orders", newOrder);
            fetchOrders();
            setIsNewOrderModalOpen(false);
        } catch (error) {
            console.error("Error creating order:", error);
            alert("Sipariş oluşturulamadı.");
        }
    };

    // Arrival Handlers
    const openArrivalModal = (order) => {
        if (!order.actual_coming_date) {
            setSelectedOrder(order);
            setArrivalDate(new Date().toISOString().split('T')[0]);
            setArrivalModalOpen(true);
        }
    };

    const handleConfirmArrival = async () => {
        if (!selectedOrder || !arrivalDate) return;
        try {
            await api.put("/orders/receive", {
                id: selectedOrder.id,
                actual_coming_date: arrivalDate
            });
            fetchOrders();
            setArrivalModalOpen(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error("Error updating order:", error);
            alert("İşlem başarısız.");
        }
    };

    const handleDeleteOrder = async (id) => {
        if (!window.confirm("Bu siparişi silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/orders/${id}`);
            fetchOrders();
        } catch (error) {
            console.error("Error deleting order:", error);
            alert("Silme işlemi başarısız.");
        }
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative md:col-span-1">
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
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="date"
                            name="startDate"
                            value={filters.startDate}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                        />
                    </div>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="date"
                            name="endDate"
                            value={filters.endDate}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
                        />
                    </div>
                    <div className="relative">
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tedarikçi</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Birim</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sipariş Tarihi</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Beklenen Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Gerçekleşen Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
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
                                        <td className="px-6 py-4 text-sm text-gray-600">{order.purchase_date}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{order.expected_coming_date}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {order.actual_coming_date || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'Geldi' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {isEditable && (
                                                <button
                                                    onClick={() => openArrivalModal(order)}
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                    Geldi İşaretle
                                                </button>
                                            )}
                                            {order.status === 'Bekleniyor' && (
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-2"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
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

            {/* Arrival Modal */}
            {arrivalModalOpen && selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Sipariş Teslim Al</h3>
                        <p className="text-gray-600 mb-4">
                            <strong>{selectedOrder.item_id}</strong> - {selectedOrder.amount} {selectedOrder.unit}
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Gerçekleşen Tarih</label>
                            <input
                                type="date"
                                value={arrivalDate}
                                onChange={(e) => setArrivalDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setArrivalModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">İptal</button>
                            <button onClick={handleConfirmArrival} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Onayla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Orders;
