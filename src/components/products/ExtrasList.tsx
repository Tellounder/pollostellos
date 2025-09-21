import { memo, useState } from 'react';

import { EXTRAS } from "../../utils/constants";
import { useCart } from "../../hooks/useCart";
import { money } from "../../utils/format";


export const ExtrasList = memo(()=>{
  const { addItem } = useCart()
  const [qty, setQty] = useState<Record<string,number>>({})
  return (
    <div className="card">
      <h3>Extras / Toppings</h3>
      <div className="grid grid-2">
        {EXTRAS.map(e=>{
          const q = qty[e.id]||0
          return (
            <div key={e.id} className="row" style={{justifyContent:'space-between',width:'100%'}}>
              <span className="chip">{e.label} · {money(e.price)}</span>
              <div className="row" style={{marginLeft:'auto'}}>
                <div className="stepper" role="group" aria-label={`Cantidad ${e.label}`}>
                  <button className="btn-ghost" aria-label="Quitar" onClick={()=> setQty(x=>({...x,[e.id]:Math.max(0,(x[e.id]||0)-1)}))}>-</button>
                  <div className="count" aria-live="polite">{q}</div>
                  <button className="btn-ghost" aria-label="Agregar" onClick={()=> setQty(x=>({...x,[e.id]:(x[e.id]||0)+1}))}>+</button>
                </div>
                <button className="btn-ghost" style={{marginLeft:10}} aria-label={`Agregar ${e.label} al carrito`}
                  onClick={()=>{ if(q>0){ addItem(e, q); setQty(x=>({...x,[e.id]:0})) } }}>
                  Agregar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
