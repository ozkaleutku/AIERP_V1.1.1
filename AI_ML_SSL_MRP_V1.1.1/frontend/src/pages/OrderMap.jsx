import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, AlertTriangle, Package, Calendar, Search, Filter, CheckCircle2, Factory, ShieldCheck, X } from 'lucide-react';
import api from '../api';
import MissingSupplierPopup from '../components/MissingSupplierPopup';

const BATCH_SIZE = 20; // Number of items to load per batch

const OrderMap = () => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [missingItems, setMissingItems] = useState([]); // For the popup

    // Infinite scroll state
    const [visibleProductionCount, setVisibleProductionCount] = useState(BATCH_SIZE);
    const [visibleSafetyCount, setVisibleSafetyCount] = useState(BATCH_SIZE);
    const productionLoaderRef = useRef(null);
    const safetyLoaderRef = useRef(null);

    // Advanced Filters State
    const [filters, setFilters] = useState({
        search: '', // Matches Item ID or Supplier ID
        startDate: '',
        endDate: '',
        purpose: 'all' // 'all', 'production', 'safety'
    });

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const response = await api.get('/simulation/suggestions');
            setSuggestions(response.data);

            // Check for missing suppliers immediately
            const missing = response.data.filter(item =>
                item.status && item.status.includes('HATA: Tedarikçi Yok')
            );

            // Remove duplicates based on item_id (we only need to define supplier once per item)
            const uniqueMissing = [];
            const seen = new Set();
            for (const m of missing) {
                if (!seen.has(m.item_id)) {
                    seen.add(m.item_id);
                    uniqueMissing.push(m);
                }
            }

            if (uniqueMissing.length > 0) {
                setMissingItems(uniqueMissing);
            }

        } catch (error) {
            console.error("Error fetching simulation data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMissingItemsComplete = () => {
        setMissingItems([]); // Close popup
        fetchSuggestions(); // Refresh data to see new order dates
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
            endDate: '',
            purpose: 'all'
        });
    };

    // Filter Logic
    const filteredSuggestions = suggestions.filter(item => {
        // 1. Search (Item or Supplier)
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = filters.search === '' ||
            item.item_id.toLowerCase().includes(searchLower) ||
            (item.supplier_id && item.supplier_id.toLowerCase().includes(searchLower));

        // 2. Purpose
        const matchesPurpose = filters.purpose === 'all' ||
            (filters.purpose === 'production' && item.purpose === 'Üretim İçin') ||
            (filters.purpose === 'safety' && item.purpose === 'Emniyet Stok');

        // 3. Date Range (Order Date)
        let matchesDate = true;
        if (filters.startDate) {
            matchesDate = matchesDate && new Date(item.order_date) >= new Date(filters.startDate);
        }
        if (filters.endDate) {
            matchesDate = matchesDate && new Date(item.order_date) <= new Date(filters.endDate);
        }

        return matchesSearch && matchesPurpose && matchesDate;
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
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                    <Map className="text-blue-600" /> Sipariş Haritası (Simülasyon)
                </h1>
                <p className="text-gray-500 mt-1">Gelecek dönem malzeme ihtiyaç ve sipariş önerileri.</p>
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

                {/* Purpose Filter */}
                <div className="relative w-full md:w-48">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select
                        name="purpose"
                        value={filters.purpose}
                        onChange={handleFilterChange}
                        className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer font-medium"
                    >
                        <option value="all">Tüm Öneriler</option>
                        <option value="production">Üretim Gereksinimleri</option>
                        <option value="safety">Emniyet Stok İhlalleri</option>
                    </select>
                </div>

                {/* Date Range Group */}
                <div className="flex gap-2 w-full md:w-auto">
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
                </div>

                {/* Clear Button */}
                {(filters.search || filters.purpose !== 'all' || filters.startDate || filters.endDate) && (
                    <button
                        onClick={clearFilters}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Filtreleri Temizle"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredSuggestions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Search size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Sonuç Bulunamadı</h3>
                    <p className="text-gray-500 max-w-md mt-2">Aradığınız kriterlere uygun sipariş önerisi mevcut değil.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Production Needs Column */}
                    {filters.purpose !== 'safety' && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b border-gray-200 pb-2">
                                <Factory className="text-blue-500" /> Üretim İçin Gereksinimler
                                <span className="ml-auto bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">
                                    {visibleProduction.length}/{productionSuggestions.length}
                                </span>
                            </h2>
                            {visibleProduction.length > 0 ? (
                                <div className="grid gap-4">
                                    {visibleProduction.map((item, idx) => (
                                        <SuggestionCard key={`prod-${idx}`} item={item} type="production" />
                                    ))}
                                    {/* Infinite scroll loader */}
                                    {hasMoreProduction && (
                                        <div ref={productionLoaderRef} className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm italic">Bu kriterde üretim gereksinimi yok.</p>
                            )}
                        </div>
                    )}

                    {/* Safety Stock Column */}
                    {filters.purpose !== 'production' && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b border-gray-200 pb-2">
                                <ShieldCheck className="text-orange-500" /> Emniyet Stok İhlalleri
                                <span className="ml-auto bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full">
                                    {visibleSafety.length}/{safetyStockSuggestions.length}
                                </span>
                            </h2>
                            {visibleSafety.length > 0 ? (
                                <div className="grid gap-4">
                                    {visibleSafety.map((item, idx) => (
                                        <SuggestionCard key={`ss-${idx}`} item={item} type="safety" />
                                    ))}
                                    {/* Infinite scroll loader */}
                                    {hasMoreSafety && (
                                        <div ref={safetyLoaderRef} className="flex justify-center py-4">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm italic">Bu kriterde emniyet stoğu ihlali yok.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Missing Supplier Force Popup */}
            {missingItems.length > 0 && (
                <MissingSupplierPopup
                    missingItems={missingItems}
                    isOpen={true}
                    onComplete={handleMissingItemsComplete}
                />
            )}
        </div>
    );
};

export default OrderMap;
