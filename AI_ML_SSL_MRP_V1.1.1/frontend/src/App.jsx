import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/layout/Layout";
import Home from "./pages/Home";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import StockMovement from "./pages/StockMovement";
import Bom from "./pages/Bom";
import Orders from "./pages/Orders";
import DemandForecast from "./pages/DemandForecast";
import Inventory from "./pages/Inventory";
import SalesHistory from "./pages/SalesHistory";
import SafetyStock from "./pages/SafetyStock";
import SafetyStockComparison from "./pages/SafetyStockComparison";
import CustomerOrders from "./pages/CustomerOrders";
import OrderMap from "./pages/OrderMap";

// Placeholder components for other pages
const PlaceholderPage = ({ title }) => (
  <div className="p-4">
    <h1 className="text-2xl font-bold mb-4">{title}</h1>
    <p>Bu sayfa yapım aşamasındadır.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="orders" element={<Orders />} />
          <Route path="sales-history" element={<SalesHistory />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="stock-movement" element={<StockMovement />} />
          <Route path="demand-forecast" element={<DemandForecast />} />
          <Route path="products" element={<Products />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="bom" element={<Bom />} />
          <Route path="safety-stock" element={<SafetyStock />} />
          <Route path="safety-stock/compare" element={<SafetyStockComparison />} />
          <Route path="customer-orders" element={<CustomerOrders />} />
          <Route path="order-map" element={<OrderMap />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
