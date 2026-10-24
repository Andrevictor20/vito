import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { MainTabType } from '../../utils/pagerNavigation';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type HeaderRoundButtonVariant = 'default' | 'primary';

export interface HeaderRoundButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: HeaderRoundButtonVariant;
  size?: number;
  testID?: string;
  disabled?: boolean;
}

/**
 * Botão circular (.rb) de 42x42px fiel a vito-telas.html.
 * - variant 'default': fundo colors.bg, borda 1px colors.line, ícone colors.ink.
 * - variant 'primary' (.rb.pri): fundo colors.ink, borda colors.ink, ícone colors.bg.
 */
export const HeaderRoundButton: React.FC<HeaderRoundButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  size = 20,
  testID,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const isPri = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.roundBtn,
        {
          backgroundColor: isPri ? colors.ink : colors.bg,
          borderColor: isPri ? colors.ink : colors.line,
        },
        disabled && styles.btnDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={tokens.hitSlop.sm}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
    >
      <MaterialIcons
        name={icon}
        size={size}
        color={isPri ? colors.bg : colors.ink}
      />
    </TouchableOpacity>
  );
};

export interface HeaderIconButtonProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

/**
 * Botão auxiliar retrocompatível mapeado para o design .rb circular.
 */
export const HeaderIconButton: React.FC<HeaderIconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  size = 20,
}) => {
  return (
    <HeaderRoundButton
      icon={icon}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      size={size}
      variant="default"
    />
  );
};

/** Pill de ação do header editorial (sólida primária ou ghost discreta). */
export interface HeaderPillProps {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'solid' | 'ghost';
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export const HeaderPill: React.FC<HeaderPillProps> = ({
  label,
  onPress,
  accessibilityLabel,
  variant = 'solid',
  icon,
}) => {
  const { colors } = useTheme();
  const ghost = variant === 'ghost';
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        ghost
          ? { backgroundColor: colors.bg, borderColor: colors.line, borderWidth: 1 }
          : { backgroundColor: colors.ink, borderColor: colors.ink, borderWidth: 1 },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={tokens.hitSlop.md}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {icon ? (
        <MaterialIcons
          name={icon}
          size={16}
          color={ghost ? colors.ink : colors.bg}
        />
      ) : null}
      <Text
        style={[
          styles.pillText,
          { color: ghost ? colors.ink : colors.bg },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const TAB_TITLES: Record<MainTabType, { title: string; subtitle: string }> = {
  chat: { title: 'Vito', subtitle: '' },
  calendar: { title: 'Agenda', subtitle: '' },
  tasks: { title: 'Tarefas', subtitle: '' },
  triggers: { title: 'Radares', subtitle: 'O Vito vigia por você' },
  booking: { title: 'Booking', subtitle: 'Links de agendamento do Vito' },
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
  /** Abre a gaveta lateral (hamburger à esquerda). */
  onPressMenu?: () => void;
  /** Oculta título/subtítulo (visual clean, ex. chat). */
  hideTitle?: boolean;
  /** Alinhamento do título. Default 'left' conforme vito-telas.html. */
  align?: 'left' | 'center';

  // Barra de busca retrátil (.search)
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
  const { colors } = useTheme();
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

  const handleClearQuery = () => {
    handleQueryChange('');
  };

  const currentQuery = searchQuery !== undefined ? searchQuery : internalQuery;

  const resolved = activeTab ? TAB_TITLES[activeTab] : undefined;
  const displayTitle = hideTitle ? null : (title ?? resolved?.title ?? 'Agenda');
  const displaySubtitle: string | null = hideTitle
    ? null
    : (subtitle ?? resolved?.subtitle ?? null) || null;

  const isChat = activeTab === 'chat';
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
          backgroundColor: colors.bg,
          borderBottomColor: colors.line,
          borderBottomWidth: showDivider ? 1 : 0,
        },
      ]}
      accessibilityRole="header"
    >
      <View style={[styles.head, centered && styles.headCentered]}>
        {hasLeft ? (
          <View style={styles.leftSlot}>
            <HeaderRoundButton
              icon="menu"
              onPress={onPressMenu}
              accessibilityLabel="Abrir histórico de conversas"
              size={22}
            />
          </View>
        ) : null}

        {displayTitle ? (
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
          {isChat && onPressNewChat ? (
            <HeaderRoundButton
              icon="add"
              onPress={onPressNewChat}
              accessibilityLabel="Nova conversa"
              variant="default"
              size={20}
            />
          ) : null}
          {contextualActions}
        </View>
      </View>

      {/* Barra de busca retrátil (.search) */}
      {isSearching && (
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surf,
                borderColor: colors.line,
              },
            ]}
          >
            <MaterialIcons name="search" size={20} color={colors.muted} />
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
                onPress={handleClearQuery}
                hitSlop={tokens.hitSlop.sm}
                accessibilityLabel="Limpar busca"
                accessibilityRole="button"
              >
                <MaterialIcons name="close" size={18} color={colors.muted} />
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
                <MaterialIcons
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
    paddingTop: 12,
    paddingBottom: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headCentered: {
    alignItems: 'center',
  },
  leftSlot: {
    marginRight: 6,
    justifyContent: 'center',
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
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.9,
    fontWeight: '800',
  },
  titleCenter: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '500',
  },
  subtitleCenter: {
    textAlign: 'center',
  },
  acts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexShrink: 0,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 21,
    height: 42,
    paddingHorizontal: 16,
    gap: 6,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
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
    fontSize: 15,
    paddingVertical: 0,
  },
  filterTuneBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
