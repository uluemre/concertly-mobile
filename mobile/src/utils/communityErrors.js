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
  // Topluluk işlemleri (C5): sunucu artık ham Türkçe cümle yerine kod döndürüyor
  COMMUNITY_OWNER_ONLY_DELETE: { key: 'cerr_community_owner_only_delete' },
  COMMUNITY_OWNER_ONLY_ROLES: { key: 'cerr_community_owner_only_roles' },
  COMMUNITY_OWNER_ONLY_REMOVE_MOD: { key: 'cerr_community_owner_only_remove_mod' },
  COMMUNITY_OWNER_ONLY_TRANSFER: { key: 'cerr_community_owner_only_transfer' },
  COMMUNITY_MEMBERS_ONLY_COMMENT: { key: 'cerr_community_members_only_comment' },
  COMMUNITY_MEMBERS_ONLY_VIEW: { key: 'cerr_community_members_only_view' },
  COMMUNITY_MEMBERS_ONLY_POST: { key: 'cerr_community_members_only_post' },
  COMMUNITY_MEMBERS_ONLY_VOTE: { key: 'cerr_community_members_only_vote' },
  COMMUNITY_NO_PERMISSION: { key: 'cerr_community_no_permission' },
  COMMUNITY_NAME_REQUIRED: { key: 'cerr_community_name_required' },
  COMMUNITY_OWN_LIMIT: { key: 'cerr_community_own_limit', params: { max: 5 } },
  COMMUNITY_JOIN_PENDING: { key: 'cerr_community_join_pending' },
  COMMUNITY_INVITE_ONLY: { key: 'cerr_community_invite_only' },
  INVITE_LINK_INVALID: { key: 'cerr_invite_link_invalid' },
  COMMUNITY_NOT_MEMBER: { key: 'cerr_community_not_member' },
  COMMUNITY_OWNER_CANNOT_LEAVE: { key: 'cerr_community_owner_cannot_leave' },
  JOIN_REQUEST_NOT_FOUND: { key: 'cerr_join_request_not_found' },
  JOIN_REQUEST_NOT_PENDING: { key: 'cerr_join_request_not_pending' },
  COMMUNITY_ALREADY_MEMBER: { key: 'cerr_community_already_member' },
  INVITE_NOT_FOUND: { key: 'cerr_invite_not_found' },
  INVITE_NOT_PENDING: { key: 'cerr_invite_not_pending' },
  COMMUNITY_INVALID_ROLE: { key: 'cerr_community_invalid_role' },
  COMMUNITY_MEMBER_NOT_FOUND: { key: 'cerr_community_member_not_found' },
  COMMUNITY_OWNER_ROLE_LOCKED: { key: 'cerr_community_owner_role_locked' },
  COMMUNITY_ROLE_ACTIVE_ONLY: { key: 'cerr_community_role_active_only' },
  COMMUNITY_OWNER_CANNOT_BE_REMOVED: { key: 'cerr_community_owner_cannot_be_removed' },
  COMMUNITY_CANNOT_BAN_SELF: { key: 'cerr_community_cannot_ban_self' },
  COMMUNITY_BANNED_MEMBER_NOT_FOUND: { key: 'cerr_community_banned_member_not_found' },
  COMMUNITY_TRANSFER_TO_SELF: { key: 'cerr_community_transfer_to_self' },
  COMMUNITY_TRANSFER_TARGET_NOT_FOUND: { key: 'cerr_community_transfer_target_not_found' },
  COMMUNITY_TRANSFER_ACTIVE_ONLY: { key: 'cerr_community_transfer_active_only' },
  COMMENT_EMPTY: { key: 'cerr_comment_empty' },
};

// fallbackKey verilirse tanınmayan hatalarda getErrorMessage yerine o çeviri gösterilir.
export function communityErrorMessage(err, t, fallbackKey) {
  const code = err?.response?.data?.message;
  const entry = typeof code === 'string' ? CODE_MAP[code] : null;
  if (entry) return t(entry.key, entry.params);
  if (fallbackKey) return t(fallbackKey);
  // Tanınmayan bir hata kodu (ör. yeni sunucu sürümü) kullanıcıya ham gösterilmez
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(code)) return t('err_generic');
  return getErrorMessage(err);
}

// Gizli hesabın içeriğine yetkisiz erişimde sunucu 403 + PRIVATE_ACCOUNT döner.
export function isPrivateAccountError(err) {
  const data = err?.response?.data;
  return err?.response?.status === 403
    && (data?.message === 'PRIVATE_ACCOUNT' || data?.reason === 'PRIVATE_ACCOUNT');
}

// Topluluk dışı ekranlar için nötr takma ad.
export const apiErrorMessage = communityErrorMessage;
