import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Combo, Extra } from "utils/constants";

// The product can be a Combo or an Extra
export type Product = Combo | Extra;

// The item in the cart is a Product with quantity and a unique key
export type CartItem = Product & {
  qty: number;
  key: string;
  side?: string;
};

// The state of the cart store
interface CartState {
  items: CartItem[];
  addItem: (product: Product, qty?: number, side?: string) => void;
  removeItem: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clearCart: () => void;
  // Derived state
  total: number;
  totalLabel: string;
  count: number;
}

// Helper to format currency
const formatTotal = (total: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(total);

// Helper to calculate totals and count from items
const calculateDerivedState = (items: CartItem[]) => {
  const count = items.reduce((acc, i) => acc + i.qty, 0);
  const total = items.reduce((acc, i) => acc + i.price * i.qty, 0);
  return { count, total, totalLabel: formatTotal(total) };
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      totalLabel: formatTotal(0),
      count: 0,

      addItem: (product, qty = 1, side) => {
        const { items } = get();
        // If the product has a side, the key should be unique for each side
        const baseId = String(product.id);
        const key = side ? `${baseId}-${side}` : baseId;
        const existingItem = items.find((i) => i.key === key);

        let newItems: CartItem[];
        if (existingItem) {
          newItems = items.map((i) =>
            i.key === key ? { ...i, qty: i.qty + qty } : i
          );
        } else {
          newItems = [
            ...items,
            {
              ...product,
              qty,
              side,
              key,
            },
          ];
        }
        set({ items: newItems, ...calculateDerivedState(newItems) });
      },

      removeItem: (key) => {
        const { items } = get();
        const newItems = items.filter((i) => i.key !== key);
        set({ items: newItems, ...calculateDerivedState(newItems) });
      },

      setQty: (key, qty) => {
        const { items } = get();
        if (qty <= 0) {
          // If quantity is zero or less, remove the item
          const newItems = items.filter((i) => i.key !== key);
          set({ items: newItems, ...calculateDerivedState(newItems) });
          return;
        }
        const newItems = items.map((i) => (i.key === key ? { ...i, qty } : i));
        set({ items: newItems, ...calculateDerivedState(newItems) });
      },
      
      clearCart: () => set({ items: [], total: 0, totalLabel: formatTotal(0), count: 0 }),
    }),
    {
      name: "pt-cart-storage", // name of the item in the storage (must be unique)
    }
  )
);
