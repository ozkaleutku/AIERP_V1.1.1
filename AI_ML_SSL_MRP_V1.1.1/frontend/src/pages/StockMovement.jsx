import { useState, useMemo, useEffect } from "react";
import { Search, Plus, X, Filter, Calendar } from "lucide-react";
import api from "../api";

// New Stock Movement Modal
const NewStockMovementModal = ({ onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        item_id: "",
        amount: "",
        purpose: "giriş",
        date: new Date().toISOString().split("T")[0],
    });

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

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            amount: parseFloat(formData.amount)
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Yeni Stok Hareketi</h2>
                    <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Ürün Kodu</label>
                        <input required type="text" className="w-full border rounded p-2"
                            value={formData.item_id} onChange={e => setFormData({ ...formData, item_id: e.target.value })}
                            list="sm-product-options"
                            placeholder="Ürün Seçiniz veya Yazınız" />
                        <datalist id="sm-product-options">
                            {products.map((p) => (
                                <option key={p.item_id} value={p.item_id} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Miktar</label>
                        <input required type="number" className="w-full border rounded p-2"
                            value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amaç</label>
                        <select required className="w-full border rounded p-2"
                            value={formData.purpose} onChange={e => setFormData({ ...formData, purpose: e.target.value })}>
                            <option value="giriş">Giriş</option>
                            <option value="çıkış">Çıkış</option>
                            <option value="üretime_giden">Üretime Giden</option>
                            <option value="satış_çıkışı">Satış Çıkışı</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tarih</label>
                        <input required type="date" className="w-full border rounded p-2"
                            value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 p-2 rounded hover:bg-gray-200">İptal</button>
                        <button type="submit" className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const StockMovement = () => {
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        itemId: "",
        purpose: "",
        startDate: "",
        endDate: "",
    });
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch Movements on Mount
    useEffect(() => {
        fetchMovements();
    }, []);

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

            let matchesDate = true;
            if (filters.startDate || filters.endDate) {
                const itemDate = new Date(item.date);
                if (filters.startDate) matchesDate = matchesDate && itemDate >= new Date(filters.startDate);
                if (filters.endDate) matchesDate = matchesDate && itemDate <= new Date(filters.endDate);
            }

            return matchesId && matchesPurpose && matchesDate;
        });
    }, [movements, filters]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleClearFilters = () => {
        setFilters({ itemId: "", purpose: "", startDate: "", endDate: "" });
    };

    const handleCreateMovement = async (newItem) => {
        try {
            await api.post("/stock-movements", newItem);
            fetchMovements();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error creating movement:", error);
            alert("Hata oluştu.");
        }
    };

    if (loading) return <div className="p-6">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        Depo Hareketleri
                    </h1>
                    <p className="text-gray-500 mt-1">Stok giriş-çıkış hareketlerini izleyin.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 group"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    <span>Yeni Hareket</span>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ürün Kodu</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Miktar</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amaç</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-600">{item.date}</td>
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
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <NewStockMovementModal
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleCreateMovement}
                />
            )}
        </div>
    );
};

export default StockMovement;
