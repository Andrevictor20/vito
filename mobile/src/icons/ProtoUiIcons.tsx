import React from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

export interface UiIconProps {
  size?: number
  color?: string
  style?: StyleProp<ViewStyle>
}

/** Mapa de paths SVG 24x24 geométricos (strokeWidth=2, round) cobrindo ícones de UI nativos do protótipo. */
const PATHS: Record<string, string[]> = {
  'arrow-back': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'arrow-forward': ['M5 12h14', 'M12 5l7 7-7 7'],
  'arrow-outward': ['M7 17L17 7', 'M7 7h10v10'],
  'arrow-upward': ['M12 19V5', 'M5 12l7-7 7 7'],
  'chevron-left': ['M15 18l-6-6 6-6'],
  'chevron-right': ['M9 18l6-6-6-6'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  add: ['M12 5v14', 'M5 12h14'],
  'add-circle-outline': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v8', 'M8 12h8'],
  'add-task': ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  done: ['M5 12.5l4.5 4.5L19 7'],
  'done-all': ['M2 12.5l4.5 4.5L16 7', 'M8 17l4.5-4.5L22 7'],
  'check-circle': ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M9 11l3 3L22 4'],
  'check-circle-outline': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M9 12l2 2 4-4'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  'search-off': ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35', 'M4 4l16 16'],
  'filter-list': ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  'bar-chart': ['M6 19v-6', 'M12 19V5', 'M18 19v-10'],
  tune: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M2 14h4', 'M10 8h4', 'M18 16h4'],
  refresh: ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6'],
  sync: ['M21 12a9 9 0 0 1-15.5 6.3', 'M3 12a9 9 0 0 1 15.5-6.3', 'M21 3v5h-5', 'M3 21v-5h5'],
  repeat: ['M17 1l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 23l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'],
  notifications: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  'notifications-none': ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  visibility: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'visibility-off': ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M1 1l22 22'],
  'delete-outline': ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'],
  'delete-forever': ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11l4 4', 'M14 11l-4 4'],
  'delete-sweep': ['M3 6h14', 'M6 6V4h8v2', 'M15 6l-1 14H6L5 6', 'M18 12h4', 'M18 16h3'],
  edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13'],
  'content-copy': ['M9 9h11v11H9z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  'link-off': ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M2 2l20 20'],
  'open-in-new': ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3'],
  'open-in-full': ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
  lock: ['M5 11h14v10H5z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  'lock-outline': ['M5 11h14v10H5z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  'vpn-key': ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  security: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  'verified-user': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  verified: ['M12 2l2.4 2.4H18v3.6L20.4 10.4 18 12.8V16.4h-3.6L12 18.8l-2.4-2.4H6v-3.6L3.6 10.4 6 8V4.4h3.6L12 2z', 'M9 12l2 2 4-4'],
  'privacy-tip': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M12 8v4', 'M12 16h.01'],
  'info-outline': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  'help-outline': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  'error-outline': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v4', 'M12 16h.01'],
  warning: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  'warning-amber': ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  'priority-high': ['M12 4v10', 'M12 19h.01'],
  'calendar-today': ['M3 5h18v16H3z', 'M8 3v4', 'M16 3v4', 'M3 10h18'],
  'calendar-month': ['M3 5h18v16H3z', 'M8 3v4', 'M16 3v4', 'M3 10h18', 'M8 14h2', 'M14 14h2'],
  event: ['M3 5h18v16H3z', 'M8 3v4', 'M16 3v4', 'M3 10h18', 'M12 14h4v4h-4z'],
  'event-available': ['M3 5h18v16H3z', 'M8 3v4', 'M16 3v4', 'M3 10h18', 'M9 15l2 2 4-4'],
  'event-busy': ['M3 5h18v16H3z', 'M8 3v4', 'M16 3v4', 'M3 10h18', 'M10 14l4 4', 'M14 14l-4 4'],
  schedule: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
  timer: ['M12 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 9v5l3 2', 'M9 2h6'],
  history: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  'credit-card': ['M2 5h20v14H2z', 'M2 10h20'],
  'account-balance': ['M3 21h18', 'M3 10h18', 'M5 6l7-4 7 4', 'M6 10v8', 'M10 10v8', 'M14 10v8', 'M18 10v8'],
  'account-balance-wallet': ['M3 6a2 2 0 0 1 2-2h14v4', 'M3 6v12a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z', 'M17 14h.01'],
  savings: ['M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z', 'M13 11h.01'],
  sell: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
  directions: ['M12 2l10 10-10 10L2 12z', 'M9 14v-3h5', 'M12 9l2 2-2 2'],
  summarize: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h6'],
  'view-kanban': ['M3 4h18v16H3z', 'M9 4v16', 'M15 4v16', 'M6 8v5', 'M12 8v8', 'M18 8v3'],
  'edit-note': ['M3 6h12', 'M3 10h12', 'M3 14h8', 'M17 11l3 3-6 6H11v-3z'],
  'notifications-active': ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0', 'M2 8c0-2.2.7-4.3 2-6', 'M22 8a10 10 0 0 0-2-6'],
  'event-note': ['M3 5h18v16H3z', 'M8 3v4', 'M16 3v4', 'M3 10h18', 'M7 14h6', 'M7 17h4'],
  'check-box': ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M8 12l3 3 5-6'],
  receipt: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  'receipt-long': ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
  'trending-up': ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  insights: ['M3 17l6-6 4 4 8-8', 'M17 7h4v4'],
  'auto-awesome': ['M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z', 'M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'],
  stars: ['M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
  'star-outline': ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
  'workspace-premium': ['M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M8.21 13.89L7 23l5-3 5 3-1.21-9.12'],
  mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  'mail-outline': ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  'mark-email-read': ['M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9', 'M22 6l-10 7L2 6', 'M16 19l2 2 4-4'],
  'alternate-email': ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  'chat-bubble-outline': ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  forum: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  mic: ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v4', 'M8 23h8'],
  'record-voice-over': ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2', 'M18 8a5 5 0 0 1 0 8', 'M21 5a9 9 0 0 1 0 14'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
  smartphone: ['M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01'],
  devices: ['M4 6h14v10H4z', 'M2 18h14', 'M18 10h4v10h-4z'],
  'phonelink-erase': ['M7 2h10v20H7z', 'M9 9l6 6', 'M15 9l-6 6'],
  'photo-camera': ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  'photo-library': ['M3 5h14v14H3z', 'M7 21h14V7', 'M3 15l4-4 3 3 4-4 3 3'],
  'folder-open': ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
  description: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
  code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
  memory: ['M6 6h12v12H6z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M1 9h3', 'M1 15h3', 'M20 9h3', 'M20 15h3'],
  psychology: ['M12 2a7 7 0 0 0-7 7c0 2.5 1.3 4.7 3.3 6L9 20h6l.7-5c2-1.3 3.3-3.5 3.3-6a7 7 0 0 0-7-7z', 'M9 22h6'],
  assistant: ['M12 2a9 9 0 0 0-9 9c0 4.2 2.8 7.7 6.6 8.7L12 22l2.4-2.3C18.2 18.7 21 15.2 21 11a9 9 0 0 0-9-9z'],
  extension: ['M14 2a2 2 0 0 1 2 2v2h4v6h-2a2 2 0 0 0 0 4h2v6h-6v-2a2 2 0 0 0-4 0v2H4v-6h2a2 2 0 0 0 0-4H4V6h6V4a2 2 0 0 1 2-2z'],
  palette: ['M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 10c0-4.4-4.5-8-10-8z'],
  bolt: ['M13 2L3 14h9l-1 8 10-12h-9z'],
  'pan-tool': ['M18 11V6a2 2 0 0 0-4 0v4', 'M14 10V4a2 2 0 0 0-4 0v6', 'M10 10V6a2 2 0 0 0-4 0v9a6 6 0 0 0 12 0v-4a2 2 0 0 0-4 0'],
  'touch-app': ['M12 11v9', 'M9 14v-3a3 3 0 0 1 6 0v3', 'M6 9a6 6 0 0 1 12 0'],
  groups: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  'group-off': ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M2 2l20 20'],
  contacts: ['M4 4h16v16H4z', 'M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M8 17a4 4 0 0 1 8 0'],
  handshake: ['M11 17l-5-5 4-4 5 5', 'M13 7l5 5-4 4', 'M2 12l5-5', 'M22 12l-5-5'],
  'how-to-vote': ['M18 13v6H6v-6', 'M12 3l5 5-5 5-5-5z'],
  gavel: ['M14 13l-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10', 'M16 16l6-6', 'M8 8l6-6', 'M9 7l8 8'],
  balance: ['M12 3v18', 'M5 21h14', 'M3 7h18', 'M6 7l-3 7h6z', 'M18 7l-3 7h6z'],
  public: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  place: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  'wb-sunny': ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
  'wifi-off': ['M1 1l22 22', 'M16.72 11.06A10.94 10.94 0 0 1 19 12.55', 'M5 12.55a10.94 10.94 0 0 1 5.17-2.39', 'M12 20h.01'],
  'cloud-off': ['M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6', 'M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3', 'M1 1l22 22'],
  'battery-charging-full': ['M7 6h10v14H7z', 'M10 2h4', 'M13 10l-2 3h2l-2 3'],
  'system-update': ['M7 2h10v20H7z', 'M12 8v6', 'M9 11l3 3 3-3'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
  dashboard: ['M3 3h8v8H3z', 'M13 3h8v8h-8z', 'M3 13h8v8H3z', 'M13 13h8v8h-8z'],
  'shopping-bag': ['M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  'local-offer': ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
  bookmark: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  flight: ['M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'],
  'flight-takeoff': ['M2 22h20', 'M3 15l18-5-3-3-6 2-5-4-2 1 3 5-4 1-2-2-1 1z'],
  'directions-car': ['M5 17h14v-5l-2-5H7l-2 5z', 'M5 17v2', 'M19 17v2', 'M7 13h.01', 'M17 13h.01'],
  apartment: ['M4 21V5a2 2 0 0 1 2-2h8v18', 'M14 9h4a2 2 0 0 1 2 2v10', 'M8 7h2', 'M8 11h2', 'M8 15h2'],
  'business-center': ['M2 7h20v13H2z', 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  'work-outline': ['M2 7h20v13H2z', 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  movie: ['M2 5h20v14H2z', 'M7 5v14', 'M17 5v14', 'M2 12h20'],
  newspaper: ['M4 4h16v16H4z', 'M8 8h8', 'M8 12h8', 'M8 16h4'],
  'sports-soccer': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 7l4 3-1.5 5h-5L8 10z'],
  'sentiment-satisfied': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01'],
  favorite: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
  shuffle: ['M16 3h5v5', 'M4 20L21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  radar: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M12 12l6-6'],
  'play-arrow': ['M6 4l14 8-14 8z'],
  stop: ['M6 6h12v12H6z'],
  'more-horiz': ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  'more-vert': ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  'volume-up': ['M11 5L6 9H2v6h4l5 4V5z', 'M15.54 8.46a5 5 0 0 1 0 7.07', 'M19.07 4.93a10 10 0 0 1 0 14.14'],
  'volume-mute': ['M11 5L6 9H2v6h4l5 4V5z'],
  'thumb-up': ['M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3'],
  'thumb-up-off-alt': ['M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3'],
  'thumb-down': ['M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17'],
  'thumb-down-off-alt': ['M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17'],
  'keyboard-arrow-up': ['M18 15l-6-6-6 6'],
  'keyboard-arrow-down': ['M6 9l6 6 6-6'],
  'keyboard-arrow-right': ['M9 6l6 6-6 6'],
  'push-pin': ['M12 17v5', 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z'],
  'error': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v4', 'M12 16h.01'],
  'qr-code-2': ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M18 18h3v3h-3z', 'M18 14h3', 'M14 18v3'],
  'dark-mode': ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  'light-mode': ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
  'smart-toy': ['M12 2v3', 'M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z', 'M9 13h.01', 'M15 13h.01', 'M9 17h6'],
  'radio-button-unchecked': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z'],
}

export type ProtoUiIconName = keyof typeof PATHS | (string & {})

export const ProtoUiIcon: React.FC<{
  name: ProtoUiIconName
  size?: number
  color?: string
  style?: StyleProp<ViewStyle>
}> = ({ name, size = 20, color = '#0a0a0a', style }) => {
  const list = PATHS[name]
  if (!list) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
      </Svg>
    )
  }
  if (name === 'more-horiz' || name === 'more-vert') {
    const pts = name === 'more-horiz' ? [[5, 12], [12, 12], [19, 12]] : [[12, 5], [12, 12], [12, 19]]
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        {pts.map(([cx, cy], i) => (
          <Circle key={i} cx={cx} cy={cy} r={1.8} />
        ))}
      </Svg>
    )
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {list.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  )
}

export const BackSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="arrow-back" {...p} />
export const SearchSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="search" {...p} />
export const CheckSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="check" {...p} />
export const CheckCircleSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="check-circle" {...p} />
export const BellSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="notifications" {...p} />
export const FilterSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="filter-list" {...p} />
export const RefreshSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="refresh" {...p} />
export const EyeSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="visibility" {...p} />
export const TrashSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="delete-outline" {...p} />
export const EditSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="edit" {...p} />
export const ShareSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="share" {...p} />
export const LinkSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="link" {...p} />
export const LockSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="lock" {...p} />
export const CalendarSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="calendar-today" {...p} />
export const ClockSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="schedule" {...p} />
export const CreditCardSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="credit-card" {...p} />
export const BankSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="account-balance" {...p} />
export const CopySvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="content-copy" {...p} />
export const ExternalLinkSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="open-in-new" {...p} />
export const InfoSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="info-outline" {...p} />
export const AlertSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="warning-amber" {...p} />
export const ShieldSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="shield" {...p} />
export const SparklesSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="auto-awesome" {...p} />
export const MailSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="mail" {...p} />
export const MessageSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="chat" {...p} />
export const StarSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="star" {...p} />
export const ZapSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="bolt" {...p} />
export const RepeatSvgIcon: React.FC<UiIconProps> = (p) => <ProtoUiIcon name="repeat" {...p} />

export type ChatSvgProps = UiIconProps

/** .sg cal */
export const SgCalIcon: React.FC<ChatSvgProps> = ({ color = '#0a7cff', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
    <Rect x="3" y="5" width="18" height="16" rx="3" />
    <Path d="M8 3v4M16 3v4M3 10h18" />
  </Svg>
)

/** .sg check-circle */
export const SgTasksIcon: React.FC<ChatSvgProps> = ({ color = '#ff2fa0', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="9" />
    <Path d="M8 12.5l3 3 5-6" />
  </Svg>
)

/** .sg cup/coffee */
export const SgCupIcon: React.FC<ChatSvgProps> = ({ color = '#f08300', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 11h2a2 2 0 0 1 0 4h-2" />
  </Svg>
)

/** #c-attach / #c-new */
export const PlusSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
)

/** #c-mic */
export const MicSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Rect x="9" y="3" width="6" height="12" rx="3" />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
)

/** #c-voice waveform .wv */
export const WaveSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round">
    <Path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
  </Svg>
)

/** #c-send */
export const SendUpSvgIcon: React.FC<ChatSvgProps> = ({ color = '#ffffff', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
)

/** Close X */
export const CloseSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const ChevronRightSvgIcon: React.FC<ChatSvgProps> = ({ color = '#595959', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 6l6 6-6 6" />
  </Svg>
)

export const ChevronDownSvgIcon: React.FC<ChatSvgProps> = ({ color = '#595959', size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
)
