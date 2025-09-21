export const money = (n:number)=>
  new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0}).format(n)

export const waLink = (phone:string, text:string)=>{
  const num = phone.replace('+','')
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}
