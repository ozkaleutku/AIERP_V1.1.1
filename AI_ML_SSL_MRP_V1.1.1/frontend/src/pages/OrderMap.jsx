import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, AlertTriangle, Calendar, Search, Filter, CheckCircle2, Factory, ShieldCheck, X, RotateCcw } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { matchTurkish } from '../utils/stringUtils';

const BATCH_SIZE = 20; // Number of items to load per batch

const OrderMap = () => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Delete Popup State
    const [deletePopupOpen, setDeletePopupOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // Infinite scroll state
    const [visibleProductionCount, setVisibleProductionCount] = useState(BATCH_SIZE);
    const [visibleSafetyCount, setVisibleSafetyCount] = useState(BATCH_SIZE);
    const productionLoaderRef = useRef(null);
    const safetyLoaderRef = useRef(null);

    // Reset Simulation Popup State
    const [resetPopupOpen, setResetPopupOpen] = useState(false);

    // Advanced Filters State
    const [filters, setFilters] = useState({
        search: '', // Matches Item ID or Supplier ID
        startDate: '',
        endDate: ''
    });

    const handleDeleteClick = (item) => {
        setItemToDelete(item);
        setDeletePopupOpen(true);
    };

    const confirmDelete = () => {
        if (itemToDelete) {
            setSuggestions(prev => prev.filter(i =>
                !(i.item_id === itemToDelete.item_id &&
                    i.order_date === itemToDelete.order_date &&
                    i.purpose === itemToDelete.purpose &&
                    i.amount === itemToDelete.amount)
            ));
        }
        setDeletePopupOpen(false);
        setItemToDelete(null);
    };

    const handleResetSimulation = async () => {
        const toastId = toast.loading("Simülasyon sıfırlanıyor...");
        try {
            await api.post('/simulation/reset');
            toast.success("Simülasyon başarıyla sıfırlandı.", { id: toastId });
            setResetPopupOpen(false);
            fetchSuggestions(); // Refresh the list
        } catch (error) {
            console.error("Error resetting simulation:", error);
            toast.error(error.response?.data?.detail || "Sıfırlama sırasında hata oluştu.", { id: toastId });
            setResetPopupOpen(false);
        }
    };

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const response = await api.get('/simulation/suggestions');

            // 1 ay önceki ve daha eski olanları filtrele
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            oneMonthAgo.setHours(0, 0, 0, 0);

            const filteredRecent = response.data.filter(item => {
                if (!item.order_date) return true;
                return new Date(item.order_date) >= oneMonthAgo;
            });

            setSuggestions(filteredRecent);
            console.error("Error fetching simulation data:", error);
        } finally {
            setLoading(false);
        }
    };



    useEffect(() => {
        fetchSuggestions();
    }, []);

    // Reset visible counts when filters change
    useEffect(() => {
        setVisibleProductionCount(BATCH_SIZE);
        setVisibleSafetyCount(BATCH_SIZE);
    }, [filters]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            startDate: '',
            endDate: ''
        });
    };

    // Filter Logic
    const filteredSuggestions = suggestions.filter(item => {
        // 1. Search (Item or Supplier)
        const matchesSearch = matchTurkish(item.item_id, filters.search) ||
            (item.supplier_id && matchTurkish(item.supplier_id, filters.search));

        // 2. Date Range (Order Date)
        let matchesDate = true;
        if (filters.startDate) {
            matchesDate = matchesDate && new Date(item.order_date) >= new Date(filters.startDate);
        }
        if (filters.endDate) {
            matchesDate = matchesDate && new Date(item.order_date) <= new Date(filters.endDate);
        }

        return matchesSearch && matchesDate;
    });

    // Group suggestions AFTER filtering
    const productionSuggestions = filteredSuggestions.filter(s => s.purpose === 'Üretim İçin');
    const safetyStockSuggestions = filteredSuggestions.filter(s => s.purpose === 'Emniyet Stok');

    // Slice to visible count for infinite scroll
    const visibleProduction = productionSuggestions.slice(0, visibleProductionCount);
    const visibleSafety = safetyStockSuggestions.slice(0, visibleSafetyCount);
    const hasMoreProduction = visibleProductionCount < productionSuggestions.length;
    const hasMoreSafety = visibleSafetyCount < safetyStockSuggestions.length;

    // IntersectionObserver for production column
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMoreProduction) {
                    setVisibleProductionCount(prev => prev + BATCH_SIZE);
                }
            },
            { threshold: 0.1 }
        );

        if (productionLoaderRef.current) {
            observer.observe(productionLoaderRef.current);
        }

        return () => observer.disconnect();
    }, [hasMoreProduction]);

    // IntersectionObserver for safety column
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMoreSafety) {
                    setVisibleSafetyCount(prev => prev + BATCH_SIZE);
                }
            },
            { threshold: 0.1 }
        );

        if (safetyLoaderRef.current) {
            observer.observe(safetyLoaderRef.current);
        }

        return () => observer.disconnect();
    }, [hasMoreSafety]);

    const SuggestionCard = ({ item, type }) => {
        const isSafetyStock = type === 'safety';
        const isError = item.status && item.status.includes('HATA');
        const isDelayed = item.status === 'Gecikmiş';

        // Priority: Error > Delayed > Safety Stock > Normal
        let borderClass = 'border-gray-100 bg-white';
        if (isError) borderClass = 'border-red-500 bg-red-50 ring-2 ring-red-200';
        else if (isDelayed) borderClass = 'border-gray-300 bg-gray-100';
        else if (isSafetyStock) borderClass = 'border-orange-200 bg-orange-50';

        return (
            <div className={`p-5 rounded-xl border ${borderClass} shadow-sm hover:shadow-md transition-all`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isError ? 'bg-red-100 text-red-600' : isDelayed ? 'bg-gray-200 text-gray-600' : type === 'production' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                            {isError ? <AlertTriangle size={20} /> : (type === 'production' ? <Factory size={20} /> : <ShieldCheck size={20} />)}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">{item.item_id}</h4>
                            {isError ? (
                                <p className="text-xs font-bold text-red-600">{item.status}</p>
                            ) : isDelayed ? (
                                <p className="text-xs font-bold text-gray-600">GECİKMİŞ SİPARİŞ</p>
                            ) : (
                                <p className="text-xs text-gray-500">{type === 'production' ? 'Üretim Gereksinimi' : 'Emniyet Stok İhlali'}</p>
                            )}
                        </div>
                    </div>
                    {/* Delete Button */}
                    <button
                        onClick={() => handleDeleteClick(item)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sipariş Önerisini Sil"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="bg-white/50 p-2 rounded-lg">
                        <span className="text-gray-400 block text-xs">Miktar</span>
                        <span className="font-semibold text-gray-800">{item.amount} birim</span>
                    </div>
                    <div className="bg-white/50 p-2 rounded-lg">
                        <span className="text-gray-400 block text-xs">Tedarikçi</span>
                        <span className={`font-semibold truncate ${item.supplier_id === 'Bilinmiyor' ? 'text-red-500 italic' : 'text-gray-800'}`}>
                            {item.supplier_id}
                        </span>
                    </div>
                </div>

                <div className="space-y-2 border-t border-black/5 pt-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1"><Calendar size={12} /> Sipariş Tarihi:</span>
                        <span className="font-medium text-gray-700">
                            {item.order_date}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1"><CheckCircle2 size={12} /> Hedef Teslim:</span>
                        <span className="font-medium text-gray-700">{item.deadline_date}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Sticky/Fixed Header & Filters Wrapper */}
            <div className="shrink-0 space-y-6 pb-6 pt-2 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-20">
                {/* Header */}
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                            <Map className="text-blue-600" /> Sipariş Haritası (Simülasyon)
                        </h1>
                        <p className="text-gray-500 mt-1">Gelecek dönem malzeme ihtiyaç ve sipariş önerileri.</p>
                    </div>
                    <button
                        onClick={() => setResetPopupOpen(true)}
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-red-600 px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 group"
                        title="Simülasyonu Sıfırla"
                    >
                        <RotateCcw size={18} className="group-hover:-rotate-180 transition-transform duration-500" />
                        <span className="font-medium">Sıfırla</span>
                    </button>
                </div>

                {/* Standard Filters Bar */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            name="search"
                            placeholder="Ürün veya Tedarikçi Ara..."
                            value={filters.search}
                            onChange={handleFilterChange}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                        />
                    </div>

                    {/* Filters Group (Dates & Clear) */}
                    <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto items-center">
                        <div className="relative">
                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleFilterChange}
                                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-gray-600 w-full md:w-auto"
                                placeholder="Başlangıç"
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleFilterChange}
                                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-gray-600 w-full md:w-auto"
                                placeholder="Bitiş"
                            />
                        </div>

                        {/* Clear Button */}
                        <div>
                            <button
                                onClick={clearFilters}
                                className="px-6 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium border border-gray-200 w-full md:w-auto h-[38px] flex items-center justify-center"
                                title="Temizle"
                            >
                                Temizle
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20 flex-1">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredSuggestions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center flex-1">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Search size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Sonuç Bulunamadı</h3>
                    <p className="text-gray-500 max-w-md mt-2">Aradığınız kriterlere uygun sipariş önerisi mevcut değil.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden min-h-0 pb-4">
                    {/* Production Needs Column */}
                    <div className="flex flex-col h-full min-h-0 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                        <h2 className="shrink-0 text-xl font-bold text-gray-800 flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                            <Factory className="text-blue-500" /> Üretim İçin Gereksinimler
                            <span className="ml-auto bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">
                                {visibleProduction.length}/{productionSuggestions.length}
                            </span>
                        </h2>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {visibleProduction.length > 0 ? (
                                <>
                                    {visibleProduction.map((item, idx) => (
                                        <SuggestionCard key={`prod-${idx}`} item={item} type="production" />
                                    ))}
                                    {/* Infinite scroll loader */}
                                    {hasMoreProduction && (
                                        <div ref={productionLoaderRef} className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-gray-400 text-sm italic text-center py-8">Bu kriterde üretim gereksinimi yok.</p>
                            )}
                        </div>
                    </div>

                    {/* Safety Stock Column */}
                    <div className="flex flex-col h-full min-h-0 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                        <h2 className="shrink-0 text-xl font-bold text-gray-800 flex items-center gap-2 border-b border-gray-200 pb-3 mb-4">
                            <ShieldCheck className="text-orange-500" /> Emniyet Stok İhlalleri
                            <span className="ml-auto bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full">
                                {visibleSafety.length}/{safetyStockSuggestions.length}
                            </span>
                        </h2>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {visibleSafety.length > 0 ? (
                                <>
                                    {visibleSafety.map((item, idx) => (
                                        <SuggestionCard key={`ss-${idx}`} item={item} type="safety" />
                                    ))}
                                    {/* Infinite scroll loader */}
                                    {hasMoreSafety && (
                                        <div ref={safetyLoaderRef} className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-gray-400 text-sm italic text-center py-8">Bu kriterde emniyet stoğu ihlali yok.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Popup */}
            {deletePopupOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                Sipariş Önerisini Sil
                            </h3>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                Bu sipariş önerisini silmek üzeresiniz. Bu işlem kalıcıdır ve sadece mevcut simülasyon görünümünden kaldırılır. Onaylıyor musunuz?
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 flex gap-3 justify-end border-t border-gray-100">
                            <button
                                onClick={() => { setDeletePopupOpen(false); setItemToDelete(null); }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors font-medium text-sm"
                            >
                                İptal Et
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium text-sm shadow-sm flex items-center gap-2"
                            >
                                <X size={16} /> Tamam
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Popup */}
            <ConfirmModal
                isOpen={resetPopupOpen}
                onClose={() => setResetPopupOpen(false)}
                onConfirm={handleResetSimulation}
                title="Simülasyonu Sıfırla"
                message="Tüm simülasyon verilerini, sipariş haritasını ve hesaplamaları sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz."
                type="danger"
                cancelText="İptal Et"
                confirmText="Sıfırla"
            />


        </div>
    );
};

export default OrderMap;
