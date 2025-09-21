#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${ROOT}/.ui_refresh_backups_${TS}"
RESTORE_SCRIPT="${ROOT}/restore-ui-refresh.sh"

mkdir -p "${BACKUP_DIR}"

log() { printf "\033[1;36m[UI-REFRESH]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[ERR]\033[0m %s\n" "$*"; }

backup() {
  local f="$1"
  if [[ -f "$f" ]]; then
    local rel="${f#$ROOT/}"
    local dest="${BACKUP_DIR}/${rel}"
    mkdir -p "$(dirname "$dest")"
    cp "$f" "$dest"
    echo "cp \"$dest\" \"$f\"" >> "$RESTORE_SCRIPT"
  fi
}

ensure_root() {
  if [[ ! -f "${ROOT}/package.json" ]]; then
    err "No encuentro package.json en ${ROOT}. Corré el script desde la RAÍZ del proyecto."
    exit 1
  fi
}

init_restore_script() {
  cat > "$RESTORE_SCRIPT" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
echo "Restaurando backups desde ${BACKUP_DIR} ..."
EOF
  chmod +x "$RESTORE_SCRIPT"
}

write_file() {
  local path="$1"; shift
  backup "$path"
  mkdir -p "$(dirname "$path")"
  # Escribe exactamente lo que se pasa (sin expandir variables)
  printf '%s\n' "$*" > "$path"
}


remove_file_safe() {
  local path="$1"
  if [[ -f "$path" ]]; then
    backup "$path"
    rm -f "$path"
    echo "cp \"${BACKUP_DIR}/${path#$ROOT/}\" \"$path\"" >> "$RESTORE_SCRIPT"
  fi
}

ensure_root
init_restore_script

# 1. Update index.html (meta, fonts)
log "Actualizando index.html"
write_file "${ROOT}/index.html" '
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f6f7fa" />
    <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;600;700&display=swap" rel="stylesheet">
    <title>POLLOS TELLO&apos;S</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
'

# 2. Hook useTheme.ts
log "Creando hook useTheme"
write_file "${ROOT}/src/hooks/useTheme.ts" '
import { useEffect, useState } from "react";
export function useTheme(){
  const [theme,setTheme] = useState<"light"|"dark">(()=>{
    try{ const v = localStorage.getItem("pt_theme"); return (v==="dark"||v==="light")? v : "light"; }catch{ return "light"; }
  });
  useEffect(()=>{
    try{ localStorage.setItem("pt_theme", theme) }catch{}
    const root = document.documentElement;
    if(theme==="dark") root.classList.add("dark");
    else root.classList.remove("dark");
  },[theme]);
  const toggle = ()=> setTheme(t=> t==="light" ? "dark" : "light");
  return { theme, toggle };
}
'

