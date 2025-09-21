import { useEffect, useState } from 'react'

export function useLocalStorage<T>(key:string, initial:T){
  const [value,setValue] = useState<T>(()=>{
    try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : initial }catch{ return initial }
  })
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(value)) }catch(e){ console.error(e) } },[key,value])
  return [value,setValue] as const
}
