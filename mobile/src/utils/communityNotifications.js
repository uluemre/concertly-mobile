/**
 * Topluluk bildirimleri (A3).
 *
 * Sunucu tüm community_* bildirimlerinde entityType="community" ve entityId=topluluk id'si
 * gönderir. Aktörsüz (sistem) bildirimlerin message alanı Türkçe bir cümledir ve
 * topluluk adını tırnak içinde taşır: "\"Ad\" toplulugu ...". Metin istemcide dile göre
 * üretilir; mesajdan yalnızca topluluk adı alınır.
 */
export const COMMUNITY_NOTIFICATION_TYPES = [
  'community_invite',
  'community_join_request',
  'community_request_approved',
  'community_approved',
  'community_rejected',
  'community_ownership',
  'community_comment',
];

// Aktörü olan tipler "@kullanıcı ..." diye başlar; diğerleri tam cümledir
export const COMMUNITY_ACTOR_TYPES = ['community_invite', 'community_join_request', 'community_comment'];

export function isCommunityNotification(type) {
  return COMMUNITY_NOTIFICATION_TYPES.includes(type);
}

/** Sistem mesajındaki tırnaklı topluluk adı; yoksa null. */
export function communityNameFromMessage(message) {
  if (!message) return null;
  const m = /^"(.+)"\s/.exec(String(message));
  return m ? m[1] : null;
}

/**
 * Bildirimin açacağı ekran. Katılma isteği yöneticiyi yönetim ekranına, diğerleri
 * topluluk detayına götürür. Topluluk silinmişse ekranlar "bulunamadı" gösterir.
 */
export function communityRoute(type, entityId) {
  const communityId = entityId != null ? Number(entityId) : null;
  if (!communityId) return null;
  if (type === 'community_join_request') {
    return { screen: 'CommunityManage', params: { communityId } };
  }
  return { screen: 'CommunityDetail', params: { communityId } };
}