# 3. Header renovado
log "Actualizando Header"
write_file "${ROOT}/src/components/Header.tsx" '
import React from "react";
import { useCart } from "../hooks/useCart";
import { useTheme } from "../hooks/useTheme";
export const Header: React.FC<{onHome:()=>void; onOpenCart:()=>void}> = ({onHome,onOpenCart})=>{
  const { count } = useCart();
  const { theme, toggle } = useTheme();
  return (
    <header className="header" role="banner">
      <div className="header-inner">
        <button className="btn-ghost brand" aria-label="Ir al inicio" onClick={onHome}>
          POLLOS TELLO&apos;S
        </button>
        <div className="header-right">
          <span className="greet">Hola, Invitado</span>
          <button
            className="btn-ghost"
            aria-label="Cambiar tema"
            onClick={toggle}
            title={theme==="light" ? "Cambiar a oscuro" : "Cambiar a claro"}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button className="btn-cart" aria-label="Abrir carrito" onClick={onOpenCart}>
            Carrito
            {count > 0 && <span className="badge" aria-label={`Artículos: ${count}`}>{count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
};
'

# 4. Tarjeta ComboCard con chips y CTAs gemelas
log "Actualizando ComboCard (chips + CTAs)"
write_file "${ROOT}/src/components/ComboCard.tsx" '
import React, { memo, useState } from "react";
import type { Combo } from "../constants";
import { SIDES } from "../constants";
import { useCart } from "../hooks/useCart";
export const ComboCard = memo(({combo, onBuy}:{combo:Combo; onBuy:()=>void})=>{
  const { addOrInc } = useCart();
  const [qty,setQty] = useState(1);
  const [side,setSide] = useState(SIDES[0]);
  const addToCart = ()=>{
    const key = `combo:${combo.id}:${combo.hasSide? side : ""}`;
    addOrInc(key, ()=>({
      key,
      kind:"combo",
      name:`${combo.name}${combo.hasSide?` (${side})`:""}`,
      price:combo.price,
      qty,
      side: combo.hasSide? side: undefined
    }));
  };
  return (
    <div className="card" style={{display:"flex",flexDirection:"column",gap:10}}>
      <div>
        <h3>{combo.name}</h3>
        <p className="small">{combo.description}</p>
      </div>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div className="price">
          {new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(combo.price)}
        </div>
        <div className="stepper" role="group" aria-label={`Cantidad ${combo.name}`}>
          <button className="btn-ghost" aria-label="Quitar" onClick={()=> setQty(q=>Math.max(1,q-1))}>-</button>
          <div className="count" aria-live="polite">{qty}</div>
          <button className="btn-ghost" aria-label="Agregar" onClick={()=> setQty(q=>q+1)}>+</button>
        </div>
      </div>
      {combo.hasSide && (
        <div className="chip-group" role="radiogroup" aria-label="Elegí tu guarnición">
          {SIDES.map(s=>(
            <button
              key={s}
              className={`chip ${side===s? "active":""}`}
              role="radio"
              aria-checked={side===s}
              onClick={()=> setSide(s)}
            >{s}</button>
          ))}
        </div>
      )}
      <div className="actions-2">
        <button className="btn-ghost" aria-label={`Agregar ${combo.name} al carrito`} onClick={addToCart}>
          Agregar al carrito
        </button>
        <button className="btn-primary" aria-label={`Comprar ${combo.name} ahora`} onClick={()=>{ addToCart(); onBuy(); }}>
          Comprar ahora
        </button>
      </div>
    </div>
  );
});
'

# 5. CartDrawer renovado (ancho tope + backdrop)
log "Actualizando CartDrawer"
write_file "${ROOT}/src/components/CartDrawer.tsx" '
import React from "react";
import { useCart } from "../hooks/useCart";
import { money } from "../utils/format";
export const CartDrawer: React.FC<{open:boolean; onClose:()=>void; onGoCheckout:()=>void}> = ({open,onClose,onGoCheckout})=>{
  const {items,setQty,remove,totalLabel,clear} = useCart();
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
                <strong>{i.name}</strong>
                <div className="small">{money(i.price)} c/u</div>
              </div>
              <div className="row">
                <div className="stepper" role="group" aria-label={`Cantidad ${i.name}`}>
                  <button className="btn-ghost" aria-label="Quitar" onClick={()=> setQty(i.key, i.qty-1)}>-</button>
                  <div className="count" aria-live="polite">{i.qty}</div>
                  <button className="btn-ghost" aria-label="Agregar" onClick={()=> setQty(i.key, i.qty+1)}>+</button>
                </div>
                <button className="btn-ghost" onClick={()=> remove(i.key)} aria-label={`Eliminar ${i.name}`}>
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
          <button className="btn-ghost" onClick={clear}>Vaciar</button>
          <button className="btn-primary" onClick={onGoCheckout} disabled={items.length===0}>Ir a datos</button>
        </div>
      </div>
    </aside>
  );
};
'

# 6. Nuevo UpsellModal con botones aceptar/cancelar
log "Actualizando UpsellModal"
write_file "${ROOT}/src/components/UpsellModal.tsx" '
import React from "react";
import { useUpsell } from "../hooks/useUpsell";
export const UpsellModal: React.FC = ()=>{
  const { open, countdown, acceptAndClose, cancelAndClose } = useUpsell() as any;
  if(!open) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Promo deshuesado">
      <div className="box">
        <div className="spinner" aria-hidden>🍗</div>
        <h3>¿Lo querés deshuesado?</h3>
        <p className="lead">(Promo al mismo precio)</p>
        <div className="cta-row">
          <button className="btn-ghost" aria-label="Cancelar" onClick={cancelAndClose}>Cancelar</button>
          <button className="btn-primary" aria-label="Aceptar" onClick={acceptAndClose}>✔ Aceptar</button>
        </div>
        <div className="countdown">Se cierra en {countdown}s…</div>
      </div>
    </div>
  );
};
'

# 7. Hook useUpsell con acept/cancel + bloqueo inputs
log "Actualizando useUpsell"
write_file "${ROOT}/src/hooks/useUpsell.ts" '
import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
export function useUpsell(){
  const [accepted,setAccepted] = useLocalStorage<boolean>("pt_upsell", false);
  const [open,setOpen] = useLocalStorage<boolean>("pt_upsell_open", false);
  const [countdown,setCountdown] = useLocalStorage<number>("pt_upsell_cd", 5);
  const [locked,setLocked] = useLocalStorage<boolean>("pt_form_locked", false);
  const show = ()=>{
    setAccepted(false); setCountdown(5); setOpen(true); setLocked(true);
    document.body.classList.add("modal-open");
  };
  const close = ()=> {
    setOpen(false); setLocked(false);
    document.body.classList.remove("modal-open");
  };
  const acceptAndClose = ()=> { setAccepted(true); close(); };
  const cancelAndClose = ()=> { setAccepted(false); close(); };
  useEffect(()=>{
    if(!open){ document.body.classList.remove("modal-open"); return; }
    setCountdown(5);
    const tick = setInterval(()=> setCountdown(c=>c-1), 1000);
    const timer = setTimeout(()=> close(), 5000);
    return ()=> { clearInterval(tick); clearTimeout(timer); };
  },[open]);
  return {accepted,setAccepted, open, show, countdown, locked, acceptAndClose, cancelAndClose};
}
'

# 8. Nuevo styles.css con modo claro/oscuro y chips/combos/ drawer
log "Actualizando styles.css"
write_file "${ROOT}/src/styles.css" '
:root{
  --fs-base: 17px;
  --bg:#f6f7fa; --card:#ffffff; --surface:#ffffff;
  --text:#1b2330; --muted:#5a6472;
  --primary:#ff8a5b; --accent:#cc9200; --ok:#2f9e67; --warn:#b7791f;
  --border:#e3e6eb;
  --radius-xl:18px; --radius-md:12px;
  --shadow:0 10px 26px rgba(0,0,0,.08);
  --font:"Ubuntu", ui-sans-serif, system-ui, -apple-system, "Inter", Segoe UI, Roboto, Arial;
  --fs-xxs:12px; --fs-xs:13px; --fs-sm:14px; --fs-md:var(--fs-base);
  --fs-lg:19px; --fs-xl:22px; --fs-2xl:26px;
  --bg-angle:20deg; --bg-speed:52s; --bg-opacity:.06;
}
.dark{
  --bg:#0e1217; --card:#121822; --surface:#11161f;
  --text:#e8edf6; --muted:#a2adbd; --border:#1b2330;
  --shadow:0 12px 28px rgba(0,0,0,.45);
}
*{box-sizing:border-box}
html,body,#root{height:100%}
html,body{overflow-x:hidden}
body{
  margin:0; font-family:var(--font); line-height:1.5; color:var(--text); font-size:var(--fs-base);
  background:
    radial-gradient(1100px 520px at 18% -10%, rgba(241,201,114,var(--bg-opacity)), transparent 60%),
    conic-gradient(from var(--bg-angle), rgba(255,138,91,.03), rgba(120,154,255,.03), rgba(88,214,169,.03), rgba(255,138,91,.03));
  background-color:var(--bg); user-select:none; -webkit-user-select:none; -ms-user-select:none;
}
.container{max-width:1100px;margin:0 auto;padding:24px 14px}
.header{ position:sticky; top:0; z-index:100; background:color-mix(in oklab, var(--surface) 85%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--border); }
.header-inner{ max-width:1100px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; padding:12px 20px; gap:10px; }
.brand{font-weight:800;letter-spacing:.6px;text-transform:uppercase;font-size:var(--fs-lg);white-space:nowrap;word-break:keep-all}
.header-right{display:flex; align-items:center; gap:10px}
.greet{font-size:var(--fs-xs); color:var(--muted)}
button{border:0; border-radius:12px; padding:12px 16px; font-weight:700; cursor:pointer; font-size:var(--fs-sm)}
:focus-visible{outline:3px solid color-mix(in oklab, var(--accent) 55%, white 45%); outline-offset:2px; border-radius:12px}
.btn-primary{color:#0c0f14; background:linear-gradient(90deg, var(--accent), var(--primary))}
.btn-ghost{ background:var(--surface); color:var(--text); border:1px solid var(--border) }
.btn-disabled{ background:#e9ecf1; color:#9aa3af; border:1px dashed var(--border); cursor:not-allowed }
.btn-cart{ position:relative; border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:999px; padding:8px 14px; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,.05); }
.badge{ position:absolute; top:-6px; right:-6px; background:#ef4444; color:#fff; border-radius:999px; font-size:11px; padding:2px 6px }
.grid{display:grid;gap:14px} .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))} .grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:980px){ .grid-3{ grid-template-columns:repeat(2,minmax(0,1fr)) } } @media (max-width:640px){ .grid-3,.grid-2{ grid-template-columns:1fr } }
.combos-grid{ display:grid; gap:14px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); } @media (min-width:768px){ .combos-grid{ grid-template-columns: repeat(2, 1fr) } }
.card{ background:var(--card); border:1px solid var(--border); border-radius:16px; padding:18px; box-shadow:var(--shadow) }
h1{font-size:var(--fs-2xl);margin:0 0 10px} h2{font-size:var(--fs-xl); margin:0 0 10px} h3{font-size:var(--fs-lg); margin:0 0 8px}
.center{text-align:center} .small{font-size:var(--fs-xs); color:var(--muted)}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap} .space{height:12px}
.price{font-size:var(--fs-lg);font-weight:800;color:var(--accent)} .actions-2{ display:grid; gap:10px; grid-template-columns:repeat(2, minmax(0, 1fr)) }
.chip-group{ display:flex; flex-wrap:wrap; gap:8px }
.chip{ padding:8px 12px; border-radius:999px; border:1px solid var(--border); background:var(--surface); cursor:pointer; font-size:var(--fs-xs); transition:background .15s, border-color .15s }
.chip.active{ border-color: color-mix(in oklab, var(--accent) 50%, var(--border) 50%); background: color-mix(in oklab, var(--accent) 15%, var(--surface) 85%); }
.stepper{ display:inline-flex; align-items:center; border:1px solid var(--border); border-radius:12px; overflow:hidden; background:var(--surface) }
.stepper button{ padding:10px 12px } .stepper .count{ min-width:38px; text-align:center; font-weight:800 }
.cart-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.32); z-index:89; opacity:0; pointer-events:none; transition:opacity .18s ease }
.cart-backdrop.show{ opacity:1; pointer-events:auto }
.cart-drawer{ position:fixed; top:0; right:0; height:100vh; width:50vw; max-width:480px; z-index:90; background:var(--surface); border-left:1px solid var(--border); box-shadow:-12px 0 28px rgba(0,0,0,.18); transform:translateX(100%); transition:transform .22s ease }
.cart-drawer.open{ transform:translateX(0) } @media (max-width:640px){ .cart-drawer{ width:90vw; max-width:90vw } }
.cart-drawer .inner{ padding:16px; display:flex; flex-direction:column; height:100% }
.cart-line{ display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px dashed var(--border); padding:10px 0 }
.modal{ position:fixed; inset:0; z-index:120; background:rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; padding:18px }
.modal .box{ width:min(520px,92vw); max-height:90vh; overflow:auto; text-align:center; background:var(--card); color:var(--text); border:1px solid var(--border); border-radius:22px; box-shadow:0 18px 48px rgba(0,0,0,.18); padding:26px 22px }
.modal h3{ font-size:clamp(22px, 1.5rem, 28px); margin:10px 0 8px } .modal .lead{ font-size:var(--fs-sm); color:var(--muted) }
.modal .cta-row{ display:flex; gap:12px; justify-content:center; margin-top:14px; flex-wrap:wrap }
.countdown{ font-variant:tabular-nums; letter-spacing:.5px; color:var(--muted); margin-top:6px }
.modal .spinner{ font-size:64px }
@keyframes bg-shift{ 0%{ filter:hue-rotate(0) saturate(1) brightness(1)} 50%{ filter:hue-rotate(18deg) saturate(1.02) brightness(1.02)} 100%{ filter:hue-rotate(0) saturate(1) brightness(1)} }
'

