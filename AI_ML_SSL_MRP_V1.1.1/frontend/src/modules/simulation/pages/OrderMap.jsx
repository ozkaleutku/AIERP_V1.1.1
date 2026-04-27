import React, { useState, useEffect, useMemo } from 'react';
import { Map, Search, ChevronLeft, ChevronRight, Factory, X, RotateCcw, Package, Calendar as CalendarIcon } from 'lucide-react';
import api from '../../../api';
import toast from 'react-hot-toast';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { matchTurkish } from '../../../shared/utils/stringUtils';

// ─── Turkish locale constants ─────────────────────────────────
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// ─── Helper: format a date string ─────────────────────────────
const formatDateTR = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${MONTHS_TR[m - 1]} ${y}`;
};

// ─── Component ────────────────────────────────────────────────
const OrderMap = () => {
    // ── State ──
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [resetPopupOpen, setResetPopupOpen] = useState(false);
    const [deletePopupOpen, setDeletePopupOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    // ── Fetch suggestions from backend ──
    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const response = await api.get('/simulation/suggestions');
            setSuggestions(response.data || []);
        } catch (error) {
            console.error("Error fetching simulation data:", error);
            toast.error("Simülasyon verileri yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSuggestions(); }, []);

    // ── Reset simulation ──
    const handleResetSimulation = async () => {
        const toastId = toast.loading("Simülasyon sıfırlanıyor...");
        try {
            await api.post('/simulation/reset');
            toast.success("Simülasyon başarıyla sıfırlandı.", { id: toastId });
            setResetPopupOpen(false);
            fetchSuggestions();
        } catch (error) {
            console.error("Error resetting simulation:", error);
            toast.error(error.response?.data?.detail || "Sıfırlama sırasında hata oluştu.", { id: toastId });
            setResetPopupOpen(false);
        }
    };

    // ── Delete handler ──
    const handleDeleteClick = (item) => {
        setItemToDelete(item);
        setDeletePopupOpen(true);
    };

    const confirmDelete = () => {
        if (itemToDelete) {
            setSuggestions(prev => prev.filter(i =>
                !(i.item_id === itemToDelete.item_id &&
                    i.order_date === itemToDelete.order_date &&
                    i.amount === itemToDelete.amount)
            ));
        }
        setDeletePopupOpen(false);
        setItemToDelete(null);
    };

    // ── Calendar calculations ──
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const prevMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
        setSelectedDate(null);
    };
    const nextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
        setSelectedDate(null);
    };
    const goToToday = () => {
        setCurrentMonth(new Date());
        setSelectedDate(todayStr);
    };

    // ── Group suggestions by order_date ──
    const suggestionsByDate = useMemo(() => {
        const map = {};
        suggestions.forEach(item => {
            const dateKey = item.order_date;
            if (!dateKey) return;
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(item);
        });
        return map;
    }, [suggestions]);

    // ── Search → highlighted dates ──
    const highlightedDates = useMemo(() => {
        if (!searchQuery.trim()) return null; // null = no search active
        const dates = new Set();
        suggestions.forEach(item => {
            if (matchTurkish(item.item_id, searchQuery) ||
                matchTurkish(item.supplier_id, searchQuery)) {
                dates.add(item.order_date);
            }
        });
        return dates;
    }, [suggestions, searchQuery]);

    // ── Calendar grid days ──
    const calendarDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push({ day: null, dateStr: null });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            days.push({ day: d, dateStr });
        }
        return days;
    }, [year, month, daysInMonth, firstDayOfWeek]);

    // ── Count suggestions for current month ──
    const currentMonthSuggestionCount = useMemo(() => {
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return suggestions.filter(s => s.order_date && s.order_date.startsWith(prefix)).length;
    }, [suggestions, year, month]);

    // ── Items for selected date ──
    const selectedItems = selectedDate ? (suggestionsByDate[selectedDate] || []) : [];

    // ── Is search active? ──
    const isSearchActive = highlightedDates !== null;

    // ═══════════════════════════════════════════════════════════
    //  SUB-COMPONENT: Suggestion Card (for side panel)
    // ═══════════════════════════════════════════════════════════
    const SuggestionCard = ({ item }) => {
        return (
            <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Factory size={18} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-sm">{item.item_id}</h4>
                            <p className="text-[11px] text-gray-400">{item.item_type || 'Malzeme'}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleDeleteClick(item)}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Sipariş Önerisini Sil"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="bg-gray-50 p-2 rounded-lg">
                        <span className="text-gray-400 block text-[10px] uppercase tracking-wide">Miktar</span>
                        <span className="font-semibold text-gray-800 text-sm">{item.amount} {item.item_quantity_type || 'birim'}</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg">
                        <span className="text-gray-400 block text-[10px] uppercase tracking-wide">Tedarikçi</span>
                        <span className={`font-semibold text-sm truncate block ${item.supplier_id === 'Bilinmiyor' ? 'text-red-400 italic' : 'text-gray-800'}`}>
                            {item.supplier_id}
                        </span>
                    </div>
                </div>

                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 flex items-center gap-1"><Package size={11} /> Sipariş Ver:</span>
                        <span className="font-medium text-blue-600">{formatDateTR(item.order_date)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 flex items-center gap-1"><CalendarIcon size={11} /> Lead Time:</span>
                        <span className="font-medium text-gray-600">{item.leadtime} gün</span>
                    </div>
                </div>
            </div>
        );
    };

    // ═══════════════════════════════════════════════════════════
    //  MAIN RENDER
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* ── Header ── */}
            <div className="shrink-0 pb-5 pt-2 sticky top-0 bg-gray-50/95 backdrop-blur-sm z-20">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                            <Map className="text-blue-600" /> Sipariş Takvimi
                        </h1>
                        <p className="text-gray-500 mt-1">Gelecek dönem malzeme sipariş planı</p>
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

                {/* ── Search Bar ── */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Ürün veya Tedarikçi Ara... (takvimde eşleşen günler parlar)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main Content ── */}
            {loading ? (
                <div className="flex justify-center items-center py-20 flex-1">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 flex-1 overflow-hidden min-h-0 pb-4">

                    {/* ═══════════ LEFT: CALENDAR ═══════════ */}
                    <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-0">

                        {/* Month Navigation */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                            <button
                                onClick={prevMonth}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                            >
                                <ChevronLeft size={20} />
                            </button>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={goToToday}
                                    className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                >
                                    Bugün
                                </button>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {MONTHS_TR[month]} {year}
                                </h2>
                                {currentMonthSuggestionCount > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-600 rounded-full">
                                        {currentMonthSuggestionCount} sipariş
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={nextMonth}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Day Headers */}
                        <div className="grid grid-cols-7 shrink-0 border-b border-gray-50">
                            {DAYS_TR.map(day => (
                                <div key={day} className="py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-px bg-gray-100/50 flex-1 overflow-y-auto p-px">
                            {calendarDays.map((cell, idx) => {
                                if (!cell.day) {
                                    // Empty cell
                                    return <div key={`empty-${idx}`} className="bg-gray-50/30 min-h-[85px]" />;
                                }

                                const dateStr = cell.dateStr;
                                const items = suggestionsByDate[dateStr] || [];
                                const hasItems = items.length > 0;
                                const isToday = dateStr === todayStr;
                                const isSelected = dateStr === selectedDate;
                                const isPast = dateStr < todayStr;
                                const isHighlighted = isSearchActive && highlightedDates.has(dateStr);
                                const isDimmed = isSearchActive && !isHighlighted && hasItems;
                                const isWeekend = (idx % 7) >= 5;

                                return (
                                    <div
                                        key={dateStr}
                                        onClick={() => {
                                            if (!isPast || hasItems) {
                                                setSelectedDate(isSelected ? null : dateStr);
                                            }
                                        }}
                                        className={`
                                            min-h-[85px] p-2 cursor-pointer transition-all duration-200 relative
                                            ${isSelected
                                                ? 'bg-blue-50 ring-2 ring-inset ring-blue-500 z-10'
                                                : isHighlighted
                                                    ? 'bg-amber-50 calendar-cell-highlight z-10'
                                                    : hasItems
                                                        ? 'bg-white hover:bg-blue-50/50'
                                                        : isWeekend
                                                            ? 'bg-gray-50/60'
                                                            : 'bg-white'
                                            }
                                            ${isPast && !hasItems ? 'opacity-40' : ''}
                                            ${isDimmed ? 'opacity-20' : ''}
                                        `}
                                    >
                                        {/* Day Number */}
                                        <div className={`
                                            text-sm font-medium leading-none
                                            ${isToday
                                                ? 'w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center'
                                                : isSelected
                                                    ? 'text-blue-700 font-bold'
                                                    : isPast
                                                        ? 'text-gray-300'
                                                        : isWeekend
                                                            ? 'text-gray-400'
                                                            : 'text-gray-700'
                                            }
                                        `}>
                                            {cell.day}
                                        </div>

                                        {/* Order Dots / Badges */}
                                        {hasItems && (
                                            <div className="mt-1.5 space-y-0.5">
                                                {items.slice(0, 3).map((item, i) => (
                                                    <div key={i} className="flex items-center gap-1 group/dot">
                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                            isHighlighted 
                                                                ? 'bg-amber-500' 
                                                                : 'bg-blue-500'
                                                        }`} />
                                                        <span className={`text-[10px] leading-tight truncate ${
                                                            isHighlighted 
                                                                ? 'text-amber-700 font-medium' 
                                                                : 'text-gray-500'
                                                        }`}>
                                                            {item.item_id}
                                                        </span>
                                                    </div>
                                                ))}
                                                {items.length > 3 && (
                                                    <span className="text-[10px] text-gray-400 font-medium pl-2.5">
                                                        +{items.length - 3} daha
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ═══════════ RIGHT: DETAIL PANEL ═══════════ */}
                    <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 min-h-0 overflow-hidden">
                        {selectedDate ? (
                            <>
                                {/* Panel Header */}
                                <div className="shrink-0 p-5 border-b border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800">
                                                📦 {formatDateTR(selectedDate)}
                                            </h3>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {selectedItems.length > 0
                                                    ? `${selectedItems.length} sipariş önerisi`
                                                    : 'Bu tarihte sipariş yok'
                                                }
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedDate(null)}
                                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Panel Content */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    {selectedItems.length > 0 ? (
                                        selectedItems.map((item, idx) => (
                                            <SuggestionCard key={`card-${idx}`} item={item} />
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-center py-12">
                                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                                <CalendarIcon size={24} className="text-gray-300" />
                                            </div>
                                            <p className="text-sm text-gray-400">Bu tarihte sipariş önerisi yok.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* Empty State - No date selected */
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                                    <CalendarIcon size={28} className="text-blue-400" />
                                </div>
                                <h3 className="text-base font-bold text-gray-700 mb-1">Gün Seçin</h3>
                                <p className="text-sm text-gray-400 max-w-[200px]">
                                    Takvimden bir güne tıklayarak o güne ait sipariş önerilerini görüntüleyin.
                                </p>

                                {suggestions.length > 0 && (
                                    <div className="mt-6 bg-gray-50 rounded-xl p-4 w-full">
                                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Özet</div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold text-blue-600">{suggestions.length}</span>
                                            <span className="text-sm text-gray-500">sipariş önerisi</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            {Object.keys(suggestionsByDate).length} farklı gün
                                        </div>
                                    </div>
                                )}

                                {isSearchActive && (
                                    <div className="mt-4 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                        🔍 <strong>{highlightedDates.size}</strong> gün eşleşiyor: "{searchQuery}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation ── */}
            {deletePopupOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                <X size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Sipariş Önerisini Sil</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                Bu sipariş önerisini listeden kaldırmak istediğinize emin misiniz?
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

            {/* ── Reset Confirmation ── */}
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
