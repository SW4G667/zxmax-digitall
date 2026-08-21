import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "zxmax_favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {}
    // Dispatch event so header counter updates across components
    window.dispatchEvent(new CustomEvent("zxmax:favorites-updated", { detail: favorites.length }));
  }, [favorites]);

  const toggle = useCallback((productId: number) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }, []);

  const isFavorite = useCallback((productId: number) => favorites.includes(productId), [favorites]);

  const count = favorites.length;

  return { favorites, toggle, isFavorite, count, setFavorites };
}

export default useFavorites;
