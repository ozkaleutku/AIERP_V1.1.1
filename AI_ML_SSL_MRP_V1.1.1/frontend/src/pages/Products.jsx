import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Search, Filter, X, Trash2, Edit2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../api";

// Item Types
const ITEM_TYPES = [
    { value: "mamül", label: "Mamül" },
    { value: "yarı_mamül", label: "Yarı Mamül" },
    { value: "hammadde", label: "Hammadde" },
];

const QUANTITY_TYPES = [
    { value: "adet", label: "Adet" },
    { value: "gram", label: "Gram" },
    { value: "litre", label: "Litre" },
];

const STATUS_TYPES = [
    { value: "Aktif", label: "Aktif" },
    { value: "Pasif", label: "Pasif" },
];

// New Product Modal Component
const NewProductModal = ({ onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState(initialData || {
        item_id: "",
        item_type: "mamül",
        item_quantity_type: "adet",
        activity_status: "Aktif",
    });

    const isEdit = !!initialData;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData, isEdit);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">{isEdit ? "Ürün Düzenle" : "Yeni Ürün Ekle"}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ürün Kodu</label>
                        <input
                            type="text"
                            required

                            value={formData.item_id}
                            onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                            placeholder="Örn: ITEM-005"
                            disabled={isEdit}
                            className={`w-full px-4 py-2 border border-gray-200 rounded-lg outline-none transition-all ${isEdit ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'}`}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tip</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={formData.item_type}
                                disabled={isEdit} // Type usually not editable easily if tied to logic, but user requested 'Edit' for Soft Delete mainly. Let's allow edit if backend supports it. Backend constraints might exist. For now keep disabled to be safe or enable? User said "düzenle butonu ekleyelim pasife çekebilelim". So Activity Statue is key.
                            >
                                {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Birim</label>
                            <select
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={formData.item_quantity_type}
                                onChange={(e) => setFormData({ ...formData, item_quantity_type: e.target.value })}
                                disabled={isEdit}
                            >
                                {QUANTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
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
                </form >
            </div >
        </div >
    );
};

const Products = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
        itemType: "",
        status: "",
    });
    // Pagination State
    const [page, setPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    // Debounce Logic for Search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [filters, page]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = {
                page: page,
                limit: 50,
                search: filters.itemId,
                item_type: filters.itemType || undefined,
                status: filters.status || undefined
            };

            const response = await api.get("/products", { params });
            // Handle new response format { data, total, page, totalPages }
            if (response.data && Array.isArray(response.data.data)) {
                setProducts(response.data.data);
                setTotalRecords(response.data.total);
                setTotalPages(response.data.totalPages);
            } else {
                // Fallback if needed, though backend is updated
                setProducts([]);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
        setPage(1); // Reset to page 1 on filter change
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", itemType: "", status: "" });
        setPage(1);
    };

    const handleSaveProduct = async (productData, isEdit) => {
        try {
            if (isEdit) {
                await api.put(`/products/${productData.item_id}`, {
                    activity_status: productData.activity_status
                });
            } else {
                await api.post("/products", productData);
            }
            fetchProducts();
            setIsModalOpen(false);
            setEditingProduct(null);
        } catch (error) {
            console.error("Error saving product:", error);
            alert("İşlem başarısız.");
        }
    };

    const openNewModal = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const openEditModal = (product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleDeleteProduct = async (itemId) => {
        if (!window.confirm(`${itemId} ürününü silmek istediğinize emin misiniz?`)) return;

        try {
            await api.delete(`/products/${itemId}`);
            fetchProducts();
        } catch (error) {
            console.error("Error deleting product:", error);
            alert("Ürün silinirken hata oluştu.");
        }
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        Ürünler
                    </h1>
                    <p className="text-gray-500 mt-1">Sistemdeki tüm ürünleri yönetin.</p>
                </div>
                <button
                    onClick={openNewModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 group"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    <span>Yeni Ürün</span>
                </button>
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
                <div className="relative w-full md:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        name="itemType"
                        value={filters.itemType}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                    >
                        <option value="">Tüm Tipler</option>
                        <option value="hammadde">Hammadde</option>
                        <option value="yarı_mamül">Yarı Mamül</option>
                        <option value="mamül">Mamül</option>
                    </select>
                </div>
                <div className="relative w-full md:w-48">
                    <select
                        name="status"
                        value={filters.status}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                    >
                        <option value="">Tüm Durumlar</option>
                        <option value="Aktif">Aktif</option>
                        <option value="Pasif">Pasif</option>
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tip</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Birim</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ortalama Talep</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Talep Sapması</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.map((item) => (
                                <tr
                                    key={item.item_id}
                                    className="hover:bg-gray-50/50 transition-colors"
                                >
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{item.item_type?.replace('_', ' ')}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{item.item_quantity_type}</td>

                                    <td className="px-6 py-4 text-sm">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.activity_status === 'Aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {item.activity_status}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{item.demand_avg}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.demand_deviation}</td>

                                    <td className="px-6 py-4 text-right text-sm">
                                        <button
                                            onClick={() => handleDeleteProduct(item.item_id)}
                                            className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition-colors"
                                            title="Sil"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => openEditModal(item)}
                                            className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-lg transition-colors ml-2"
                                            title="Düzenle"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                        Toplam {totalRecords} kayıttan {(page - 1) * 50 + 1} - {Math.min(page * 50, totalRecords)} arası gösteriliyor
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
                            Sayfa {page} / {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* New Product Modal */}
            {isModalOpen && (
                <NewProductModal
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSaveProduct}
                    initialData={editingProduct}
                />
            )}
        </div>
    );
};

export default Products;
