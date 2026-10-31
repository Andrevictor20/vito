import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { PendingItem } from '../types';

export function usePendingItems() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPendingItems();
      setItems(data || []);
    } catch (e) {
      console.error('[usePendingItems] Falha ao buscar pendências:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const completeItem = useCallback(async (id: string) => {
    try {
      await api.completePendingItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error('[usePendingItems] Falha ao completar item:', e);
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await api.deletePendingItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error('[usePendingItems] Falha ao excluir item:', e);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    refresh: fetchItems,
    completeItem,
    deleteItem,
  };
}