# 9. Eliminar ticker y uso de useTicker
log "Eliminando Ticker y hook useTicker"
remove_file_safe "${ROOT}/src/components/Ticker.tsx"
remove_file_safe "${ROOT}/src/hooks/useTicker.ts"

# 10. Actualizar App.tsx (home, combos-grid, backdrop)
log "Actualizando App.tsx"
write_file "${ROOT}/src/App.tsx" '
import React, { useMemo, useState } from "react";
import { CartProvider, useCart } from "./hooks/useCart";
import { useUpsell } from "./hooks/useUpsell";
import { COMBOS, WHATSAPP_NUMBER } from "./constants";
import { money, waLink } from "./utils/format";
import { Header } from "./components/Header";
import { CartDrawer } from "./components/CartDrawer";
import { ComboCard } from "./components/ComboCard";
import { ExtrasList } from "./components/ExtrasList";
import { UpsellModal } from "./components/UpsellModal";

function AppInner(){
  const [view, setView] = useState<"splash"|"auth"|"menu"|"checkout"|"thanks">("splash");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { items, total } = useCart();
  const { accepted, show, locked } = useUpsell() as any;

  React.useEffect(()=> { const t = setTimeout(()=> setView("auth"), 800); return ()=> clearTimeout(t); }, []);
  React.useEffect(()=> { if(view === "checkout") show(); }, [view, show]);

  const startAsGuest = ()=> setView("menu");

  const [name,setName] = useState(""); const [email,setEmail] = useState("");
  const [phone,setPhone] = useState(""); const [address,setAddress] = useState("");
  const canCheckout = useMemo(()=> items.length>0, [items]);

  const enviarWA = ()=>{
    const lines = items.map(i=> \`- \${i.name} x\${i.qty} — \${money(i.qty*i.price)}\`).join("\\n");
    const msg =`🍗 NUEVO PEDIDO - POLLOS TELLO’S

👤 Cliente: \${name}
📧 Email: \${email}
📱 Teléfono: \${phone}
📍 Dirección: \${address}

🛒 CARRITO:
\${lines}

💰 TOTAL: \${money(total)}
🍖 Pollo deshuesado: \${accepted ? "Sí" : "No"}
💳 Método de pago: Efectivo (MP próximamente)
👤 Usuario: Invitado\`;
    window.open(waLink(WHATSAPP_NUMBER, msg), "_blank");
    setView("thanks");
  };

  return (
    <>
      <Header onHome={()=> setView("auth")} onOpenCart={()=> setDrawerOpen(true)} />

      <main className="container" role="main" aria-live="polite">
        {view==="auth" && (
          <div className="grid" style={{maxWidth:560, margin:"24px auto", justifyItems:"center"}}>
            <div className="card center" style={{width:"min(520px,95vw)"}}>
              <h1> `🍗 NUEVO PEDIDO - POLLOS TELLO’S </h1> 
              <p className="small">Alta gastronomía + tecnología</p>
              <div className="space"></div>
              <div className="row" style={{justifyContent:"center"}}>
                <button className="btn-primary btn-inline" onClick={startAsGuest} aria-label="Continuar como invitado">
                  Continuar como invitado
                </button>
                <button className="btn-disabled btn-inline" disabled aria-disabled="true" title="Próximamente">
                  Registrarse
                </button>
                <button className="btn-disabled btn-inline" disabled aria-disabled="true" title="Próximamente">
                  Google
                </button>
              </div>
            </div>
          </div>
        )}

        {view==="menu" && (
          <section className="grid" aria-label="Selección de combos">
            <div className="card center">
              <h2>Elegí tu combo</h2>
              <p className="small">Acciones en 2 columnas para scrollear menos.</p>
            </div>
            <div className="combos-grid">
              {COMBOS.map(c=> <ComboCard key={c.id} combo={c} onBuy={()=> setView("checkout")} />)}
            </div>
            <ExtrasList />
            <div className="card">
              <div className="row" style={{justifyContent:"space-between", width:"100%"}}>
                <button className="btn-ghost" onClick={()=> setView("auth")} aria-label="Volver al inicio">
                  Atrás
                </button>
                <div className="row" style={{marginLeft:"auto", gap:10}}>
                  <button className="btn-primary" aria-label="Ir a datos" onClick={()=> setView("checkout")} disabled={!canCheckout}>
                    Siguiente
                  </button>
                </div>
              </div>
              <p className="small">Podés abrir el carrito para revisar antes de continuar.</p>
            </div>
          </section>
        )}

        {view==="checkout" && (
          <section className="grid" aria-label="Finalizar pedido" style={{maxWidth:860, margin:"0 auto"}}>
            <div className="card">
              <h2>Datos de entrega</h2>
              <p className="small">Preferencias: Pollo deshuesado — <strong>{accepted ? "Sí" : "No"}</strong></p>
              <div className="space"></div>
              <div className="grid grid-2" aria-disabled={locked}>
                <div><label className="label" htmlFor="name">Nombre y apellido *</label>
                  <input className="input" id="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" aria-required disabled={locked}/>
                </div>
                <div><label className="label" htmlFor="email">Email *</label>
                  <input className="input" id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" aria-required disabled={locked}/>
                </div>
                <div><label className="label" htmlFor="phone">Teléfono *</label>
                  <input className="input" id="phone" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+54 11 xxxx-xxxx" aria-required disabled={locked}/>
                </div>
                <div><label className="label" htmlFor="address">Dirección completa *</label>
                  <input className="input" id="address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Calle, número, piso, depto" aria-required disabled={locked}/>
                </div>
              </div>
              {locked && <p className="small">Un momento… preparando tu promo 👀</p>}
            </div>
            <ResumenCarrito />
            <div className="card">
              <h3>Confirmación</h3>
              <div className="row" style={{justifyContent:"space-between"}}>
                <button className="btn-ghost" onClick={()=> setView("menu")} disabled={locked}>
                  Volver
                </button>
                <button className="btn-primary"
                  aria-label="Enviar pedido por WhatsApp"
                  disabled={!name||!email||!phone||!address||!items.length||locked}
                  onClick={enviarWA}>
                  Enviar pedido (efectivo)
                </button>
              </div>
              <div className="space"></div>
              <p className="small">MercadoPago — Próximamente</p>
            </div>
          </section>
        )}

        {view==="thanks" && (
          <section className="grid" style={{maxWidth:640, margin:"0 auto"}}>
            <div className="card center">
              <h2>¡Gracias por tu compra! ✅</h2>
              <p className="small">Tu pedido fue enviado por WhatsApp. Te vamos a escribir para confirmar.</p>
            </div>
            <div className="card center">
              <h3>Próximamente</h3>
              <p className="small">Estamos preparando un <strong>portal con muchos beneficios y descuentos</strong>. ¡Estate atento! 🔓✨</p>
            </div>
            <div className="center">
              <button className="btn-primary" onClick={()=>{ setView("auth"); }}>
                Volver al inicio
              </button>
            </div>
          </section>
        )}
      </main>

      <div
        className={`cart-backdrop ${drawerOpen && (["menu","checkout"].includes(view)) ? "show" : ""}`}
        onClick={()=> setDrawerOpen(false)}
      />
      <CartDrawer
        open={drawerOpen && (["menu","checkout"].includes(view))}
        onClose={()=> setDrawerOpen(false)}
        onGoCheckout={()=>{ setDrawerOpen(false); setView("checkout"); }}
      />
      <UpsellModal />
    </>
  );
}
const ResumenCarrito: React.FC = ()=>{
  const {items, setQty, remove, totalLabel} = useCart();
  return (
    <div className="card">
      <h3>Carrito</h3>
      {items.length===0 ? <p className="small">Todavía no agregaste productos.</p> : (
        <>
          {items.map(item=>(
            <div className="cart-line" key={item.key}>
              <div style={{maxWidth:"65%"}}>
                <strong>{item.name}</strong>
                <div className="small">{new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0}).format(item.price)} c/u</div>
              </div>
              <div className="row">
                <div className="stepper" role="group" aria-label={`Cantidad ${item.name}`}>
                  <button className="btn-ghost" aria-label="Quitar" onClick={()=> setQty(item.key, item.qty-1)}>-</button>
                  <div className="count" aria-live="polite">{item.qty}</div>
                  <button className="btn-ghost" aria-label="Agregar" onClick={()=> setQty(item.key, item.qty+1)}>+</button>
                </div>
                <button className="btn-ghost" aria-label={`Eliminar ${item.name}`} onClick={()=> remove(item.key)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          <div className="row" style={{justifyContent:"space-between",paddingTop:10}}>
            <strong>Total</strong><strong className="price">{totalLabel}</strong>
          </div>
        </>
      )}
    </div>
  );
};
export default function App(){ return (<CartProvider><AppInner/></CartProvider>); }
'

log "✅ Refresco de UI aplicado. Backups en ${BACKUP_DIR}"
echo "Para revertir: ./${RESTORE_SCRIPT}"
