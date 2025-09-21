/**
 * Shell header for the in-app experience: brand + cart trigger, sin navegación adicional.
 */
import LogoLight from "../../assets/logo-pollos-tellos.svg";
import LogoDark from "../../assets/logo-pollos-tellos-dark.svg";
import { Link, useLocation } from "react-router-dom";
import { FaShoppingCart } from "react-icons/fa";
import { Moon, Sun } from "lucide-react";
import { useCart } from "hooks/useCart";
import { useTheme } from "hooks/useTheme";

type HeaderProps = {
  onOpenCart?: () => void;
};

export function Header({ onOpenCart }: HeaderProps) {
  const location = useLocation();
  const { count } = useCart();
  const { theme, toggle } = useTheme();
  const showCart = location.pathname !== "/";

  const cartTrigger = onOpenCart ? (
    <button
      type="button"
      className="btn-cart"
      onClick={onOpenCart}
      aria-label="Abrir carrito"
    >
      <FaShoppingCart /> {count > 0 && <span className="badge">{count}</span>}
    </button>
  ) : (
    <Link to="/checkout" className="btn-cart" aria-label="Ir al checkout">
      <FaShoppingCart /> {count > 0 && <span className="badge">{count}</span>}
    </Link>
  );

  const logoSrc = theme === "dark" ? LogoDark : LogoLight;

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand brand-with-logo" aria-label="Ir al inicio">
          <img
            src={logoSrc}
            alt="Logo Pollos Tello's"
            className="brand-logo"
          />
         
        </Link>
        <nav className="header-right">
          <button
            className="btn-icon"
            type="button"
            onClick={toggle}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {showCart && cartTrigger}
        </nav>
      </div>
    </header>
  );
}
