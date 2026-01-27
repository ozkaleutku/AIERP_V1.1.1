import { Home, ShoppingCart, ArrowRightLeft, TrendingUp, Package, Users, Layers, ShieldCheck, PackageCheck, History, Map } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const SIDEBAR_ITEMS = [
    { name: "Anasayfa", icon: Home, path: "/", description: "Genel bakış ve sistem özeti." },
    { name: "Satın Alım Siparişleri", icon: ShoppingCart, path: "/orders", description: "Satınalma siparişleri, teslimat takibi ve tedarikçi performansı." },
    { name: "Müşteri Siparişleri", icon: Users, path: "/customer-orders", description: "Müşteri sipariş kayıtları, durum takibi ve teslimat planlaması." },
    { name: "Satış Geçmişi", icon: History, path: "/sales-history", description: "Geçmiş satış verileri, analizler ve raporlama." },
    { name: "Envanter Durumu", icon: PackageCheck, path: "/inventory", description: "Güncel stok seviyeleri, kritik stok uyarıları ve takibi." },
    { name: "Depo Hareket", icon: ArrowRightLeft, path: "/stock-movement", description: "Stok giriş-çıkış işlemleri ve hareket tarihçesi." },
    { name: "Talep Tahmin", icon: TrendingUp, path: "/demand-forecast", description: "AI destekli gelecek dönem talep ve üretim tahminleri." },
    { name: "Ürünler", icon: Package, path: "/products", description: "Ürün tanımları, özellikleri ve katalog yönetimi." },
    { name: "Tedarikçiler", icon: Users, path: "/suppliers", description: "Tedarikçi listesi ve ilgili ürünlerin yönetimi." },
    { name: "BOM", icon: Layers, path: "/bom", description: "Ürün ağacı (Bill of Materials) ve reçete yönetimi." },
    { name: "Sipariş Haritası", icon: Map, path: "/order-map", description: "Siparişlerin coğrafi dağılımı ve harita görünümü." },
    { name: "Emniyet Stok", icon: ShieldCheck, path: "/safety-stock", description: "Emniyet stoku hesaplamaları ve optimizasyonu." },
];

const Sidebar = () => {
    const location = useLocation();

    return (
        <div className="h-screen w-64 bg-gray-900 text-white flex flex-col fixed left-0 top-0 border-r border-gray-800">
            <div className="p-6 border-b border-gray-800">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    MRP System
                </h1>
            </div>

            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-3">
                    {SIDEBAR_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                        ? "bg-blue-600 shadow-lg shadow-blue-500/20 text-white"
                                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                        }`}
                                >
                                    <item.icon
                                        size={20}
                                        className={`transition-colors ${isActive ? "text-white" : "text-gray-400 group-hover:text-white"
                                            }`}
                                    />
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50">
                    {/* Avatar removed as requested */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">OptiStock AI</p>
                        <p className="text-xs text-gray-400 truncate">utkuozkale@gmail.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
