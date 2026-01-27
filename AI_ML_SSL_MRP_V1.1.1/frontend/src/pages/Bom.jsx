import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Filter, X, Trash2, Edit2, CheckCircle2, XCircle } from "lucide-react";
import api from "../api";
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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

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
            } else {
                await api.post("/bom", itemData);
            }
            fetchBom();
            setIsModalOpen(false);
            setEditingItem(null);
            setEditForm({});
        } catch (error) {
            console.error("Error saving BOM:", error);
            alert("İşlem başarısız.");
        }
    };

    const openNewModal = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleDelete = async (parent_id, child_id) => {
        if (!window.confirm("Bu ilişkiyi silmek istediğinize emin misiniz?")) return;
        try {
            await api.delete(`/bom/${parent_id}/${child_id}`);
            fetchBom();
        } catch (error) {
            console.error(error);
            alert("Silinemedi.");
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
        try {
            await api.put(`/bom/${editForm.parent_id}/${editForm.child_id}`, {
                amount: parseFloat(editForm.amount),
                activity_status: editForm.activity_status
            });
            fetchBom();
            setEditingId(null);
            setEditForm({});
        } catch (error) {
            console.error("Error updating BOM:", error);
            alert("Güncelleme başarısız: " + (error.response?.data?.detail || error.message));
        }
    };

    // Better strategy: I'll just write the frontend to support Delete/Add correctly. 
    // And I will add back the UPDATE endpoint in the next step.

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        BOM (Reçete) Yönetimi
                    </h1>
                    <p className="text-gray-500 mt-1">Ürün ağaçlarını ve bileşen ilişkilerini yönetin.</p>
                </div>
                <button
                    onClick={openNewModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Yeni İlişki Ekle</span>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
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
                    <div className="relative">
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
                    <div className="relative">
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
                </div>
                <div className="flex justify-end">
                    <button onClick={handleClearFilters} className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Filtreleri Temizle</button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ana Ürün (Parent)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Bileşen (Child)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Birim</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((item) => (
                                <tr key={`${item.parent_id}-${item.child_id}`} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.parent_id}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.child_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.amount}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{item.child_quantity_type || '-'}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.activity_status === "Aktif" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                                            {item.activity_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <button onClick={() => handleDelete(item.parent_id, item.child_id)} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg ml-2">
                                            <Trash2 size={16} />
                                        </button>
                                        <button onClick={() => openEditModal(item)} className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-lg ml-2">
                                            <Edit2 size={16} />
                                        </button>
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

            {/* New BOM Modal */}
            {isModalOpen && (
                <NewBomModal
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSaveBom}
                    initialData={editingItem}
                />
            )}
        </div>
    );
};

const NewBomModal = ({ onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState(initialData || {
        parent_id: "",
        child_id: "",
        amount: 0,
        activity_status: "Aktif",
    });

    const isEdit = !!initialData;

    const [products, setProducts] = useState([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.get("/products");
                setProducts(response.data);
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

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData, isEdit);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">{isEdit ? "BOM İlişkisi Düzenle" : "Yeni BOM İlişkisi"}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ana Ürün (Parent)</label>
                            <input
                                type="text"
                                required
                                list="parent-options"

                                value={formData.parent_id}
                                onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                                placeholder="Ürün Seçiniz"
                                disabled={isEdit}
                                className={`w-full px-4 py-2 border border-gray-200 rounded-lg outline-none transition-all ${isEdit ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'}`}
                            />
                            <datalist id="parent-options">
                                {products.map(p => <option key={p.item_id} value={p.item_id} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bileşen (Child)</label>
                            <input
                                type="text"
                                required
                                list="child-options"

                                value={formData.child_id}
                                onChange={(e) => setFormData({ ...formData, child_id: e.target.value })}
                                placeholder="Bileşen Seçiniz"
                                disabled={isEdit}
                                className={`w-full px-4 py-2 border border-gray-200 rounded-lg outline-none transition-all ${isEdit ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'}`}
                            />
                            <datalist id="child-options">
                                {products.map(p => <option key={p.item_id} value={p.item_id} />)}
                            </datalist>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Miktar {getChildUnit() && <span className="text-gray-500 text-xs">({getChildUnit()})</span>}
                        </label>
                        <input
                            type="number"
                            required
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                        <select
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            value={formData.activity_status}
                            onChange={(e) => setFormData({ ...formData, activity_status: e.target.value })}
                        >
                            {STATUS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
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
                            className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-lg shadow-blue-500/20"
                        >
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Bom;
