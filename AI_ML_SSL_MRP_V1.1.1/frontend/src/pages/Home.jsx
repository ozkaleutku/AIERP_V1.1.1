import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SIDEBAR_ITEMS } from "../components/layout/Sidebar";

// Color palette to cycle through for the cards
const CARD_COLORS = [
    { bg: "bg-blue-600", text: "text-blue-600" },
    { bg: "bg-purple-600", text: "text-purple-600" },
    { bg: "bg-indigo-600", text: "text-indigo-600" },
    { bg: "bg-emerald-600", text: "text-emerald-600" },
    { bg: "bg-teal-600", text: "text-teal-600" },
    { bg: "bg-pink-600", text: "text-pink-600" },
    { bg: "bg-orange-600", text: "text-orange-600" },
    { bg: "bg-cyan-600", text: "text-cyan-600" },
    { bg: "bg-rose-600", text: "text-rose-600" },
    { bg: "bg-sky-600", text: "text-sky-600" },
    { bg: "bg-red-600", text: "text-red-600" },
    { bg: "bg-violet-600", text: "text-violet-600" },
];

const DashboardCard = ({ title, icon: Icon, to, description, colorIndex }) => {
    // Get color based on index (cycle through palette)
    const color = CARD_COLORS[colorIndex % CARD_COLORS.length];

    return (
        <Link
            to={to}
            className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between h-60"
        >
            <div className={`absolute top-0 right-0 p-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform group-hover:scale-110 ${color.bg}`} />

            <div className="relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color.bg}`}>
                    <Icon size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>

            <div className="relative z-10 flex items-center gap-2 text-sm font-semibold mt-4 group-hover:gap-3 transition-all">
                <span className={color.text}>Görüntüle</span>
                <ArrowRight size={16} className={color.text} />
            </div>
        </Link>
    );
};

const Home = () => {
    // Filter out "Anasayfa" (Home) itself from the dashboard grid
    const dashboardItems = SIDEBAR_ITEMS.filter(item => item.path !== "/");

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
                    Hoş Geldiniz 👋
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    AI Destekli Malzeme İhtiyaç Planlama Sistemi
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {dashboardItems.map((item, index) => (
                    <DashboardCard
                        key={item.path}
                        title={item.name}
                        description={item.description}
                        icon={item.icon}
                        to={item.path}
                        colorIndex={index}
                    />
                ))}
            </div>
        </div>
    );
};

export default Home;
