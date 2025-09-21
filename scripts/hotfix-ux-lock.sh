#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(pwd)"
echo "[HOTFIX] Backup de archivos…"
cp src/hooks/useUpsell.ts src/hooks/useUpsell.ts.bak 2>/dev/null || true
cp src/components/UpsellModal.tsx src/components/UpsellModal.tsx.bak 2>/dev/null || true
cp src/App.tsx src/App.tsx.bak 2>/dev/null || true

echo "[HOTFIX] Parchando useUpsell.ts"
cat > src/hooks/useUpsell.ts <<'TS'
import { useEffect, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage";

/**
 * Hook robusto para popup de upsell:
 * - show() abre y bloquea inputs
 * - accept/cancel cierran y liberan
 * - auto-unlock en 5s aunque el modal no se vea
 * - recovery: si quedó "locked" en localStorage, se libera al montar
 */
export function useUpsell(){
  const [accepted, setAccepted] = useLocalStorage<boolean>("pt_upsell", false);
  const [open, setOpen] = useLocalStorage<boolean>("pt_upsell_open", false);
  const [countdown, setCountdown] = useLocalStorage<number>("pt_upsell_cd", 5);
  const [locked, setLocked] = useLocalStorage<boolean>("pt_form_locked", false);

  const tickRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Recovery al montar: si quedó bloqueado y no hay modal, liberar
  useEffect(()=>{
    if (locked && !open) {
      setLocked(false);
      setCountdown(5);
      setAccepted(false);
      document.body.classList.remove("modal-open");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearTimers = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const close = () => {
    clearTimers();
    setOpen(false);
    setLocked(false);
    document.body.classList.remove("modal-open");
  };

  const show = () => {
    clearTimers();
    setAccepted(false);
    setCountdown(5);
    setOpen(true);
    setLocked(true);
    document.body.classList.add("modal-open");

    // Countdown visible
    tickRef.current = window.setInterval(()=> {
      setCountdown(c => (c > 0 ? c - 1 : 0));
    }, 1000);

    // Fail-safe: a los 5s cerrar y liberar aunque no se vea
    timerRef.current = window.setTimeout(()=> {
      close();
    }, 5000);
  };

  const acceptAndClose = () => { setAccepted(true); close(); };
  const cancelAndClose = () => { setAccepted(false); close(); };

  // Limpieza al desmontar
  useEffect(()=> () => clearTimers(), []);

  return { accepted, setAccepted, open, show, countdown, locked, acceptAndClose, cancelAndClose, close };
}
TS

echo "[HOTFIX] Parchando UpsellModal.tsx"
cat > src/components/UpsellModal.tsx <<'TSX'
import React from "react";
import { useUpsell } from "../hooks/useUpsell";

export const UpsellModal: React.FC = () => {
  const { open, countdown, acceptAndClose, cancelAndClose } = useUpsell() as any;
  if (!open) return null;
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
TSX

echo "[HOTFIX] Parchando App.tsx (fences de seguridad)"
# Normalizar posibles escapes de template literals si quedaron
sed -i 's/\\`/`/g; s/\\\${/${/g' src/App.tsx

# Insertar fences: auto-show en checkout y auto-unlock por si algo falla
# 1) Asegurar efecto show() en checkout (ya lo tenés, lo reforzamos con unlock fail-safe)
#   Buscamos el efecto existente y lo reemplazamos por versión con fallback
python3 - <<'PY' || true
import io,sys,re,os
p='src/App.tsx'
s=open(p,'r',encoding='utf-8').read()
s=re.sub(
  r'React\.useEffect\(\)\s*=>\s*\{\s*const t\s*=\s*setTimeout\(\)\s*=>\s*setView\("auth"\),\s*800\);\s*return\s*\(\)\s*=>\s*clearTimeout\(t\);\s*\},\[\]\);',
  r'React.useEffect(()=>{ const t=setTimeout(()=> setView("auth"), 800); return ()=> clearTimeout(t); },[]);',
  s
)
# Reemplazar el effect que abre el modal por una versión con fallback unlock
s=re.sub(
  r'React\.useEffect\(\s*=>\s*\{\s*if\(view===["\']checkout["\']\)\s*show\(\);\s*\},\s*\[view,\s*show\]\s*\);\s*',
  r'''React.useEffect(()=> {
  if (view==="checkout") {
    show();
    // Fail-safe extra: si por cualquier razón quedara "locked" a los 6s, liberar
    const u = setTimeout(()=> {
      const lockedFlag = localStorage.getItem("pt_form_locked");
      if (lockedFlag === "true") {
        localStorage.setItem("pt_form_locked","false");
        // Forzar re-render rápido cambiando enfoque (opcional)
        // setForce(n=>n+1);
      }
    }, 6000);
    return ()=> clearTimeout(u);
  }
}, [view, show]);''',
  s
)
open(p,'w',encoding='utf-8').write(s)
PY

echo "[HOTFIX] Listo. Reiniciá el dev server si estaba corriendo."
