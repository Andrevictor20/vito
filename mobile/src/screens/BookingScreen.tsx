import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  BackHandler,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { BookingType, BookingAppointment, CreateBookingTypeInput } from '../types';

const TIME_PRESETS = [
  { label: '09h às 18h', start: '09:00', end: '18:00' },
  { label: '08h às 12h', start: '08:00', end: '12:00' },
  { label: '13h às 18h', start: '13:00', end: '18:00' },
  { label: '08h às 20h', start: '08:00', end: '20:00' },
];

const AVAILABLE_HOURS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

let ClipboardModule: any = null;
try {
  ClipboardModule = require('expo-clipboard');
} catch (e) {
  ClipboardModule = null;
}

const sanitizeBookingUrl = (raw?: string, slug?: string): string => {
  const cleanSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : '';
  const canonicalFallback = cleanSlug ? `https://vito.rasppi.cloud/book/${cleanSlug}` : 'https://vito.rasppi.cloud/book';
  if (!raw || !raw.trim()) return canonicalFallback;
  return raw;
};

const calculateAutoEndHour = (
  selectedStart: string,
  currentStart: string,
  currentEnd: string,
  durationMin: number = 30
): string => {
  const parseMin = (t: string) => {
    const [h, m] = (t || '09:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const startMin = parseMin(selectedStart);
  const oldStartMin = parseMin(currentStart);
  const oldEndMin = parseMin(currentEnd);
  const prevWindow = oldEndMin - oldStartMin;

  // Preserva a amplitude da janela de atendimento anterior
  let targetEndMin = startMin + (prevWindow > 0 ? prevWindow : 8 * 60);
  if (targetEndMin > 22 * 60) {
    targetEndMin = 22 * 60;
  }
  if (targetEndMin <= startMin) {
    targetEndMin = Math.min(22 * 60, startMin + Math.max(durationMin, 30));
  }

  const endH = Math.floor(targetEndMin / 60);
  const endM = targetEndMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

interface BookingScreenProps {
  onBack: () => void;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({ onBack }) => {
  const { colors, isDark } = useTheme();

  const [types, setTypes] = useState<BookingType[]>([]);
  const [appointments, setAppointments] = useState<BookingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'appointments'>('links');

  // Feedback de cópia por item
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Modal de Criação / Edição de Link
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingType, setEditingType] = useState<BookingType | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newBuffer, setNewBuffer] = useState(10);
  const [newStartHour, setNewStartHour] = useState('09:00');
  const [newEndHour, setNewEndHour] = useState('18:00');
  const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null);

  const handleDeleteAppointment = async (appt: BookingAppointment) => {
    hapticFeedback.medium();
    try {
      setDeletingAppointmentId(appt.id);
      await api.deleteBookingAppointment(appt.id);
      hapticFeedback.success();
      setAppointments((prev) => prev.filter((a) => a.id !== appt.id));
    } catch (err: any) {
      console.warn('[BookingScreen] Falha ao cancelar agendamento:', err);
    } finally {
      setDeletingAppointmentId(null);
    }
  };

  // Intercepta botão voltar do hardware no Android
  useEffect(() => {
    const onBackPress = () => {
      if (timePickerTarget) {
        setTimePickerTarget(null);
        return true;
      }
      if (createModalVisible) {
        setCreateModalVisible(false);
        setEditingType(null);
        return true;
      }
      onBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [timePickerTarget, createModalVisible, onBack]);

  const loadData = useCallback(async () => {
    try {
      const [typesData, apptsData] = await Promise.all([
        api.getBookingTypes().catch(() => []),
        api.getBookingAppointments().catch(() => []),
      ]);
      setTypes(Array.isArray(typesData) ? typesData : []);
      setAppointments(Array.isArray(apptsData) ? apptsData : []);
    } catch (err) {
      console.error('[BookingScreen] erro ao carregar:', err);
      setTypes([]);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Copia link para área de transferência
  const handleCopyLink = async (bt: BookingType) => {
    hapticFeedback.medium();
    const url = sanitizeBookingUrl(bt.short_url || bt.public_url, bt.slug);
    if (!url) return;

    if (ClipboardModule && ClipboardModule.setStringAsync) {
      await ClipboardModule.setStringAsync(url);
    } else {
      // Fallback via Share
      try {
        await Share.share({ message: url, url });
      } catch (e) {
        // ignore
      }
    }

    setCopiedSlug(bt.slug);
    hapticFeedback.light();
    setTimeout(() => {
      setCopiedSlug(null);
    }, 2000);
  };

  // Alterna status ativo/inativo
  const handleToggleActive = async (bt: BookingType) => {
    hapticFeedback.selection();
    const nextState = !bt.is_active;
    setTypes((prev) =>
      prev.map((item) => (item.id === bt.id ? { ...item, is_active: nextState } : item))
    );
    try {
      await api.updateBookingType(bt.id, { is_active: nextState });
    } catch (err) {
      // Reverte em caso de erro
      setTypes((prev) =>
        prev.map((item) => (item.id === bt.id ? { ...item, is_active: bt.is_active } : item))
      );
    }
  };

  // Remove tipo de agendamento
  const handleDeleteType = async (id: string) => {
    hapticFeedback.medium();
    setTypes((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.deleteBookingType(id);
    } catch (err) {
      loadData();
    }
  };

  // Abre modal para criação de novo link
  const handleOpenCreate = () => {
    hapticFeedback.medium();
    setEditingType(null);
    setNewTitle('');
    setNewSlug('');
    setNewDescription('');
    setNewDuration(30);
    setNewBuffer(10);
    setNewStartHour('09:00');
    setNewEndHour('18:00');
    setCreateModalVisible(true);
  };

  // Abre modal para edição de link existente
  const handleOpenEdit = (bt: BookingType) => {
    hapticFeedback.light();
    setEditingType(bt);
    setNewTitle(bt.title);
    setNewSlug(bt.slug);
    setNewDescription(bt.description || '');
    setNewDuration(bt.duration_minutes || 30);
    setNewBuffer(bt.buffer_minutes ?? 10);
    setNewStartHour(bt.start_hour || '09:00');
    setNewEndHour(bt.end_hour || '18:00');
    setCreateModalVisible(true);
  };

  // Cria ou atualiza tipo de agendamento
  const handleModalSubmit = async () => {
    if (!newTitle.trim() || !newSlug.trim()) {
      return;
    }
    hapticFeedback.medium();
    setIsSubmitting(true);
    try {
      const payload: CreateBookingTypeInput = {
        title: newTitle.trim(),
        slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: newDescription.trim() || undefined,
        duration_minutes: newDuration,
        buffer_minutes: newBuffer,
        start_hour: newStartHour,
        end_hour: newEndHour,
        days_of_week: editingType?.days_of_week || '[1,2,3,4,5]',
      };

      if (editingType) {
        const updated = await api.updateBookingType(editingType.id, payload);
        setTypes((prev) =>
          (prev || []).map((item) => (item.id === editingType.id ? { ...item, ...updated } : item))
        );
      } else {
        const created = await api.createBookingType(payload);
        setTypes((prev) => [...(prev || []), created]);
      }

      setCreateModalVisible(false);
      setEditingType(null);
      setNewTitle('');
      setNewSlug('');
      setNewDescription('');
      hapticFeedback.success();
    } catch (err) {
      console.error('[BookingScreen] erro ao salvar link:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoGenerateSlug = (titleText: string) => {
    setNewTitle(titleText);
    const generated = titleText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setNewSlug(generated);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header Fixo 50dp */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity
          onPress={() => {
            hapticFeedback.light();
            onBack();
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]} numberOfLines={1}>
            Vito Booking
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>
            Links de Agendamento Executivos
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleOpenCreate}
          style={[styles.createHeaderBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {/* Segmented Tabs (Links vs Agendamentos) */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surfaceVariant }]}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'links' && [styles.tabButtonActive, { backgroundColor: colors.surface }],
          ]}
          onPress={() => {
            hapticFeedback.selection();
            setActiveTab('links');
          }}
        >
          <MaterialIcons
            name="link"
            size={18}
            color={activeTab === 'links' ? colors.primary : colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'links' ? colors.onSurface : colors.onSurfaceVariant },
              activeTab === 'links' && styles.tabTextActive,
            ]}
          >
            Links ({(types || []).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'appointments' && [styles.tabButtonActive, { backgroundColor: colors.surface }],
          ]}
          onPress={() => {
            hapticFeedback.selection();
            setActiveTab('appointments');
          }}
        >
          <MaterialIcons
            name="event-available"
            size={18}
            color={activeTab === 'appointments' ? colors.primary : colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'appointments' ? colors.onSurface : colors.onSurfaceVariant },
              activeTab === 'appointments' && styles.tabTextActive,
            ]}
          >
            Recebidos ({(appointments || []).length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {activeTab === 'links' ? (
            (types || []).length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
                  <MaterialIcons name="link-off" size={32} color={colors.onSurfaceVariant} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  Nenhum link configurado
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                  Crie links personalizados com janelas de atendimento para que convidados agendem reuniões respeitando sua agenda.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
                  onPress={handleOpenCreate}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add" size={20} color={colors.onPrimary} />
                  <Text style={[styles.emptyActionText, { color: colors.onPrimary }]}>
                    Criar Primeiro Link
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardsList}>
                {(types || []).map((bt) => {
                  const isCopied = copiedSlug === bt.slug;
                  return (
                    <View
                      key={bt.id}
                      style={[
                        styles.linkCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.outlineVariant,
                          opacity: bt.is_active ? 1 : 0.65,
                        },
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleBlock}>
                          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                            {bt.title}
                          </Text>
                          {bt.description ? (
                            <Text style={[styles.cardDescription, { color: colors.onSurfaceVariant }]}>
                              {bt.description}
                            </Text>
                          ) : null}
                        </View>

                        <TouchableOpacity
                          onPress={() => handleToggleActive(bt)}
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: bt.is_active
                                ? (isDark ? 'rgba(79, 216, 235, 0.15)' : 'rgba(0, 104, 116, 0.1)')
                                : colors.surfaceVariant,
                            },
                          ]}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: bt.is_active ? colors.primary : colors.outline },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              { color: bt.is_active ? colors.primary : colors.onSurfaceVariant },
                            ]}
                          >
                            {bt.is_active ? 'Ativo' : 'Pausado'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Badges de Regras */}
                      <View style={styles.badgesRow}>
                        <View style={[styles.badgeItem, { backgroundColor: colors.surfaceVariant }]}>
                          <MaterialIcons name="schedule" size={14} color={colors.onSurfaceVariant} />
                          <Text style={[styles.badgeText, { color: colors.onSurfaceVariant }, tabularNumbers]}>
                            {bt.duration_minutes} min
                          </Text>
                        </View>

                        <View style={[styles.badgeItem, { backgroundColor: colors.surfaceVariant }]}>
                          <MaterialIcons name="hourglass-empty" size={14} color={colors.onSurfaceVariant} />
                          <Text style={[styles.badgeText, { color: colors.onSurfaceVariant }, tabularNumbers]}>
                            Respiro {bt.buffer_minutes}m
                          </Text>
                        </View>

                        <View style={[styles.badgeItem, { backgroundColor: colors.surfaceVariant }]}>
                          <MaterialIcons name="access-time" size={14} color={colors.onSurfaceVariant} />
                          <Text style={[styles.badgeText, { color: colors.onSurfaceVariant }, tabularNumbers]}>
                            {bt.start_hour} às {bt.end_hour}
                          </Text>
                        </View>
                      </View>

                      {/* URL Box & Copiar */}
                      <View style={[styles.urlBox, { backgroundColor: colors.surfaceVariant }]}>
                        <Text
                          style={[styles.urlText, { color: colors.onSurfaceVariant }]}
                          numberOfLines={1}
                        >
                          {sanitizeBookingUrl(bt.short_url || bt.public_url, bt.slug)}
                        </Text>
                      </View>

                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          style={[
                            styles.copyButton,
                            {
                              backgroundColor: isCopied ? '#2e7d32' : colors.primary,
                            },
                          ]}
                          onPress={() => handleCopyLink(bt)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons
                            name={isCopied ? 'check' : 'content-copy'}
                            size={16}
                            color={isCopied ? '#FFFFFF' : colors.onPrimary}
                          />
                          <Text
                            style={[
                              styles.copyButtonText,
                              { color: isCopied ? '#FFFFFF' : colors.onPrimary },
                            ]}
                          >
                            {isCopied ? 'Link Copiado!' : 'Copiar Link'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.editButton, { borderColor: colors.outlineVariant }]}
                          onPress={() => handleOpenEdit(bt)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="edit" size={16} color={colors.onSurface} />
                          <Text style={[styles.editButtonText, { color: colors.onSurface }]}>
                            Editar
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.deleteButton, { borderColor: colors.outlineVariant }]}
                          onPress={() => handleDeleteType(bt.id)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )
          ) : (appointments || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialIcons name="event-busy" size={32} color={colors.onSurfaceVariant} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                Nenhum agendamento recebido
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.onSurfaceVariant }]}>
                Compartilhe seus links de booking para receber reuniões diretamente sincronizadas com sua agenda.
              </Text>
            </View>
          ) : (
            <View style={styles.cardsList}>
              {(appointments || []).map((appt) => {
                const dateObj = new Date(appt.start_at);
                const dateFormatted = dateObj.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                const timeFormatted = dateObj.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <View
                    key={appt.id}
                    style={[
                      styles.apptCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                  >
                    <View style={styles.apptTopRow}>
                      <View style={styles.apptGuestInfo}>
                        <Text style={[styles.guestName, { color: colors.onSurface }]}>
                          {appt.guest_name}
                        </Text>
                        <Text style={[styles.guestEmail, { color: colors.onSurfaceVariant }]}>
                          {appt.guest_email}
                        </Text>
                      </View>
                      <View style={[styles.confirmedPill, { backgroundColor: 'rgba(46, 125, 50, 0.12)' }]}>
                        <Text style={[styles.confirmedPillText, { color: '#2e7d32' }]}>
                          Confirmado
                        </Text>
                      </View>
                    </View>

                    <View style={styles.apptMetaRow}>
                      <View style={styles.apptMetaItem}>
                        <MaterialIcons name="event" size={16} color={colors.primary} />
                        <Text style={[styles.apptMetaText, { color: colors.onSurface }, tabularNumbers]}>
                          {dateFormatted}
                        </Text>
                      </View>
                      <View style={styles.apptMetaItem}>
                        <MaterialIcons name="schedule" size={16} color={colors.primary} />
                        <Text style={[styles.apptMetaText, { color: colors.onSurface }, tabularNumbers]}>
                          {timeFormatted}
                        </Text>
                      </View>
                    </View>

                    {appt.guest_notes ? (
                      <View style={[styles.notesBox, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={[styles.notesText, { color: colors.onSurfaceVariant }]}>
                          "{appt.guest_notes}"
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.apptActionsRow}>
                      <TouchableOpacity
                        style={[styles.cancelApptButton, { borderColor: colors.outlineVariant }]}
                        onPress={() => handleDeleteAppointment(appt)}
                        disabled={deletingAppointmentId === appt.id}
                        activeOpacity={0.7}
                      >
                        {deletingAppointmentId === appt.id ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <>
                            <MaterialIcons name="event-busy" size={16} color={colors.error} />
                            <Text style={[styles.cancelApptButtonText, { color: colors.error }]}>
                              Cancelar e Liberar Horário
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal de Criação / Edição de Link de Booking */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCreateModalVisible(false);
          setEditingType(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setCreateModalVisible(false);
              setEditingType(null);
            }}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBlock}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                  {editingType ? 'Editar Link de Agendamento' : 'Novo Link de Agendamento'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.onSurfaceVariant }]}>
                  {editingType
                    ? 'Ajuste regras, horários e duração do link'
                    : 'Configure janelas e regras para convidados'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setCreateModalVisible(false);
                  setEditingType(null);
                }}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Título da Reunião *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: colors.surfaceVariant,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  placeholder="Ex: Reunião de 30 min, Alinhamento"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={newTitle}
                  onChangeText={editingType ? setNewTitle : autoGenerateSlug}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Slug do Link (URL) *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: colors.surfaceVariant,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  placeholder="reuniao-30m"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={newSlug}
                  onChangeText={(val) => setNewSlug(val.toLowerCase())}
                  autoCapitalize="none"
                />

                {/* Prévia Instantânea do Link Público */}
                <View
                  style={[
                    styles.linkPreviewBox,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.linkPreviewHeader}>
                    <MaterialIcons name="link" size={14} color={colors.primary} />
                    <Text style={[styles.linkPreviewLabel, { color: colors.onSurfaceVariant }]}>
                      Prévia do link:
                    </Text>
                  </View>
                  <Text
                    style={[styles.linkPreviewUrl, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {`https://vito.rasppi.cloud/book/${newSlug ? newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'seu-link'}`}
                  </Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Descrição (Opcional)</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: colors.surfaceVariant,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  placeholder="Contexto da reunião ou pauta breve"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={newDescription}
                  onChangeText={setNewDescription}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Duração (minutos)</Text>
                <View style={styles.pillSelectorRow}>
                  {[15, 30, 45, 60].map((dur) => (
                    <TouchableOpacity
                      key={dur}
                      style={[
                        styles.pillOption,
                        newDuration === dur && [styles.pillOptionActive, { backgroundColor: colors.primary }],
                        { borderColor: colors.outlineVariant },
                      ]}
                      onPress={() => setNewDuration(dur)}
                    >
                      <Text
                        style={[
                          styles.pillOptionText,
                          { color: newDuration === dur ? colors.onPrimary : colors.onSurface },
                        ]}
                      >
                        {dur} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Buffer de Respiro (minutos)</Text>
                <View style={styles.pillSelectorRow}>
                  {[0, 10, 15, 20].map((buf) => (
                    <TouchableOpacity
                      key={buf}
                      style={[
                        styles.pillOption,
                        newBuffer === buf && [styles.pillOptionActive, { backgroundColor: colors.primary }],
                        { borderColor: colors.outlineVariant },
                      ]}
                      onPress={() => setNewBuffer(buf)}
                    >
                      <Text
                        style={[
                          styles.pillOptionText,
                          { color: newBuffer === buf ? colors.onPrimary : colors.onSurface },
                        ]}
                      >
                        {buf === 0 ? 'Sem buffer' : `${buf} min`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Horários de Atendimento com Presets e Seletores Táteis */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Horário de Atendimento</Text>

                {/* Presets Rápidos */}
                <View style={styles.timePresetsContainer}>
                  {TIME_PRESETS.map((p) => {
                    const isSelected = newStartHour === p.start && newEndHour === p.end;
                    return (
                      <TouchableOpacity
                        key={p.label}
                        style={[
                          styles.timePresetChip,
                          {
                            borderColor: isSelected ? colors.primary : colors.outlineVariant,
                            backgroundColor: isSelected
                              ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)')
                              : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setNewStartHour(p.start);
                          setNewEndHour(p.end);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.timePresetChipText,
                            { color: isSelected ? colors.primary : colors.onSurfaceVariant },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Seletores Táteis de Início e Fim */}
                <View style={styles.timeSelectorsRow}>
                  <TouchableOpacity
                    style={[
                      styles.timeSelectorButton,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => {
                      hapticFeedback.light();
                      setTimePickerTarget('start');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.timeSelectorLabel, { color: colors.onSurfaceVariant }]}>
                      Início
                    </Text>
                    <View style={styles.timeSelectorValueRow}>
                      <MaterialIcons name="access-time" size={16} color={colors.primary} />
                      <Text style={[styles.timeSelectorValue, { color: colors.onSurface }, tabularNumbers]}>
                        {newStartHour}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={18} color={colors.onSurfaceVariant} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.timeSelectorButton,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => {
                      hapticFeedback.light();
                      setTimePickerTarget('end');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.timeSelectorLabel, { color: colors.onSurfaceVariant }]}>
                      Fim
                    </Text>
                    <View style={styles.timeSelectorValueRow}>
                      <MaterialIcons name="access-time" size={16} color={colors.primary} />
                      <Text style={[styles.timeSelectorValue, { color: colors.onSurface }, tabularNumbers]}>
                        {newEndHour}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={18} color={colors.onSurfaceVariant} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitModalBtn,
                  { backgroundColor: colors.primary, opacity: isSubmitting ? 0.6 : 1 },
                ]}
                onPress={handleModalSubmit}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.submitModalText, { color: colors.onPrimary }]}>
                    {editingType ? 'Salvar Alterações' : 'Salvar e Criar Link'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Seletor Rápido de Horário (Início ou Fim) */}
      <Modal
        visible={timePickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <View style={styles.pickerModalOverlay}>
          <TouchableOpacity
            style={styles.pickerModalBackdrop}
            activeOpacity={1}
            onPress={() => setTimePickerTarget(null)}
          />
          <View style={[styles.pickerModalContent, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
            <View style={styles.pickerModalHeader}>
              <View style={styles.pickerModalTitleRow}>
                <MaterialIcons name="schedule" size={20} color={colors.primary} />
                <Text style={[styles.pickerModalTitle, { color: colors.onSurface }]}>
                  {timePickerTarget === 'start' ? 'Horário de Início' : 'Horário de Término'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTimePickerTarget(null)}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.pickerScrollView}
              contentContainerStyle={styles.pickerGrid}
              showsVerticalScrollIndicator={false}
            >
              {AVAILABLE_HOURS.map((hour) => {
                const isCurrent = (timePickerTarget === 'start' ? newStartHour : newEndHour) === hour;
                return (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.hourGridItem,
                      {
                        borderColor: isCurrent ? colors.primary : colors.outlineVariant,
                        backgroundColor: isCurrent ? colors.primary : colors.surfaceVariant,
                      },
                    ]}
                    onPress={() => {
                      hapticFeedback.selection();
                      if (timePickerTarget === 'start') {
                        setNewStartHour(hour);
                        const autoEnd = calculateAutoEndHour(hour, newStartHour, newEndHour, newDuration);
                        setNewEndHour(autoEnd);
                      } else {
                        setNewEndHour(hour);
                      }
                      setTimePickerTarget(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.hourGridItemText,
                        { color: isCurrent ? colors.onPrimary : colors.onSurface },
                        isCurrent && { fontWeight: '700' },
                        tabularNumbers,
                      ]}
                    >
                      {hour}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  createHeaderBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 4,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardsList: {
    gap: 14,
  },
  linkCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitleBlock: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  urlBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  urlText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apptCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  apptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  apptGuestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  guestEmail: {
    fontSize: 12,
  },
  confirmedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  confirmedPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  apptMetaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  apptMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  apptMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalCloseBtn: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  formInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  pillSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillOption: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOptionActive: {
    borderColor: 'transparent',
  },
  pillOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitModalBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitModalText: {
    fontSize: 15,
    fontWeight: '700',
  },
  linkPreviewBox: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  linkPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  linkPreviewLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  linkPreviewUrl: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timePresetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  timePresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  timePresetChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  timeSelectorsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeSelectorButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeSelectorLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  timeSelectorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSelectorValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerScrollView: {
    maxHeight: 320,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  hourGridItem: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourGridItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  apptActionsRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelApptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
  },
  cancelApptButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
