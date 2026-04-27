import { useState, useMemo, useEffect } from "react";
import { Search, Filter, Plus, Edit2, X, Trash2, Globe, Phone, Mail, MapPin, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import api from "../../../api";
import toast from "react-hot-toast";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import MissingSupplierPopup from '../components/MissingSupplierPopup';
import { useInfiniteScroll } from "../../../shared/hooks/useInfiniteScroll";

// New Supplier Modal Component
const NewSupplierModal = ({ onClose, onSubmit, existingSuppliers = [] }) => {
    const [formData, setFormData] = useState({
        item_id: "",
        supplier_id: "",
        given_leadtime: "",
        given_leadtime_deviation: "",
        lot_size: "",
        min_size: "",
        max_size: "",
        calculated: false,
        status: "Aktif",
    });

    const [products, setProducts] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.get("/products");
                const allProducts = response.data.data || response.data || [];
                // Filter out 'mamül' (Finished Goods)
                setProducts(allProducts.filter(p => p.item_type !== 'mamül'));
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        fetchProducts();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (formData.given_leadtime === "" || parseFloat(formData.given_leadtime) < 0) {
            setError("Lütfen geçerli bir süre giriniz!");
            return;
        }

        if (
            parseFloat(formData.given_leadtime_deviation) < 0 ||
            parseFloat(formData.lot_size) < 0 ||
            parseFloat(formData.min_size) < 0 ||
            parseFloat(formData.max_size) < 0
        ) {
            setError("Lütfen geçerli değerler girin (Negatif sayı girilemez).");
            return;
        }

        // Convert empty strings to 0 before submitting
        const dataToSubmit = {
            ...formData,
            given_leadtime: parseFloat(formData.given_leadtime) || 0,
            given_leadtime_deviation: parseFloat(formData.given_leadtime_deviation) || 0,
            lot_size: parseFloat(formData.lot_size) || 0,
            min_size: parseFloat(formData.min_size) || 0,
            max_size: parseFloat(formData.max_size) || 0,
        };

        try {
            await onSubmit(dataToSubmit);
        } catch (err) {
            if (err.response && err.response.status === 409) {
                setError("Bu ürün ve tedarikçi zaten eşleşmiş!");
            } else {
                setError("Bir hata oluştu. Lütfen tekrar deneyin.");
                console.error(err);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Yeni Tedarikçi İlişkisi</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ürün Kodu</label>
                            <input required type="text"
                                className={`w-full border rounded p-2 ${error && error.includes('eşleşmiş') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                value={formData.item_id}
                                onChange={e => {
                                    setFormData({ ...formData, item_id: e.target.value });
                                    if (error) setError("");
                                }}
                                list="sup-product-options"
                                placeholder="Ürün Seçiniz veya Yazınız" />
                            <datalist id="sup-product-options">
                                {products.map((p) => (
                                    <option key={p.item_id} value={p.item_id} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Tedarikçi Kodu</label>
                            <input required type="text"
                                className={`w-full border rounded p-2 ${error && error.includes('eşleşmiş') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                value={formData.supplier_id}
                                onChange={e => {
                                    setFormData({ ...formData, supplier_id: e.target.value });
                                    if (error) setError("");
                                }}
                                list="sup-id-options"
                                placeholder="Tedarikçi Seçiniz veya Yazınız"
                            />
                            <datalist id="sup-id-options">
                                {existingSuppliers.map((supId) => (
                                    <option key={supId} value={supId} />
                                ))}
                            </datalist>
                        </div>
                    </div>
                    {error && (
                        <p className="text-red-500 text-sm -mt-2 flex items-center gap-1 animate-in slide-in-from-top-1">
                            <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                            {error}
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Söz Verilen Süre (Gün)</label>
                            <input type="number" min="0"
                                className={`w-full border rounded p-2 ${error && error.includes('süre') ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                placeholder="0"
                                value={formData.given_leadtime}
                                onChange={e => {
                                    setFormData({ ...formData, given_leadtime: e.target.value });
                                    if (error) setError("");
                                }} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Tahmini Sapma (Gün)</label>
                            <input type="number" min="0" className="w-full border rounded p-2" placeholder="0"
                                value={formData.given_leadtime_deviation} onChange={e => setFormData({ ...formData, given_leadtime_deviation: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Lot Size</label>
                            <input type="number" min="0" className="w-full border rounded p-2" placeholder="0"
                                value={formData.lot_size} onChange={e => setFormData({ ...formData, lot_size: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Min Size</label>
                            <input type="number" min="0" className="w-full border rounded p-2" placeholder="0"
                                value={formData.min_size} onChange={e => setFormData({ ...formData, min_size: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Max Size</label>
                            <input type="number" min="0" className="w-full border rounded p-2" placeholder="0"
                                value={formData.max_size} onChange={e => setFormData({ ...formData, max_size: e.target.value })} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="useCalculated"
                            checked={formData.calculated}
                            onChange={e => setFormData({ ...formData, calculated: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <label htmlFor="useCalculated" className="text-sm font-medium text-gray-700">
                            Sistem Hesaplamasını Kullan (Otomatik Veri)
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">İptal</button>
                        <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    );
};



const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
        supplierId: "",
        status: "", // "Aktif" | "Pasif" | ""
        calculated: "", // "true" | "false" | ""
    });
    const [editingId, setEditingId] = useState(null); // Composite Key: itemId-supplierId
    const [editForm, setEditForm] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Missing Suppliers State
    const [missingItems, setMissingItems] = useState([]);
    const [showMissingPopup, setShowMissingPopup] = useState(false);

    // Confirmation State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        itemId: null,
        supplierId: null,
        type: 'danger'
    });

    // Valid unique supplier IDs for autocomplete
    const uniqueSupplierIds = useMemo(() => {
        return [...new Set(suppliers.map(s => s.supplier_id))];
    }, [suppliers]);

    // Fetch Suppliers on Mount
    useEffect(() => {
        fetchSuppliers();
        fetchMissingSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const response = await api.get("/suppliers");
            setSuppliers(response.data.data || response.data || []);
        } catch (error) {
            console.error("Error fetching suppliers:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMissingSuppliers = async () => {
        try {
            const response = await api.get("/suppliers/missing");
            if (response.data && response.data.missing_items) {
                // Return format is { missing_items: ["item1", "item2"] }
                // Need to convert to objects for the popup: [{ item_id: "item1" }, ...]
                const items = response.data.missing_items.map(itemId => ({ item_id: itemId }));
                setMissingItems(items);
            }
        } catch (error) {
            console.error("Error fetching missing suppliers:", error);
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return suppliers.filter((item) => {
            const matchesItem = item.item_id.toLowerCase().includes(filters.itemId.toLowerCase());
            const matchesSupplier = item.supplier_id.toLowerCase().includes(filters.supplierId.toLowerCase());
            const matchesStatus = filters.status ? item.activity_status === filters.status : true;
            const matchesCalculated = filters.calculated === "" ? true : (filters.calculated === "true" ? item.calculated : !item.calculated);
            return matchesItem && matchesSupplier && matchesStatus && matchesCalculated;
        });
    }, [suppliers, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", supplierId: "", status: "", calculated: "" });
    };

    const handleAddSupplier = async (newData) => {
        // Error handling is managed in the modal
        const toastId = toast.loading("Tedarikçi ilişkisi oluşturuluyor...");
        try {
            await api.post("/suppliers", newData);
            toast.success("Tedarikçi ilişkisi başarıyla oluşturuldu.", { id: toastId });
            fetchSuppliers();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error adding supplier:", error);
            toast.error(error.response?.data?.detail || "İşlem sırasında bir hata oluştu.", { id: toastId });
        }
    };

    const handleDeleteClick = (item_id, supplier_id) => {
        setConfirmModal({
            isOpen: true,
            title: 'İlişkiyi Sil',
            message: `${item_id} - ${supplier_id} ilişkisini silmek istediğinize emin misiniz?`,
            itemId: item_id,
            supplierId: supplier_id,
            type: 'danger'
        });
    };

    const confirmDelete = async () => {
        if (!confirmModal.itemId || !confirmModal.supplierId) return;

        try {
            await api.delete(`/suppliers/${confirmModal.itemId}/${confirmModal.supplierId}`);
            fetchSuppliers();
            setConfirmModal({ ...confirmModal, isOpen: false });
            toast.success("Tedarikçi ilişkisi başarıyla silindi.");
        } catch (error) {
            console.error("Error deleting supplier relation:", error);
            toast.error("Silme işlemi başarısız.");
        }
    };

    // Inline Edit Handlers
    const startEditing = (row) => {
        setEditingId(`${row.item_id}-${row.supplier_id}`);
        setEditForm(row);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEditing = async () => {
        if (
            parseFloat(editForm.given_leadtime) < 0 ||
            parseFloat(editForm.given_leadtime_deviation) < 0 ||
            parseFloat(editForm.lot_size) < 0 ||
            parseFloat(editForm.min_size) < 0 ||
            parseFloat(editForm.max_size) < 0
        ) {
            toast.error("Lütfen geçerli değerler girin (Negatif sayı girilemez).");
            return;
        }

        const toastId = toast.loading("Tedarikçi güncelleniyor...");
        try {
            await api.put("/suppliers/update", {
                item_id: editForm.item_id,
                supplier_id: editForm.supplier_id,
                given_leadtime: parseFloat(editForm.given_leadtime),
                given_leadtime_deviation: parseFloat(editForm.given_leadtime_deviation),
                lot_size: parseFloat(editForm.lot_size),
                min_size: parseFloat(editForm.min_size),
                max_size: parseFloat(editForm.max_size),
                calculated: editForm.calculated,
                status: editForm.activity_status
            });

            toast.success("Tedarikçi güncellendi.", { id: toastId });
            setEditingId(null);
            await fetchSuppliers();
        } catch (error) {
            console.error("Error updating supplier:", error);
            toast.error(error.response?.data?.detail || "Güncelleme başarısız oldu.", { id: toastId });
        }
    };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Missing Suppliers Notification Banner */}
            {missingItems.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between shrink-0 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 text-red-700">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <h3 className="font-bold text-sm">Dikkat: Tedarikçisi eksik olan {missingItems.length} ürün bulundu.</h3>
                            <p className="text-xs text-red-600/80 mt-0.5">Sipariş oluşturabilmek için ürünlere tedarikçi tanımlamalısınız.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowMissingPopup(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        Tedarikçileri Tanımla
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        Tedarikçiler
                    </h1>
                    <p className="text-gray-500 mt-1">Ürün-Tedarikçi ilişkilerini ve teslimat performanslarını yönetin.</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                    <Plus size={20} /> Yeni Ekle
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center shrink-0">
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
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="supplierId"
                        placeholder="Tedarikçi Kodu Ara..."
                        value={filters.supplierId}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
                <div className="relative w-full md:w-48">
                    <select
                        name="status"
                        value={filters.status}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="">Tüm Durumlar</option>
                        <option value="Aktif">Aktif</option>
                        <option value="Pasif">Pasif</option>
                    </select>
                </div>
                <div className="relative w-full md:w-48">
                    <select
                        name="calculated"
                        value={filters.calculated}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                        <option value="">Tümü (Veri Tipi)</option>
                        <option value="true">Otomatik (Hesaplanan)</option>
                        <option value="false">Manuel Girilen</option>
                    </select>
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
                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-20">
                            <tr>
                                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün</th>
                                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tedarikçi</th>

                                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Hesaplanan?</th>
                                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-50">Given Mean</th>
                                <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-50">Given Std</th>
                                <th className="px-4 py-4 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50">Calc Mean</th>
                                <th className="px-4 py-4 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50">Calc Std</th>
                                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot</th>
                                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Min</th>
                                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Max</th>
                                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider sticky right-0 z-10 bg-gray-50 shadow-[-12px_0_15px_-4px_rgba(0,0,0,0.05)]">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((item) => {
                                const rowKey = `${item.item_id}-${item.supplier_id}`;
                                const isEditing = editingId === rowKey;
                                const useCalculated = isEditing ? editForm.calculated : item.calculated;

                                return (
                                    <tr
                                        key={rowKey}
                                        className={`group hover:bg-gray-50 transition-colors ${isEditing ? "bg-yellow-50" : ""}`}
                                    >
                                        <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                        <td className="px-4 py-4 text-sm text-gray-600">{item.supplier_id}</td>


                                        {/* Use Calculated Checkbox */}
                                        <td className="px-4 py-4 text-center">
                                            {isEditing ? (
                                                <input
                                                    type="checkbox"
                                                    name="calculated"
                                                    checked={editForm.calculated}
                                                    onChange={handleEditChange}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                            ) : (
                                                item.calculated ? (
                                                    <div className="flex justify-center"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div></div>
                                                ) : (
                                                    <div className="flex justify-center"><div className="w-2.5 h-2.5 rounded-full bg-gray-300"></div></div>
                                                )
                                            )}
                                        </td>

                                        {/* Given Mean */}
                                        <td className="px-4 py-4 text-right text-sm text-gray-600 bg-gray-50/30 font-medium border-l border-gray-100">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    name="given_leadtime"
                                                    disabled={useCalculated}
                                                    value={editForm.given_leadtime}
                                                    onChange={handleEditChange}
                                                    className={`w-16 px-1 border rounded text-right ${useCalculated ? 'bg-gray-100 text-gray-400' : 'bg-white'}`}
                                                />
                                            ) : (
                                                <span className={useCalculated ? 'text-gray-400 line-through' : ''}>
                                                    {item.given_leadtime}
                                                </span>
                                            )}
                                        </td>

                                        {/* Given Deviation */}
                                        <td className="px-4 py-4 text-right text-sm text-gray-600 bg-gray-50/30 border-r border-gray-100">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    name="given_leadtime_deviation"
                                                    disabled={useCalculated}
                                                    value={editForm.given_leadtime_deviation}
                                                    onChange={handleEditChange}
                                                    className={`w-16 px-1 border rounded text-right ${useCalculated ? 'bg-gray-100 text-gray-400' : 'bg-white'}`}
                                                />
                                            ) : (
                                                <span className={useCalculated ? 'text-gray-400 line-through' : ''}>
                                                    {item.given_leadtime_deviation || 0}
                                                </span>
                                            )}
                                        </td>

                                        {/* Calc Mean (Read-only) */}
                                        <td className="px-4 py-4 text-right text-sm text-blue-600 bg-blue-50/20 font-bold">
                                            {item.calculated_leadtime_avg ? Math.round(item.calculated_leadtime_avg * 100) / 100 : '-'}
                                        </td>

                                        {/* Calc Std (Read-only) */}
                                        <td className="px-4 py-4 text-right text-sm text-blue-600 bg-blue-50/20">
                                            {item.calculated_leadtime_deviation ? Math.round(item.calculated_leadtime_deviation * 100) / 100 : '-'}
                                        </td>

                                        {/* Lot Size */}
                                        <td className="px-4 py-4 text-right text-sm text-gray-600">
                                            {isEditing ? (
                                                <input type="number" min="0" name="lot_size" value={editForm.lot_size} onChange={handleEditChange} className="w-16 px-1 border rounded text-right" />
                                            ) : (item.lot_size || '-')}
                                        </td>

                                        {/* Min Size */}
                                        <td className="px-4 py-4 text-right text-sm text-gray-600">
                                            {isEditing ? (
                                                <input type="number" min="0" name="min_size" value={editForm.min_size} onChange={handleEditChange} className="w-16 px-1 border rounded text-right" />
                                            ) : (item.min_size || '-')}
                                        </td>

                                        {/* Max Size */}
                                        <td className="px-4 py-4 text-right text-sm text-gray-600">
                                            {isEditing ? (
                                                <input type="number" min="0" name="max_size" value={editForm.max_size} onChange={handleEditChange} className="w-16 px-1 border rounded text-right" />
                                            ) : (item.max_size || '-')}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-4 text-center text-sm">
                                            {isEditing ? (
                                                <select name="activity_status" value={editForm.activity_status} onChange={handleEditChange} className="border rounded text-sm px-1 py-0.5" >
                                                    <option value="Aktif">Aktif</option> <option value="Pasif">Pasif</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.activity_status === 'Aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {item.activity_status && item.activity_status[0]}
                                                </span>
                                            )}
                                        </td>

                                        <td className={`px-4 py-4 text-right text-sm font-medium sticky right-0 z-10 shadow-[-12px_0_15px_-4px_rgba(0,0,0,0.05)] transition-colors ${isEditing ? "bg-yellow-50" : "bg-white group-hover:bg-gray-50"}`}>
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={saveEditing} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-lg"> <CheckCircle2 size={16} /> </button>
                                                    <button onClick={cancelEditing} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg"> <XCircle size={16} /> </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleDeleteClick(item.item_id, item.supplier_id)} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-900 bg-blue-50 px-2 py-1.5 rounded-lg flex items-center gap-1">
                                                        <Edit2 size={14} />
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
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                    <div className="text-center text-sm text-gray-400 py-2">
                        {visibleCount} / {totalCount} kayıt gösteriliyor
                    </div>
                </div>
            </div>

            {/* New Supplier Rel Modal */}
            {isModalOpen && (
                <NewSupplierModal
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleAddSupplier}
                    existingSuppliers={uniqueSupplierIds}
                />
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmDelete}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
            />

            {/* Missing Supplier Force Popup (Manual Trigger) */}
            {showMissingPopup && missingItems.length > 0 && (
                <MissingSupplierPopup
                    missingItems={missingItems}
                    isOpen={true}
                    onComplete={() => {
                        setShowMissingPopup(false);
                        fetchSuppliers();
                        fetchMissingSuppliers();
                    }}
                />
            )}
        </div>
    );
};

export default Suppliers;
