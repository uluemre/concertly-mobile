import { useEffect } from 'react';

/**
 * Gönderi sayaçları (beğeni / yorum) için küçük yayın-abone mekanizması.
 *
 * PostDetail'de ya da akıştaki kartta beğeni/yorum değişince yayınlanır; o
 * gönderiyi listeleyen ekranlar (Ana sayfa, Akış, profiller) yalnızca o öğeyi
 * günceller. Böylece geri dönüldüğünde sayılar eski kalmaz ve akışın tamamını
 * yeniden yüklemek gerekmez.
 */
const listeners = new Set();

/** patch: { likeCount?, likedByMe?, commentCount? } */
export function publishPostUpdate(postId, patch) {
  if (postId === undefined || postId === null) return;
  listeners.forEach(listener => listener(postId, patch));
}

/** Liste state'ini (setPosts) yayınlanan güncellemelerle senkron tutar. */
export function usePostUpdates(setPosts) {
  useEffect(() => {
    const listener = (postId, patch) => setPosts(prev => {
      if (!Array.isArray(prev) || !prev.some(p => p.id === postId)) return prev;
      return prev.map(p => (p.id === postId ? { ...p, ...patch } : p));
    });
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [setPosts]);
}
