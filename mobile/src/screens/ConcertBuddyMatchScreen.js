import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Switch,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts } from '../theme';
import { ListSkeletonPage } from '../components/SkeletonLoader';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ConfettiOverlay from '../components/ConfettiOverlay';
import EventImage from '../components/EventImage';
import EventCard from '../components/EventCard';
import { goBackOrFallback, openEvent } from '../navigation/navHelpers';
import { useReport, confirmBlock, MODAL_AFTER_ALERT_MS } from '../components/ReportSheet';
import { useBuddyMatch } from '../components/buddy/useBuddyMatch';
import BuddyCard from '../components/buddy/BuddyCard';
import BuddySwipeDeck from '../components/buddy/BuddySwipeDeck';
import BuddyMatchModal from '../components/buddy/BuddyMatchModal';
import BuddyFilterSheet from '../components/buddy/BuddyFilterSheet';
import BuddyProfileModal from '../components/buddy/BuddyProfileModal';
import BuddyConcertModal from '../components/buddy/BuddyConcertModal';
import { eventTitle, longDate, onPhoto } from '../components/buddy/buddyUtils';

function Avatar({ user, size, styles }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, styles.avatar]}>
      {user?.profileImageUrl ? (
        <Image source={{ uri: user.profileImageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <Text style={[styles.avatarLetter, { fontSize: size * 0.4 }]}>{user?.username?.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

export default function ConcertBuddyMatchScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const { t, tu, lang } = useLanguage();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const insets = useSafeAreaInsets();
  const confettiRef = useRef(null);
  const { openReport, reportSheet } = useReport();

  const buddy = useBuddyMatch({ t, initialEventId: route?.params?.eventId, userCity: session.userCity });
  const {
    loading, loadError, cards, deck, myEvents, lookingEvents, likesReceived, matches, newMatches, chats,
    nearby, lastSwipe, matchedUser, dismissMatch, toggling, showSafety, dismissSafety,
    activeEvent, setEventFilter, genreFilter, setGenreFilter, genreOptions, activeFilterCount, clearFilters,
    refresh, beginSwipe, sendSwipe, undo, toggleLooking, unmatch, removeUser, statusOf,
  } = buddy;

  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'discover');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profileCard, setProfileCard] = useState(null);
  const [concertId, setConcertId] = useState(null);
  const concert = myEvents.find(e => e.id === concertId) || null;

  // Bildirimden gelen sekme parametresi ekran açıkken de uygulanır
  useEffect(() => {
    if (route?.params?.tab) setActiveTab(route.params.tab);
  }, [route?.params?.tab]);

  // Eşleşme modalı açılınca konfeti (modalın içinde çizilir)
  useEffect(() => {
    if (!matchedUser) return undefined;
    const id = setTimeout(() => confettiRef.current?.fire(), 120);
    return () => clearTimeout(id);
  }, [matchedUser]);

  const currentCard = deck[0];
  const nextCard = deck[1];

  // Deste açıkken iOS'un kenardan geri kaydırması kapalı: sağa kaydırma kartı beğenir
  const deckActive = !loading && activeTab === 'discover' && !!currentCard && lookingEvents.length > 0;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !deckActive });
  }, [navigation, deckActive]);

  // ── Gezinme ────────────────────────────────────────────────────────────────
  const openChat = useCallback((person, initialText) => navigation.navigate('Chat', {
    userId: person.userId,
    username: person.username,
    profileImageUrl: person.profileImageUrl,
    sharedEventName: person.sharedEvents?.[0]?.name ?? null,
    initialText,
  }), [navigation]);

  const closeOverlays = () => {
    setProfileCard(null);
    setConcertId(null);
  };

  // Modal kapanırken Alert/sayfa açılırsa iOS göstermiyor: kapanış bitince açılır
  const afterOverlays = (fn) => {
    const open = !!profileCard || !!concertId;
    closeOverlays();
    if (open) setTimeout(fn, MODAL_AFTER_ALERT_MS);
    else fn();
  };

  const explainCompat = () => Alert.alert(t('buddy_compat_explain_title'), t('buddy_compat_explain_msg'));

  // Kart "⋯": eşleşmeden önce de profil, şikâyet ve engel. Android Alert en fazla 3
  // düğme gösterir: iptal yalnız iOS'ta, Android'de dışarı dokunarak kapanır.
  const openCardMenu = (card) => afterOverlays(() => {
    const buttons = [
      { text: t('buddy_view_profile'), onPress: () => navigation.navigate('UserProfile', { userId: card.userId }) },
      { text: t('mod_report'), onPress: () => openReport('USER', card.userId) },
      { text: t('mod_block'), style: 'destructive', onPress: () => confirmBlock(t, card.userId, () => removeUser(card.userId)) },
    ];
    if (Platform.OS === 'ios') buttons.push({ text: t('mod_cancel'), style: 'cancel' });
    Alert.alert(`@${card.username}`, undefined, buttons, { cancelable: true });
  });

  const openMatchMenu = (m) => {
    Alert.alert(`@${m.username}`, undefined, [
      { text: t('buddy_view_profile'), onPress: () => navigation.navigate('UserProfile', { userId: m.userId }) },
      {
        text: t('buddy_unmatch'),
        style: 'destructive',
        onPress: () => Alert.alert(t('buddy_unmatch'), t('buddy_unmatch_confirm', { username: m.username }), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('buddy_unmatch'), style: 'destructive', onPress: () => unmatch(m.userId) },
        ]),
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  // Profil ve konser listesinden verilen kararlar animasyonsuz kaydedilir
  const decide = (card, liked) => {
    if (!beginSwipe()) return;
    setProfileCard(null);
    sendSwipe(card, liked);
  };

  // ── Kart ───────────────────────────────────────────────────────────────────
  const renderCard = (card, isBack) => (
    <BuddyCard
      card={card}
      activeEvent={activeEvent}
      t={t}
      locale={locale}
      isBack={isBack}
      onMenu={() => openCardMenu(card)}
      onScore={explainCompat}
    />
  );

  const Panel = ({ icon, title, sub, children }) => (
    <View style={styles.panel}>
      <View style={styles.panelIcon}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <Text style={styles.panelTitle}>{title}</Text>
      {sub ? <Text style={styles.panelSub}>{sub}</Text> : null}
      {children}
    </View>
  );

  const safetyNote = showSafety ? (
    <View style={styles.safety}>
      <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.safetyTitle}>{t('buddy_safety_title')}</Text>
        <Text style={styles.safetySub}>{t('buddy_safety_sub')}</Text>
      </View>
      <TouchableOpacity onPress={dismissSafety} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('close')}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  ) : null;

  // ── Keşfet ─────────────────────────────────────────────────────────────────
  const renderDiscover = () => {
    if (loadError && cards.length === 0 && myEvents.length === 0) {
      return (
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Panel icon="cloud-offline" title={t('load_failed')} sub={t('buddy_load_failed_sub')}>
            <TouchableOpacity onPress={refresh} style={[styles.primaryBtn, styles.panelBtn]} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </Panel>
        </ScrollView>
      );
    }
    if (lookingEvents.length === 0) {
      return (
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Panel icon="people" title={t('buddy_not_looking_title')} sub={t('buddy_not_looking_sub')}>
            <TouchableOpacity
              onPress={() => (myEvents.length ? setActiveTab('concerts') : navigation.navigate('MainApp', { screen: 'Events' }))}
              style={[styles.primaryBtn, styles.panelBtn]}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name={myEvents.length ? 'toggle' : 'ticket-outline'} size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{myEvents.length ? t('buddy_open_concerts') : t('buddy_browse')}</Text>
            </TouchableOpacity>
          </Panel>
        </ScrollView>
      );
    }
    if (currentCard) {
      return (
        <View style={{ flex: 1 }}>
          {likesReceived > 0 ? (
            <View style={styles.likes}>
              <Ionicons name="heart" size={13} color={colors.primary} />
              <Text style={styles.likesText}>{t('buddy_likes_banner', { count: likesReceived })}</Text>
            </View>
          ) : null}
          {safetyNote}
          <View style={{ flex: 1, paddingBottom: insets.bottom }}>
            <BuddySwipeDeck
              key={currentCard.userId}
              card={currentCard}
              next={nextCard}
              renderCard={renderCard}
              beginSwipe={beginSwipe}
              onSwipe={sendSwipe}
              onOpen={setProfileCard}
              t={t}
              tu={tu}
            />
          </View>
        </View>
      );
    }
    // Deste boş: filtre yüzünden mi, yoksa herkes görüldü mü
    if (activeFilterCount > 0 && cards.some(c => statusOf(c.userId) === 'open')) {
      return (
        <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          <Panel icon="options" title={t('buddy_filter_empty_title')} sub={t('buddy_filter_empty_sub')}>
            <TouchableOpacity onPress={clearFilters} style={[styles.primaryBtn, styles.panelBtn]} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="close-circle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{t('buddy_filter_clear')}</Text>
            </TouchableOpacity>
          </Panel>
        </ScrollView>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        {safetyNote}
        <Panel icon="hourglass" title={t('buddy_done_title')} sub={t('buddy_done_sub', { count: lookingEvents.length })}>
          <View style={styles.panelActions}>
            <TouchableOpacity onPress={() => setActiveTab('concerts')} style={styles.primaryBtn} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="toggle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>{t('buddy_tab_concerts')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={refresh} style={styles.outlineBtn} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('buddy_refresh')}>
              <Ionicons name="refresh" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          {lastSwipe ? (
            <TouchableOpacity onPress={undo} style={styles.undoLink} accessibilityRole="button">
              <Ionicons name="arrow-undo" size={14} color={colors.secondary} />
              <Text style={styles.undoLinkText}>{t('buddy_undo')}</Text>
            </TouchableOpacity>
          ) : null}
        </Panel>
        {nearby.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('buddy_nearby')}</Text>
            {nearby.map(e => <EventCard key={e.id} item={e} variant="row" onPress={() => openEvent(navigation, e.id)} />)}
          </>
        )}
      </ScrollView>
    );
  };

  // ── Eşleşmeler ─────────────────────────────────────────────────────────────
  const matchRow = (m, isNew) => {
    const shared = m.sharedEvents?.[0];
    const preview = isNew
      ? (shared ? t('buddy_preview_plan', { event: eventTitle(shared) }) : t('buddy_preview_hello'))
      : t('buddy_preview_continue');
    return (
      <TouchableOpacity
        key={m.userId}
        style={styles.matchRow}
        onPress={() => openChat(m)}
        onLongPress={() => openMatchMenu(m)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`@${m.username}${isNew ? `, ${t('buddy_new_badge')}` : ''}. ${preview}`}
        accessibilityActions={[{ name: 'activate' }, { name: 'menu', label: t('mod_options_title') }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'menu' ? openMatchMenu(m) : openChat(m))}
      >
        <Avatar user={m} size={56} styles={styles} />
        <View style={{ flex: 1 }}>
          <Text style={styles.matchName} numberOfLines={1}>{m.fullName || `@${m.username}`}</Text>
          <Text style={[styles.matchPreview, isNew && styles.matchPreviewNew]} numberOfLines={1}>{preview}</Text>
        </View>
        <View style={styles.matchSide}>
          {m.compatibility ? <Text style={styles.matchScore}>%{m.compatibility}</Text> : null}
          {isNew ? <View style={styles.newDot} /> : null}
        </View>
        <TouchableOpacity onPress={() => openMatchMenu(m)} hitSlop={10} style={styles.moreBtn} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderMatches = () => (
    <ScrollView contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
      {matches.length === 0 ? (
        <Panel icon="chatbubbles" title={t('buddy_no_matches')} sub={t('buddy_no_matches_sub')} />
      ) : (
        <>
          {newMatches.length > 0 && <Text style={styles.sectionTitle}>{t('buddy_new_matches')}</Text>}
          {newMatches.map(m => matchRow(m, true))}
          {chats.length > 0 && <Text style={styles.sectionTitle}>{t('buddy_conversations')}</Text>}
          {chats.map(m => matchRow(m, false))}
        </>
      )}
    </ScrollView>
  );

  // ── Konserlerim ────────────────────────────────────────────────────────────
  const renderConcerts = () => (
    <FlatList
      data={myEvents}
      keyExtractor={ev => String(ev.id)}
      contentContainerStyle={styles.scrollPad}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={myEvents.length ? <Text style={styles.concertsHint}>{t('buddy_concerts_hint')}</Text> : null}
      ListEmptyComponent={(
        <Panel icon="ticket" title={t('buddy_concerts_empty_title')} sub={t('buddy_concerts_empty_sub')}>
          <TouchableOpacity
            onPress={() => navigation.navigate('MainApp', { screen: 'Events' })}
            style={[styles.primaryBtn, styles.panelBtn]}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="ticket-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('buddy_browse')}</Text>
          </TouchableOpacity>
        </Panel>
      )}
      renderItem={({ item: ev }) => (
        <TouchableOpacity
          style={[styles.concertCard, ev.lookingForBuddy && styles.concertCardOn]}
          onPress={() => setConcertId(ev.id)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`${eventTitle(ev)}, ${longDate(ev.eventDate, locale)}`}
        >
          <EventImage item={{ ...ev, name: eventTitle(ev) }} style={StyleSheet.absoluteFill} initialsSize={30} />
          <LinearGradient colors={['transparent', onPhoto.shade]} style={StyleSheet.absoluteFill} />
          <View style={styles.concertBody}>
            <Text style={styles.concertDate}>{longDate(ev.eventDate, locale)}</Text>
            <Text style={styles.concertArtist} numberOfLines={1}>{eventTitle(ev)}</Text>
            <Text style={styles.concertMeta} numberOfLines={1}>
              {[ev.venueName, ev.venueCity].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.concertFooter}>
              <Text style={styles.concertCount}>
                {ev.buddyCount > 0 ? t('buddy_looking_count', { count: ev.buddyCount }) : t('buddy_looking_none')}
              </Text>
              {toggling === ev.id ? (
                <ActivityIndicator color="#fff" style={{ width: 51 }} />
              ) : (
                <Switch
                  value={!!ev.lookingForBuddy}
                  onValueChange={() => toggleLooking(ev)}
                  trackColor={{ false: 'rgba(255,255,255,0.25)', true: colors.primary }}
                  thumbColor="#fff"
                  accessibilityLabel={t('a11y_buddy_switch', { name: eventTitle(ev) })}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );

  const tabs = [
    ['discover', 'compass', t('buddy_discover'), deck.length],
    ['matches', 'chatbubbles', t('buddy_matches'), newMatches.length],
    ['concerts', 'ticket', t('buddy_tab_concerts'), lookingEvents.length],
  ];

  // ── Üstteki modallar ───────────────────────────────────────────────────────
  // iOS bir modalın üstünde yalnızca onun içinde çizilen modalı gösterir: profil ve
  // eşleşme, konser listesi açıksa onun içinde çizilir.
  const profileModal = profileCard ? (
    <BuddyProfileModal
      card={profileCard}
      status={statusOf(profileCard.userId)}
      t={t}
      tu={tu}
      locale={locale}
      onClose={() => setProfileCard(null)}
      onDecide={liked => decide(profileCard, liked)}
      onChat={() => afterOverlays(() => openChat(profileCard))}
      onMenu={() => openCardMenu(profileCard)}
      onScore={explainCompat}
      onEvent={id => afterOverlays(() => openEvent(navigation, id))}
      onFullProfile={() => afterOverlays(() => navigation.navigate('UserProfile', { userId: profileCard.userId }))}
    />
  ) : null;

  const matchModal = matchedUser ? (
    <BuddyMatchModal
      matchedUser={matchedUser}
      me={{ username: session.username, profileImageUrl: session.profileImageUrl }}
      t={t}
      tu={tu}
      locale={locale}
      onClose={dismissMatch}
      onChat={(text) => {
        const person = matchedUser;
        dismissMatch();
        afterOverlays(() => openChat(person, text));
      }}
    >
      <ConfettiOverlay ref={confettiRef} />
    </BuddyMatchModal>
  ) : null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[`${colors.primary}33`, 'transparent']} start={{ x: 0.1, y: 0 }} end={{ x: 0.7, y: 0.55 }} style={styles.glowPink} pointerEvents="none" />
      <LinearGradient colors={[`${colors.purple}40`, 'transparent']} start={{ x: 1, y: 0.05 }} end={{ x: 0.4, y: 0.6 }} style={styles.glowPurple} pointerEvents="none" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => goBackOrFallback(navigation)} style={styles.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('a11y_back')}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} accessibilityRole="header">
            <Text style={styles.headerTitle} numberOfLines={1}>{t('buddy_title')}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{t('buddy_subtitle')}</Text>
          </View>
          {lastSwipe && activeTab === 'discover' ? (
            <TouchableOpacity onPress={undo} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel={t('buddy_undo')}>
              <Ionicons name="arrow-undo" size={18} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          {activeTab === 'discover' && lookingEvents.length > 0 ? (
            <TouchableOpacity
              onPress={() => setFiltersOpen(true)}
              style={styles.roundBtn}
              accessibilityRole="button"
              accessibilityLabel={activeFilterCount ? t('buddy_filter_a11y_active', { count: activeFilterCount }) : t('buddy_filter_a11y')}
            >
              <Ionicons name="options-outline" size={20} color={colors.text} />
              {activeFilterCount ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.tabs}>
          {tabs.map(([key, icon, label, count]) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={active ? icon : `${icon}-outline`} size={15} color={active ? '#fff' : colors.textSecondary} />
                <Text style={[styles.tabText, { color: active ? '#fff' : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
                {count > 0 ? (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && { color: colors.primary }]}>{count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ListSkeletonPage rows={6} avatar="square" />
      ) : activeTab === 'discover' ? renderDiscover()
        : activeTab === 'matches' ? renderMatches()
        : renderConcerts()}

      <BuddyFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        t={t}
        locale={locale}
        events={lookingEvents}
        activeEvent={activeEvent}
        onEvent={setEventFilter}
        genres={genreOptions}
        activeGenres={genreFilter}
        onGenres={setGenreFilter}
        activeCount={activeFilterCount}
        onClear={clearFilters}
      />

      {concert ? (
        <BuddyConcertModal
          event={concert}
          cards={cards}
          matches={matches}
          statusOf={statusOf}
          toggling={toggling}
          t={t}
          locale={locale}
          onClose={() => setConcertId(null)}
          onToggle={toggleLooking}
          onDecide={decide}
          onOpenPerson={setProfileCard}
          onChat={person => afterOverlays(() => openChat(person))}
          onEventPage={id => afterOverlays(() => openEvent(navigation, id))}
        >
          {profileModal}
          {matchModal}
        </BuddyConcertModal>
      ) : (
        <>
          {profileModal}
          {matchModal}
        </>
      )}
      {reportSheet}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    glowPink: { position: 'absolute', top: -40, left: -60, width: 280, height: 320 },
    glowPurple: { position: 'absolute', top: -20, right: -80, width: 300, height: 340 },
    header: { paddingHorizontal: 16, paddingBottom: 12 },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: colors.text, fontFamily: fonts.heading, fontSize: 26 },
    headerSub: { color: colors.textSecondary, fontSize: 13, marginTop: 1 },
    roundBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -3,
      right: -3,
      backgroundColor: colors.primary,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    tabs: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 14,
      padding: 4,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: 12,
    },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
    tabCount: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabCountActive: { backgroundColor: '#fff' },
    tabCountText: { color: colors.text, fontSize: 10, fontWeight: '700' },
    likes: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 6,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: `${colors.primary}1F`,
    },
    likesText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    safety: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: `${colors.accent}55`,
    },
    safetyTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
    safetySub: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
    scrollPad: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
    panel: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 20,
      marginTop: 12,
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    panelIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    panelTitle: { color: colors.text, fontFamily: fonts.headingBold, fontSize: 20, textAlign: 'center' },
    panelSub: { color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    panelBtn: { alignSelf: 'stretch', marginTop: 18 },
    panelActions: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
    primaryBtn: {
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 14,
    },
    primaryBtnText: { color: '#fff', fontFamily: fonts.headingBold, fontSize: 15 },
    outlineBtn: {
      width: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    undoLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
    undoLinkText: { color: colors.secondary, fontWeight: '600' },
    sectionTitle: { color: colors.text, fontFamily: fonts.headingBold, fontSize: 17, marginTop: 14 },
    avatar: { backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    avatarLetter: { color: '#fff', fontFamily: fonts.headingBold },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 18,
      backgroundColor: colors.card,
    },
    matchName: { color: colors.text, fontSize: 16, fontWeight: '700' },
    matchPreview: { color: colors.textSecondary, marginTop: 3 },
    matchPreviewNew: { color: colors.text, fontWeight: '600' },
    matchSide: { alignItems: 'flex-end', gap: 6 },
    matchScore: { color: colors.primary, fontFamily: fonts.headingBold },
    newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    moreBtn: { padding: 4 },
    concertsHint: { color: colors.textSecondary, lineHeight: 19, marginBottom: 4 },
    concertCard: {
      height: 196,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    concertCardOn: { borderColor: colors.primary },
    concertBody: { flex: 1, justifyContent: 'flex-end', padding: 16 },
    concertDate: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
    concertArtist: { color: onPhoto.text, fontFamily: fonts.heading, fontSize: 24 },
    concertMeta: { color: onPhoto.muted },
    concertFooter: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    concertCount: { color: onPhoto.text, fontSize: 13, fontWeight: '600', flex: 1 },
  });
}
