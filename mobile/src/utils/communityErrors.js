import { getErrorMessage } from '../services/api';

/**
 * Topluluk uç noktalarının döndürdüğü hata kodları (err.response.data.message) →
 * çeviri anahtarı (+ parametre). Kod tanınmazsa mevcut getErrorMessage kullanılır.
 */
const CODE_MAP = {
  COMMUNITY_BANNED: { key: 'community_err_banned' },
  COMMUNITY_ARCHIVED: { key: 'community_err_archived' },
  COMMUNITY_PENDING_REVIEW: { key: 'community_err_pending_review' },
  POLL_TOO_MANY_OPTIONS: { key: 'community_err_poll_too_many', params: { max: 4 } },
  POLL_OPTION_TOO_LONG: { key: 'community_err_poll_option_too_long', params: { max: 60 } },
  INVALID_IMAGE_URL: { key: 'community_err_invalid_image' },
  INVALID_IMAGE: { key: 'err_invalid_image_file' },
  TOO_MANY_REQUESTS: { key: 'auth_too_many' },
  CONTENT_TOO_LONG: { key: 'community_err_content_too_long' },
  POST_LIMIT: { key: 'err_post_limit' },
  COMMENT_LIMIT: { key: 'err_comment_limit' },
  MESSAGE_LIMIT: { key: 'err_message_limit' },
  PRIVATE_ACCOUNT: { key: 'err_private_account' },
  SETLIST_NOT_ATTENDED: { key: 'setlist_err_not_attended' },
};

// fallbackKey verilirse tanınmayan hatalarda getErrorMessage yerine o çeviri gösterilir.
export function communityErrorMessage(err, t, fallbackKey) {
  const code = err?.response?.data?.message;
  const entry = typeof code === 'string' ? CODE_MAP[code] : null;
  if (entry) return t(entry.key, entry.params);
  return fallbackKey ? t(fallbackKey) : getErrorMessage(err);
}

// Gizli hesabın içeriğine yetkisiz erişimde sunucu 403 + PRIVATE_ACCOUNT döner.
export function isPrivateAccountError(err) {
  const data = err?.response?.data;
  return err?.response?.status === 403
    && (data?.message === 'PRIVATE_ACCOUNT' || data?.reason === 'PRIVATE_ACCOUNT');
}

// Topluluk dışı ekranlar için nötr takma ad.
export const apiErrorMessage = communityErrorMessage;
