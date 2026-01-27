import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Save, Truck } from 'lucide-react';
import api from '../api';

const MissingSupplierPopup = ({ missingItems, onComplete, isOpen }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [formData, setFormData] = useState({
        supplier_id: '',
        given_leadtime: 7,
        lot_size: 0
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const currentItem = missingItems[currentIndex];

    // Reset form when moving to next item
    useEffect(() => {
        if (currentItem) {
            setFormData({
                supplier_id: '',
                given_leadtime: 7,
                lot_size: 0
            });
            setError('');
        }
    }, [currentIndex, currentItem]);

    if (!isOpen || !currentItem) return null;

    const remainingCount = missingItems.length - currentIndex;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!formData.supplier_id) {
            setError('Lütfen bir tedarikçi ID giriniz.');
            setLoading(false);
            return;
        }

        try {
            const payload = {
                item_id: currentItem.item_id,
                supplier_id: formData.supplier_id,
                given_leadtime: parseFloat(formData.given_leadtime),
                lot_size: parseFloat(formData.lot_size),
                status: 'Aktif',
                calculated: false
            };

            await api.post('/suppliers', payload);

            // Move to next or finish
            if (currentIndex < missingItems.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                onComplete(); // All done
            }
        } catch (err) {
            console.error("Error adding supplier:", err);
            setError('Kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-100 overflow-hidden">

                {/* Header - Kırmızı Alarm */}
                <div className="bg-red-50 p-6 border-b border-red-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-full animate-pulse">
                            <AlertCircle size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Eksik Tedarikçi Alarmı!</h2>
                            <p className="text-red-600 text-sm mt-1">
                                Kritik! Sistemin devam etmesi için aşağıdaki malzemelere tedarikçi atamanız gerekiyor.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-gray-100 h-2 w-full">
                    <div
                        className="bg-blue-600 h-full transition-all duration-500"
                        style={{ width: `${((currentIndex) / missingItems.length) * 100}%` }}
                    ></div>
                </div>

                {/* Form Content */}
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                        <span>Düzenlenen Ürün:</span>
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full">
                            Kalan: {remainingCount}
                        </span>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                            <Truck className="text-gray-400" />
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block">Malzeme Kodu (Item ID)</span>
                            <span className="text-lg font-bold text-gray-800 font-mono">{currentItem.item_id}</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tedarikçi Kodu (Supplier ID)</label>
                            <input
                                type="text"
                                name="supplier_id"
                                value={formData.supplier_id}
                                onChange={handleChange}
                                placeholder="Örn: SUP_001"
                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Termin (Gün)</label>
                                <input
                                    type="number"
                                    name="given_leadtime"
                                    value={formData.given_leadtime}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lot Size</label>
                                <input
                                    type="number"
                                    name="lot_size"
                                    value={formData.lot_size}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2">
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                            ) : (
                                <>
                                    <Save size={20} />
                                    Kaydet ve Devam Et
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MissingSupplierPopup;
