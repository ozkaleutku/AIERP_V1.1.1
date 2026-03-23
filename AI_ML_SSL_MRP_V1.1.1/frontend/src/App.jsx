import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Shared
import Layout from "./shared/components/layout/Layout";
import Home from "./shared/pages/Home";

// Core Module
import Products from "./modules/core/pages/Products";
import Bom from "./modules/core/pages/Bom";

// Inventory Module
import Inventory from "./modules/inventory/pages/Inventory";
import StockMovement from "./modules/inventory/pages/StockMovement";

// Procurement Module
import Orders from "./modules/procurement/pages/Orders";
import Suppliers from "./modules/procurement/pages/Suppliers";

// Sales Module
import CustomerOrders from "./modules/sales/pages/CustomerOrders";
import SalesHistory from "./modules/sales/pages/SalesHistory";

// Forecasting Module
import DemandForecast from "./modules/forecasting/pages/DemandForecast";
import SafetyStock from "./modules/forecasting/pages/SafetyStock";
import SafetyStockComparison from "./modules/forecasting/pages/SafetyStockComparison";

// Simulation Module
import OrderMap from "./modules/simulation/pages/OrderMap";

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          {/* Procurement */}
          <Route path="orders" element={<Orders />} />
          {/* Sales */}
          <Route path="sales-history" element={<SalesHistory />} />
          <Route path="customer-orders" element={<CustomerOrders />} />
          {/* Inventory */}
          <Route path="inventory" element={<Inventory />} />
          <Route path="stock-movement" element={<StockMovement />} />
          {/* Forecasting */}
          <Route path="demand-forecast" element={<DemandForecast />} />
          <Route path="safety-stock" element={<SafetyStock />} />
          <Route path="safety-stock/compare" element={<SafetyStockComparison />} />
          {/* Core */}
          <Route path="products" element={<Products />} />
          <Route path="bom" element={<Bom />} />
          {/* Procurement */}
          <Route path="suppliers" element={<Suppliers />} />
          {/* Simulation */}
          <Route path="order-map" element={<OrderMap />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
