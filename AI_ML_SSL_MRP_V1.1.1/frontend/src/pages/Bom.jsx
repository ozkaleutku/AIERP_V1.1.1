import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Filter, X, Trash2, Edit2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import api from "../api";
import toast from "react-hot-toast";
import ConfirmModal from "../components/ConfirmModal";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const STATUS_TYPES = [
    { value: "Aktif", label: "Aktif" },
    { value: "Pasif", label: "Pasif" },
];

const Bom = () => {
    const [bomItems, setBomItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        parentId: "",
        childId: "",
        status: "",
    });
    const [editingId, setEditingId] = useState(null); // Composite Key needed? using parent-child
    const [editForm, setEditForm] = useState({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        fetchBom();
    }, []);

    const fetchBom = async () => {
        setLoading(true);
        try {
            const response = await api.get("/bom");
            setBomItems(response.data);
        } catch (error) {
            console.error("Error fetching BOM:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredData = useMemo(() => {
        return bomItems.filter((item) => {
            const matchesParentId = item.parent_id.toLowerCase().includes(filters.parentId.toLowerCase());
            const matchesChildId = item.child_id.toLowerCase().includes(filters.childId.toLowerCase());
            const matchesStatus = filters.status ? item.activity_status === filters.status : true;
            return matchesParentId && matchesChildId && matchesStatus;
        });
    }, [bomItems, filters]);

    // Infinite scroll hook
    const { visibleData, hasMore, loaderRef, visibleCount, totalCount } = useInfiniteScroll(filteredData, filters);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ parentId: "", childId: "", status: "" });
    };

    const handleSaveBom = async (itemData, isEdit) => {
        try {
            if (isEdit) {
                await api.put(`/bom/${itemData.parent_id}/${itemData.child_id}`, {
                    amount: itemData.amount,
                    activity_status: itemData.activity_status
                });
                toast.success("BOM başarıyla güncellendi.");
            } else {
                await api.post("/bom", itemData);
                toast.success("BOM başarıyla oluşturuldu.");
            }
            fetchBoms();
            setShowAddForm(false);
            setEditForm({}); // This line might be redundant if setShowAddForm(false) closes the form
        } catch (error) {
            console.error("Error saving BOM:", error);
            toast.error(error.response?.data?.detail || "BOM kaydedilirken hata oluştu.");
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;

        const { parent_id, child_id } = deleteConfirm;
        const toastId = toast.loading("BOM siliniyor...");
        try {
            await api.delete(`/bom/${parent_id}/${child_id}`);
            toast.success("BOM başarıyla silindi.", { id: toastId });
            fetchBoms();
            setDeleteConfirm(null);
        } catch (error) {
            console.error("Error deleting BOM:", error);
            toast.error(error.response?.data?.detail || "BOM silinirken hata oluştu.", { id: toastId });
        }
    };

    // Inline Edit Handlers
    // Since we don't have a unique single ID, we construct one.
    const startEditing = (row) => {
        setEditingId(`${row.parent_id}-${row.child_id}`);
        setEditForm(row);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEditing = async () => {
        if (parseFloat(editForm.amount) < 0) {
            toast.error("Lütfen geçerli bir miktar girin (Negatif sayı girilemez).");
            return;
        }
        const toastId = toast.loading("BOM güncelleniyor...");
        try {
            await api.put(`/bom/${editForm.parent_id}/${editForm.child_id}`, {
                amount: parseFloat(editForm.amount),
                activity_status: editForm.activity_status
            });
            toast.success("BOM başarıyla güncellendi.", { id: toastId });
            setEditingId(null);
            setEditForm({});
            fetchBoms();
        } catch (error) {
            console.error("Error updating BOM:", error);
            toast.error(error.response?.data?.detail || "Güncelleme başarısız.", { id: toastId });
        }
    };

    // Better strategy: I'll just write the frontend to support Delete/Add correctly. 
    // And I will add back the UPDATE endpoint in the next step.

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        BOM (Reçete) Yönetimi
                    </h1>
                    <p className="text-gray-500 mt-1">Ürün ağaçlarını ve bileşen ilişkilerini yönetin.</p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 text-white ${showAddForm ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                >
                    {showAddForm ? <X size={20} /> : <Plus size={20} />}
                    <span>{showAddForm ? 'İptal Et' : 'Yeni İlişki Ekle'}</span>
                </button>
            </div>

            {/* Inline Add Form */}
            {showAddForm && (
                <div className="shrink-0 animate-in slide-in-from-top-4 duration-300 zoom-in-95">
                    <NewBomForm
                        onClose={() => setShowAddForm(false)}
                        onSubmit={handleSaveBom}
                    />
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center shrink-0">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="parentId"
                        placeholder="Ana Ürün (Parent) Ara..."
                        value={filters.parentId}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        name="childId"
                        placeholder="Bileşen (Child) Ara..."
                        value={filters.childId}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
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
                        {STATUS_TYPES.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
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
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ana Ürün (Parent)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Bileşen (Child)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Birim</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Durum</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((item) => {
                                const rowKey = `${item.parent_id}-${item.child_id}`;
                                const isEditing = editingId === rowKey;
                                return (
                                    <tr key={rowKey} className={`hover:bg-gray-50/50 transition-colors ${isEditing ? "bg-yellow-50/50" : ""}`}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.parent_id}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.child_id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    name="amount"
                                                    value={editForm.amount}
                                                    onChange={e => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                                                    className="w-20 px-2 py-1 border rounded text-right"
                                                />
                                            ) : (
                                                item.amount
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{item.child_quantity_type || '-'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {isEditing ? (
                                                <select
                                                    name="activity_status"
                                                    value={editForm.activity_status}
                                                    onChange={e => setEditForm(prev => ({ ...prev, activity_status: e.target.value }))}
                                                    className="border rounded px-2 py-1"
                                                >
                                                    <option value="Aktif">Aktif</option>
                                                    <option value="Pasif">Pasif</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.activity_status === "Aktif" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                                    {item.activity_status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={saveEditing} className="text-green-600 hover:text-green-900 bg-green-50 p-1.5 rounded-lg">
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                    <button onClick={cancelEditing} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg">
                                                        <XCircle size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => setDeleteConfirm({ parent_id: item.parent_id, child_id: item.child_id })} className="text-red-600 hover:text-red-900 bg-red-50 p-1.5 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1.5 rounded-lg flex items-center gap-1">
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

            <ConfirmModal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={confirmDelete}
                title="BOM İlişkisini Sil"
                message={deleteConfirm ? `${deleteConfirm.parent_id} -> ${deleteConfirm.child_id} ilişkisini silmek istediğinize emin misiniz?` : ""}
                type="danger"
            />
        </div>
    );
};

const NewBomForm = ({ onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        parent_id: "",
        child_id: "",
        amount: "",
        activity_status: "Aktif",
    });
    const [error, setError] = useState("");

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

    // Helper to find unit
    const getChildUnit = () => {
        const product = products.find(p => p.item_id === formData.child_id);
        return product ? product.item_quantity_type : "";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (parseFloat(formData.amount) < 0) {
            setError("Lütfen geçerli bir miktar girin (Negatif sayı girilemez).");
            return;
        }

        const dataToSubmit = {
            ...formData,
            amount: parseFloat(formData.amount) || 0,
        };
        try {
            await onSubmit(dataToSubmit, false);
            // Başarılı kayıttan sonra hata ve formu sıfırla ki peş peşe eklenebilsin
            setError("");
            setFormData({
                parent_id: "",
                child_id: "",
                amount: "",
                activity_status: "Aktif",
            });
        } catch (err) {
            if (err.response && err.response.status === 409) {
                setError("Bu ürün ve bileşen (BOM) ilişkisi zaten tanımlı!");
            } else {
                setError("Bir hata oluştu. Lütfen tekrar deneyin.");
                console.error(err);
            }
        }
    };

    return (
        <div className="bg-white rounded-2xl w-full shadow-sm border border-gray-100 p-6 object-top shadow-blue-500/10 mb-4 transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-2 inline-block">Masaüstü/Ana Ürüne Bileşen Ekle</h2>
                <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors">
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        <label className="block text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Ana Ürün (Parent)</label>
                        <input
                            type="text"
                            required
                            list="parent-options"
                            value={formData.parent_id}
                            onChange={(e) => { setFormData({ ...formData, parent_id: e.target.value }); if (error) setError(""); }}
                            placeholder="Ürün Seçiniz"
                            className={`w-full px-4 py-2 bg-white border rounded-lg outline-none transition-all ${error && error.includes('tanımlı') ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'}`}
                        />
                        <datalist id="parent-options">
                            {products.filter(p => p.item_type !== 'hammadde').map(p => <option key={p.item_id} value={p.item_id} />)}
                        </datalist>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 block"></span>
                            Genellikle Mamül veya Yarı Mamül seçilir (Hammadde kullanılamaz).
                        </p>
                    </div>
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        <label className="block text-sm font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">Bileşen (Child)</label>
                        <input
                            type="text"
                            required
                            list="child-options"
                            value={formData.child_id}
                            onChange={(e) => { setFormData({ ...formData, child_id: e.target.value }); if (error) setError(""); }}
                            placeholder="Bileşen Seçiniz"
                            className={`w-full px-4 py-2 bg-white border rounded-lg outline-none transition-all ${error && error.includes('tanımlı') ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'}`}
                        />
                        <datalist id="child-options">
                            {products.filter(p => p.item_type !== 'mamül').map(p => <option key={p.item_id} value={p.item_id} />)}
                        </datalist>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 block"></span>
                            Genellikle Hammadde veya Yarı Mamül seçilir (Mamül kullanılamaz).
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mt-2 mb-4">
                        <p className="text-red-700 text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-1">
                            <XCircle size={16} />
                            {error}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Kullanım Miktarı {getChildUnit() && <span className="text-gray-500 text-xs font-normal bg-white px-2 py-0.5 rounded-full border border-gray-100 ml-1">Birim: {getChildUnit()}</span>}
                            </label>
                            <input
                                type="number"
                                min="0"
                                required
                                placeholder="0"
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Durum</label>
                            <select
                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={formData.activity_status}
                                onChange={(e) => setFormData({ ...formData, activity_status: e.target.value })}
                            >
                                {STATUS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end px-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-red-600 border border-gray-200 rounded-xl transition-all font-medium active:scale-95"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all font-medium shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            İlişkiyi Kaydet
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Bom;
