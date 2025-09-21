
import { useEffect, useState } from "react";
export function useTheme(){
  const [theme,setTheme] = useState<"light"|"dark">(()=>{
    try{ const v = localStorage.getItem("pt_theme"); return (v==="dark"||v==="light")? v : "light"; }catch{ return "light"; }
  });
  useEffect(()=>{
    try{ localStorage.setItem("pt_theme", theme) }catch(e){ console.error(e) }
    const root = document.documentElement;
    if(theme==="dark") root.classList.add("dark");
    else root.classList.remove("dark");
  },[theme]);
  const toggle = ()=> setTheme(t=> t==="light" ? "dark" : "light");
  return { theme, toggle };
}

