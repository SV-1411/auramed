import React, { createContext, useContext, useMemo, useState } from 'react';

export type MedicineProduct = {
  id: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  category: string;
  tags: string[];
  requiresPrescription: boolean;
  price: number;
  mrp?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
  availability?: {
    inStock: boolean;
    totalStock: number;
    minEtaMinutes: number | null;
  };
};

export type CartItem = {
  product: MedicineProduct;
  quantity: number;
};

type MedicineCartContextType = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (product: MedicineProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

const MedicineCartContext = createContext<MedicineCartContextType | undefined>(undefined);

export const MedicineCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem: MedicineCartContextType['addItem'] = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.product.id === product.id);
      if (existing) {
        return prev.map((x) => (x.product.id === product.id ? { ...x, quantity: x.quantity + quantity } : x));
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeItem: MedicineCartContextType['removeItem'] = (productId) => {
    setItems((prev) => prev.filter((x) => x.product.id !== productId));
  };

  const setQuantity: MedicineCartContextType['setQuantity'] = (productId, quantity) => {
    setItems((prev) => {
      const q = Math.max(0, Math.floor(quantity));
      if (q === 0) return prev.filter((x) => x.product.id !== productId);
      return prev.map((x) => (x.product.id === productId ? { ...x, quantity: q } : x));
    });
  };

  const clear = () => setItems([]);

  const totalItems = useMemo(() => items.reduce((sum, it) => sum + it.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, it) => sum + it.product.price * it.quantity, 0), [items]);

  const value: MedicineCartContextType = {
    items,
    totalItems,
    subtotal,
    addItem,
    removeItem,
    setQuantity,
    clear
  };

  return <MedicineCartContext.Provider value={value}>{children}</MedicineCartContext.Provider>;
};

export const useMedicineCart = () => {
  const ctx = useContext(MedicineCartContext);
  if (!ctx) throw new Error('useMedicineCart must be used within a MedicineCartProvider');
  return ctx;
};
