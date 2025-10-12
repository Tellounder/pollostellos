/**
 * Root app shell: in-app navigation stack con header y carrito persistentes.
 */
import { useState } from "react";
import { Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Header } from "components/layout/Header";
import { CartDrawer } from "components/cart/CartDrawer";
import { Home } from "pages/Home";
import { Menu } from "pages/Menu";
import { Checkout } from "pages/Checkout";
import { Thanks } from "pages/Thanks";
import { Terms } from "pages/Terms";
import FooterInfo from "components/layout/FooterInfo";
import FooterSlogans from "components/layout/FooterSlogans";
import { PwaInstallBanner } from "components/pwa/PwaInstallBanner";
import { AdminLayout } from "./layouts/AdminLayout";
import { AdminPanel } from "./pages/admin/AdminPanel";
import { AdminOrders } from "./pages/admin/AdminOrders";
import { AdminCustomers } from "./pages/admin/AdminCustomers";
import { AdminDiscounts } from "./pages/admin/AdminDiscounts";
import { AdminOperations } from "./pages/admin/AdminOperations";

function App() {
  const navigate = useNavigate();
  const [isCartOpen, setCartOpen] = useState(false);

  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminPanel />} />
        <Route path="panel" element={<AdminPanel />} />
        <Route path="pedidos" element={<AdminOrders />} />
        <Route path="clientes" element={<AdminCustomers />} />
        <Route path="descuentos" element={<AdminDiscounts />} />
        <Route path="operaciones" element={<AdminOperations />} />
      </Route>
      <Route
        element={
          <PublicLayout
            isCartOpen={isCartOpen}
            onOpenCart={() => setCartOpen(true)}
            onCloseCart={() => setCartOpen(false)}
            onGoCheckout={() => {
              setCartOpen(false);
              navigate("/checkout");
            }}
          />
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/legales/terminos" element={<Terms />} />
        <Route path="/thanks" element={<Thanks />} />
      </Route>
    </Routes>
  );
}

export default App;

type PublicLayoutProps = {
  isCartOpen: boolean;
  onOpenCart: () => void;
  onCloseCart: () => void;
  onGoCheckout: () => void;
};

function PublicLayout({ isCartOpen, onOpenCart, onCloseCart, onGoCheckout }: PublicLayoutProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const showAuthFooter = pathname === "/";
  const showMenuFooter = pathname === "/menu";

  return (
    <>
      <Header onOpenCart={onOpenCart} />
      <main className="container" role="main" aria-live="polite">
        <Outlet />
      </main>
      {showAuthFooter && <FooterInfo />}
      {showMenuFooter && <FooterSlogans />}
      <PwaInstallBanner />
      <div className={`cart-backdrop ${isCartOpen ? "show" : ""}`} onClick={onCloseCart} />
      <CartDrawer open={isCartOpen} onClose={onCloseCart} onGoCheckout={onGoCheckout} />
    </>
  );
}
