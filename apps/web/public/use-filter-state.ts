import { useState, useCallback } from 'react';
import { TAG_CATEGORIES, type Category } from './relationship-types';

export function useFilterState() {
  const [categoryOrder, setCategoryOrder] = useState<Category[]>([...TAG_CATEGORIES]);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(() => new Set(TAG_CATEGORIES));
  const [pinnedTags, setPinnedTags] = useState<string[]>([]);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const toggleCategory = useCallback((cat: Category) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); if (next.size === 0) return prev; } else next.add(cat);
      return next;
    });
  }, []);

  const toggleTag = useCallback((id: string) => {
    setPinnedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }, []);

  const reorderCategories = useCallback((from: number, to: number) => {
    setCategoryOrder(prev => {
      const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
    });
  }, []);

  return {
    categoryOrder, activeCategories, pinnedTags, filtersVisible,
    setFiltersVisible, toggleCategory, toggleTag, reorderCategories,
  };
}
