import React, { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { tokens } from '../../theme/tokens';
import { getFloatingSurfaceShadow } from '../../theme/surfaces';
import { PressableScale } from '../../theme/vitoMotion';
import { useTheme } from '../../context/ThemeContext';
import { tabNavigationBus } from '../../services/dataSync';
import type { MainTabType } from '../../utils/navigation/pagerNavigation';
import {
  HeaderIconButton,
  HeaderPill,
  HeaderRoundButton,
  SubScreenHeader,
  type HeaderIconButtonProps,
  type HeaderPillProps,
  type HeaderRoundButtonProps,
  type HeaderRoundButtonVariant,
  type SubScreenHeaderProps,
} from './HeaderControls';

export {
  HeaderIconButton,
  HeaderPill,
  HeaderRoundButton,
  SubScreenHeader,
  type HeaderIconButtonProps,
  type HeaderPillProps,
  type HeaderRoundButtonProps,
  type HeaderRoundButtonVariant,
  type SubScreenHeaderProps,
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_TITLES: Record<MainTabType, { title: string; subtitle: string }> = {
  chat: { title: 'Conversas', subtitle: '' },
  calendar: { title: 'Agenda', subtitle: '' },
  tasks: { title: 'Tarefas', subtitle: '' },
  finance: { title: 'Finanças', subtitle: '' },
  triggers: { title: 'Bots', subtitle: 'Mini assistentes, cada um com uma função só' },
  booking: { title: 'Agendamentos', subtitle: 'Links e votações de horário' },
  profile: { title: 'Perfil', subtitle: 'Conta, autonomia e integrações' },
};

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  showDivider?: boolean;
  contextualActions?: React.ReactNode;
  onPressTitle?: () => void;
  activeTab?: MainTabType;
  onPressNewChat?: () => void;
  onPressMenu?: () => void;
  onPressNotifications?: () => void;
  unreadNotificationsCount?: number;
  onPressProfile?: () => void;
  profileInitials?: string;
  onPressBooking?: () => void;
  hideTitle?: boolean;
  align?: 'left' | 'center';
  showSearchButton?: boolean;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
  onPressFilter?: () => void;
  hasActiveFilters?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showDivider = false,
  contextualActions,
  onPressTitle,
  activeTab,
  onPressMenu,
  onPressNotifications,
  unreadNotificationsCount = 0,
  onPressProfile,
  profileInitials = 'AV',
  onPressBooking,
  hideTitle = false,
  align = 'left',
  onPressNewChat,
  showSearchButton,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  onPressFilter,
  hasActiveFilters = false,
}) => {
  const { colors, isDark } = useTheme();
  const [internalSearchOpen, setInternalSearchOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState('');

  const isSearchControlled = searchOpen !== undefined;
  const isSearching = isSearchControlled ? searchOpen : internalSearchOpen;

  const handleToggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (onToggleSearch) {
      onToggleSearch();
    } else {
      setInternalSearchOpen((prev) => !prev);
    }
  };

  const handleQueryChange = (text: string) => {
    if (onSearchChange) {
      onSearchChange(text);
    } else {
      setInternalQuery(text);
    }
  };

  const currentQuery = searchQuery !== undefined ? searchQuery : internalQuery;
  const resolved = activeTab ? TAB_TITLES[activeTab] : undefined;
  const isChat = activeTab === 'chat';
  const isCalendar = activeTab === 'calendar';

  const displayTitle = hideTitle ? null : (title ?? resolved?.title ?? 'Agenda');
  const displaySubtitle: string | null = hideTitle
    ? null
    : (subtitle ?? resolved?.subtitle ?? null) || null;
  const centered = align === 'center';
  const hasLeft = !!onPressMenu;

  const shouldRenderSearchButton =
    showSearchButton !== undefined
      ? showSearchButton
      : !!onSearchChange || !!onPressFilter;

  const titleBlock = displayTitle ? (
    <View style={styles.titleContainer}>
      <Text
        style={[
          styles.h1Title,
          centered && styles.titleCenter,
          { color: colors.ink },
        ]}
        numberOfLines={1}
      >
        {displayTitle}
      </Text>
      {displaySubtitle ? (
        <Text
          style={[
            styles.subtitle,
            centered && styles.subtitleCenter,
            { color: colors.muted },
          ]}
          numberOfLines={2}
        >
          {displaySubtitle}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View
      style={[
        styles.headerWrapper,
        {
          backgroundColor: colors.headerGlass,
          borderBottomColor: colors.hairline,
          borderBottomWidth: showDivider ? 1 : 0,
        },
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            } as Record<string, string>)
          : null,
      ]}
      accessibilityRole="header"
    >
      <View style={[styles.head, centered && styles.headCentered]}>
        {hasLeft ? (
          <View style={styles.leftSlot}>
            <HeaderRoundButton
              icon="menu"
              onPress={onPressMenu}
              accessibilityLabel="Conversas"
              size={22}
              testID="c-menu"
            />
          </View>
        ) : null}

        {isChat ? (
          <View style={styles.flexEmpty} />
        ) : displayTitle ? (
          <View style={[styles.titleSlot, centered && styles.titleSlotCenter]}>
            {onPressTitle ? (
              <TouchableOpacity
                onPress={onPressTitle}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                {titleBlock}
              </TouchableOpacity>
            ) : (
              titleBlock
            )}
          </View>
        ) : (
          <View style={styles.flexEmpty} />
        )}

        <View style={styles.acts}>
          {shouldRenderSearchButton && (
            <HeaderRoundButton
              icon="search"
              onPress={handleToggleSearch}
              accessibilityLabel={isSearching ? 'Fechar busca' : 'Buscar'}
              variant={isSearching ? 'primary' : 'default'}
              size={20}
            />
          )}

          {isCalendar && (
            <HeaderRoundButton
              icon="link"
              onPress={onPressBooking ?? (() => tabNavigationBus.notify('booking'))}
              accessibilityLabel="Links de agendamento"
              variant="default"
              size={20}
              testID="open-book"
            />
          )}

          {isChat && onPressNotifications && (
            <HeaderRoundButton
              icon="notifications-none"
              onPress={onPressNotifications}
              accessibilityLabel="Notificações"
              variant="default"
              size={20}
              badgeCount={unreadNotificationsCount}
              testID="c-notifs"
            />
          )}

          {isChat && onPressNewChat ? (
            <HeaderRoundButton
              icon="add"
              onPress={onPressNewChat}
              accessibilityLabel="Nova conversa"
              variant="default"
              size={20}
              testID="c-new"
            />
          ) : null}

          {isChat && onPressProfile && (
            <PressableScale
              onPress={onPressProfile}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Perfil e configurações"
              accessibilityRole="button"
              testID="go-perfil"
              style={[
                styles.avatarBtn,
                getFloatingSurfaceShadow(isDark),
                {
                  backgroundColor: colors.ink,
                  borderColor: colors.line,
                },
              ]}
            >
              <Text style={[styles.avatarBtnText, { color: colors.bg }]} numberOfLines={1}>
                {profileInitials}
              </Text>
            </PressableScale>
          )}

          {contextualActions}
        </View>
      </View>

      {isSearching && (
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchBar,
              getFloatingSurfaceShadow(isDark),
              {
                backgroundColor: colors.bg,
                borderColor: colors.hairline,
              },
            ]}
          >
            <ProtoUiIcon name="search" size={20} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.ink }]}
              value={currentQuery}
              onChangeText={handleQueryChange}
              placeholder={searchPlaceholder ?? 'Pesquisar...'}
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              accessibilityLabel={searchPlaceholder ?? 'Pesquisar'}
              autoFocus
            />
            {currentQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => handleQueryChange('')}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Limpar busca"
                accessibilityRole="button"
              >
                <ProtoUiIcon name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
            {onPressFilter && (
              <TouchableOpacity
                onPress={onPressFilter}
                style={[
                  styles.filterTuneBtn,
                  hasActiveFilters && { backgroundColor: colors.ink },
                ]}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Filtros avançados"
                accessibilityRole="button"
              >
                <ProtoUiIcon
                  name="tune"
                  size={18}
                  color={hasActiveFilters ? colors.bg : colors.ink}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export const TopAppBar = Header;

const styles = StyleSheet.create({
  headerWrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    zIndex: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headCentered: {
    alignItems: 'center',
  },
  leftSlot: {
    justifyContent: 'center',
  },
  chatTitleSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chatHeaderLabel: {
    fontFamily: 'Geist',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.34,
  },
  titleSlot: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleSlotCenter: {
    alignItems: 'center',
  },
  flexEmpty: {
    flex: 1,
  },
  titleContainer: {
    justifyContent: 'center',
  },
  h1Title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.96,
    fontWeight: '500',
  },
  titleCenter: {
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Geist',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
    fontWeight: '400',
  },
  subtitleCenter: {
    textAlign: 'center',
  },
  acts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnText: {
    fontFamily: 'Geist',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.26,
  },
  searchSection: {
    marginTop: 12,
  },
  searchBar: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: 'Geist',
    fontSize: 15,
    paddingVertical: 0,
  },
  filterTuneBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
