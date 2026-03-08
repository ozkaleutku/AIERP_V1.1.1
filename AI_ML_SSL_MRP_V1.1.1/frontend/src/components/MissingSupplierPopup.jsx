import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Save, Truck, AlertTriangle, Factory, X } from 'lucide-react';
import api from '../api';

const MissingSupplierPopup = ({ missingItems, onComplete, isOpen }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [formData, setFormData] = useState({
        supplier_id: '',
        given_leadtime: '',
        lot_size: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [existingSuppliers, setExistingSuppliers] = useState([]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const response = await api.get('/suppliers');
                const data = response.data.data || response.data || [];
                const uniqueIds = [...new Set(data.map(s => s.supplier_id))];
                setExistingSuppliers(uniqueIds);
            } catch (err) {
                console.error("Error fetching suppliers:", err);
            }
        };
        fetchSuppliers();
    }, []);

    const currentItem = missingItems[currentIndex];

    // Reset form when moving to next item
    useEffect(() => {
        if (currentItem) {
            setFormData({
                supplier_id: '',
                given_leadtime: '',
                lot_size: ''
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
            setError('Lütfen bir tedarikçi Kodu giriniz.');
            setLoading(false);
            return;
        }

        if (parseFloat(formData.given_leadtime) < 0 || parseFloat(formData.lot_size) < 0) {
            setError("Lütfen geçerli değerler girin (Negatif sayı girilemez).");
            setLoading(false);
            return;
        }

        try {
            const payload = {
                item_id: currentItem.item_id,
                supplier_id: formData.supplier_id,
                given_leadtime: parseFloat(formData.given_leadtime) || 0,
                lot_size: parseFloat(formData.lot_size) || 0,
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

    const handleInternalProduction = async () => {
        setLoading(true);
        setError('');

        try {
            const payload = {
                item_id: currentItem.item_id,
                supplier_id: 'DAHİLİ',
                given_leadtime: 0,
                lot_size: 0,
                status: 'Aktif',
                calculated: false
            };

            await api.post('/suppliers', payload);

            if (currentIndex < missingItems.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                onComplete();
            }
        } catch (err) {
            console.error("Error adding internal supplier:", err);
            setError('Kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-100 overflow-hidden relative">

                {/* Header - Kırmızı Alarm */}
                <div className="bg-red-50 p-6 border-b border-red-100 relative">
                    <button
                        onClick={onComplete}
                        className="absolute right-4 top-4 p-2 text-red-400 hover:text-red-700 hover:bg-red-100 rounded-full transition-all"
                        title="Sonra Devam Et"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-full animate-pulse">
                            <AlertCircle size={32} />
                        </div>
                        <div className="pr-8">
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tedarikçi Kodu</label>
                            <input
                                type="text"
                                name="supplier_id"
                                value={formData.supplier_id}
                                onChange={handleChange}
                                list="missing-sup-id-options"
                                placeholder="Tedarikçi Seçiniz veya Yazınız (Örn: SUP_001)"
                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                autoFocus
                            />
                            <datalist id="missing-sup-id-options">
                                {existingSuppliers.map((supId) => (
                                    <option key={supId} value={supId} />
                                ))}
                            </datalist>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Leadtime (Gün)</label>
                                <input
                                    type="number"
                                    min="0"
                                    name="given_leadtime"
                                    value={formData.given_leadtime}
                                    placeholder="0"
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lot Size</label>
                                <input
                                    type="number"
                                    min="0"
                                    name="lot_size"
                                    value={formData.lot_size}
                                    placeholder="0"
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

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleInternalProduction}
                                disabled={loading}
                                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-200 disabled:opacity-50"
                            >
                                <Factory size={20} className="text-gray-500" />
                                Bizde Üretiliyor
                            </button>

                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        Tedarikçi Kaydet
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MissingSupplierPopup;
