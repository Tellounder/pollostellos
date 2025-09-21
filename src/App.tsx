/**
 * Root app shell: in-app navigation stack con header y carrito persistentes.
 */
import { useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Header } from "components/layout/Header";
import { CartDrawer } from "components/cart/CartDrawer";
import { Home } from "pages/Home";
import { Menu } from "pages/Menu";
import { Checkout } from "pages/Checkout";
import { Thanks } from "pages/Thanks";
import FooterInfo from "components/layout/FooterInfo";
import FooterSlogans from "components/layout/FooterSlogans";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCartOpen, setCartOpen] = useState(false);
  const pathname = location.pathname;
  const showAuthFooter = pathname === "/";
  const showMenuFooter = pathname === "/menu";
 
  return (
    <>
      <Header onOpenCart={() => setCartOpen(true)} />
      <main className="container" role="main" aria-live="polite">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/thanks" element={<Thanks />} />
        </Routes>
      </main>
      {showAuthFooter && <FooterInfo />}
      {showMenuFooter && <FooterSlogans />}
      <div
        className={`cart-backdrop ${isCartOpen ? "show" : ""}`}
        onClick={() => setCartOpen(false)}
      />
      <CartDrawer
        open={isCartOpen}
        onClose={() => setCartOpen(false)}
        onGoCheckout={() => {
          setCartOpen(false);
          navigate("/checkout");
        }}
      />
    </>
  );
}

export default App;
