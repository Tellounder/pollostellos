/**
 * Drawer lateral: carrito persistente dentro del flujo de compra.
 */
import { useCart } from "hooks/useCart";
import { money } from "utils/format";

export const CartDrawer: React.FC<{open:boolean; onClose:()=>void; onGoCheckout:()=>void}> = ({open,onClose,onGoCheckout})=>{
  const {items,setQty,removeItem,totalLabel,clearCart} = useCart();
  return (
    <aside className={`cart-drawer ${open ? "open":""}`} role="dialog" aria-modal="true" aria-label="Carrito">
      <div className="inner">
        <div className="row" style={{justifyContent:"space-between"}}>
          <h3>Tu carrito</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Cerrar carrito">Cerrar</button>
        </div>
        <div style={{flex:1, overflow:"auto", marginTop:10}}>
          {items.length===0 ? <p className="small">Vacío por ahora.</p> : items.map(i=>(
            <div key={i.key} className="cart-line">
              <div style={{maxWidth:"60%"}}>
                <strong>{'name' in i ? i.name : i.label}</strong>
                {i.side && <div className="small">Guarnición: {i.side}</div>}
                <div className="small">{money(i.price)} c/u</div>
              </div>
              <div className="row">
                <div className="stepper" role="group" aria-label={`Cantidad ${'name' in i ? i.name : i.label}`}>
                  <button className="btn-ghost" aria-label="Quitar" onClick={()=> setQty(i.key, i.qty-1)}>-</button>
                  <div className="count" aria-live="polite">{i.qty}</div>
                  <button className="btn-ghost" aria-label="Agregar" onClick={()=> setQty(i.key, i.qty+1)}>+</button>
                </div>
                <button className="btn-ghost" onClick={()=> removeItem(i.key)} aria-label={`Eliminar ${'name' in i ? i.name : i.label}`}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{justifyContent:"space-between"}}>
          <strong>Total</strong><strong className="price">{totalLabel}</strong>
        </div>
        <div className="space"></div>
        <div className="row" style={{justifyContent:"space-between"}}>
          <button className="btn-ghost" onClick={clearCart}>Vaciar</button>
          <button className="btn-primary" onClick={onGoCheckout} disabled={items.length===0}>Ir a datos</button>
        </div>
      </div>
    </aside>
  );
};
