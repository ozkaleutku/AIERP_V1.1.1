import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const Layout = () => {
    return (
        <div className="flex bg-gray-50 text-gray-900 h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 ml-56 p-8 h-screen w-full flex flex-col min-w-0">
                <Outlet />
            </div>
        </div>
    );
};

export default Layout;
