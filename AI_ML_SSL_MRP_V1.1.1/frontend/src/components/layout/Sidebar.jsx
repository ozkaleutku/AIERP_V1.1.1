import { Home, ShoppingCart, ArrowRightLeft, TrendingUp, Package, Users, Layers, ShieldCheck, PackageCheck, History, Map, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

export const SIDEBAR_GROUPS = [
    {
        name: "Panel",
        items: [
            { name: "Anasayfa", icon: Home, path: "/", description: "Genel bakış ve sistem özeti." },
        ]
    },
    {
        name: "Ana Veri Yönetimi",
        items: [
            { name: "Ürün Yönetimi", icon: Package, path: "/products", description: "Ürün tanımları ve maliyet yönetimi." },
            { name: "Ürün Reçeteleri (BOM)", icon: Layers, path: "/bom", description: "Ürün ağacı ve reçete yönetimi." },
            { name: "Tedarikçi Yönetimi", icon: Users, path: "/suppliers", description: "Tedarikçi-Ürün ilişkileri." },
        ]
    },
    {
        name: "Satış ve Pazarlama (CRM)",
        items: [
            { name: "Müşteri Siparişleri", icon: Users, path: "/customer-orders", description: "Müşteri sipariş kayıtları ve takip." },
            { name: "Satış Geçmişi", icon: History, path: "/sales-history", description: "Geçmiş satış verileri ve analizler." },
        ]
    },
    {
        name: "Üretim ve Planlama (MRP)",
        items: [
            { name: "Talep Tahmin", icon: TrendingUp, path: "/demand-forecast", description: "AI destekli talep tahminleri." },
            { name: "Emniyet Stok", icon: ShieldCheck, path: "/safety-stock", description: "Emniyet stoku optimizasyonu." },
            { name: "Sipariş Haritası", icon: Map, path: "/order-map", description: "Siparişlerin simülasyon haritası." },
        ]
    },
    {
        name: "Stok ve Depo (SCM)",
        items: [
            { name: "Envanter Durumu", icon: PackageCheck, path: "/inventory", description: "Güncel stok seviyeleri." },
            { name: "Stok Hareketleri", icon: ArrowRightLeft, path: "/stock-movement", description: "Stok giriş-çıkış işlemleri." },
        ]
    },
    {
        name: "Satın Alma (Procurement)",
        items: [
            { name: "Satın Alma Siparişleri", icon: ShoppingCart, path: "/orders", description: "Tedarik takip süreci." },
        ]
    },
    {
        name: "Finans ve İK",
        items: [
            { name: "Yakında...", icon: Layers, path: "#", description: "Finans ve İK modülleri V2.1.1 ile eklenecektir.", disabled: true },
        ]
    }
];

export const SIDEBAR_ITEMS = SIDEBAR_GROUPS.flatMap(group => group.items);

const Sidebar = () => {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className={`h-screen bg-gray-900 text-white flex flex-col border-r border-gray-800 transition-all duration-300 relative shrink-0 z-50 ${isCollapsed ? 'w-20' : 'w-64'}`}>

            {/* Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-8 bg-gray-800 border border-gray-700 rounded-full p-1 hover:bg-gray-700 transition-colors z-50 text-gray-400 hover:text-white shadow-lg"
            >
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            <div className="p-6 border-b border-gray-800 shrink-0 h-[73px] flex items-center justify-center overflow-hidden">
                <h1 className={`font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'text-xl' : 'text-2xl'}`}>
                    {isCollapsed ? 'OS-AI' : 'OptiStock AI'}
                </h1>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 custom-scrollbar">
                {SIDEBAR_GROUPS.map((group, groupIdx) => (
                    <div key={groupIdx} className="mb-4">
                        {!isCollapsed && (
                            <h2 className="px-6 mb-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                {group.name}
                            </h2>
                        )}
                        <ul className="space-y-1 px-3">
                            {group.items.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <li key={item.path}>
                                        <Link
                                            to={item.disabled ? "#" : item.path}
                                            title={isCollapsed ? item.name : undefined}
                                            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-2 rounded-xl transition-all duration-200 group ${isActive
                                                ? "bg-blue-600 shadow-lg shadow-blue-500/20 text-white"
                                                : item.disabled ? "opacity-40 cursor-not-allowed" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                                }`}
                                            onClick={(e) => item.disabled && e.preventDefault()}
                                        >
                                            <item.icon
                                                size={20}
                                                className={`shrink-0 transition-colors ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"}`}
                                            />
                                            {!isCollapsed && (
                                                <span className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300">
                                                    {item.name}
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                        {!isCollapsed && groupIdx < SIDEBAR_GROUPS.length - 1 && (
                            <div className="mx-6 mt-4 border-t border-gray-800 opacity-50" />
                        )}
                    </div>
                ))}
            </nav>

            <div className={`p-4 border-t border-gray-800 flex flex-col items-center justify-center overflow-hidden shrink-0 transition-all duration-300 ${isCollapsed ? 'h-24 py-2' : ''}`}>
                {!isCollapsed ? (
                    <div id="sys-signature" className="text-center w-full">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Developed By</p>
                        <p className="text-xs font-semibold text-gray-400 font-mono tracking-wide truncate">utku altan özkale</p>
                    </div>
                ) : (
                    <div className="text-[10px] font-bold text-gray-500 rotate-[-90deg] whitespace-nowrap tracking-widest h-full flex items-center">
                        U.A.Ö.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
