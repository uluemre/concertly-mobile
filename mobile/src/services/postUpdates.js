import { useEffect } from 'react';

/**
 * Gönderi değişiklikleri için küçük yayın-abone mekanizması.
 *
 * PostDetail'de ya da akıştaki kartta beğeni/yorum/metin değişince, gönderi silinince
 * veya yazarı engellenince yayınlanır; o gönderiyi listeleyen ekranlar (Ana sayfa,
 * Akış, profiller) yalnızca ilgili öğeyi günceller. Böylece geri dönüldüğünde liste
 * eski kalmaz ve tamamını yeniden yüklemek gerekmez.
 */
const listeners = new Set();
const emit = (event) => listeners.forEach(listener => listener(event));

/** patch: { likeCount?, likedByMe?, commentCount?, content?, updatedAt?, pollOptions? } */
export function publishPostUpdate(postId, patch) {
  if (postId === undefined || postId === null) return;
  emit({ type: 'patch', postId, patch });
}

/** Gönderi silindi: tüm listelerden çıkar. */
export function publishPostRemoved(postId) {
  if (postId === undefined || postId === null) return;
  emit({ type: 'remove', postId });
}

/** Kullanıcı engellendi: o kişinin gönderileri tüm listelerden çıkar. */
export function publishUserHidden(userId) {
  if (userId === undefined || userId === null) return;
  emit({ type: 'hideUser', userId });
}

/** Yeni gönderi paylaşıldı: `onCreated` veren listeler başa ekleyebilir. */
export function publishPostCreated(post) {
  if (!post?.id) return;
  emit({ type: 'create', post });
}

/** Liste state'ini (setPosts) yayınlanan değişikliklerle senkron tutar. */
export function usePostUpdates(setPosts, { onCreated } = {}) {
  useEffect(() => {
    const listener = (event) => {
      if (event.type === 'create') { onCreated?.(event.post); return; }
      setPosts(prev => {
        if (!Array.isArray(prev)) return prev;
        if (event.type === 'remove') {
          return prev.some(p => p.id === event.postId) ? prev.filter(p => p.id !== event.postId) : prev;
        }
        if (event.type === 'hideUser') {
          return prev.some(p => p.userId === event.userId) ? prev.filter(p => p.userId !== event.userId) : prev;
        }
        if (!prev.some(p => p.id === event.postId)) return prev;
        return prev.map(p => (p.id === event.postId ? { ...p, ...event.patch } : p));
      });
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [setPosts, onCreated]);
}

/** Gönderi düzenlendi mi (oluşturulduktan 1 dakikadan sonra güncellenmiş). */
export function isPostEdited(post) {
  if (!post?.updatedAt || !post?.createdAt) return false;
  return new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 60000;
}
