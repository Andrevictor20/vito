import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../../context/ThemeContext';
import {
  classifyPortalNavigation,
  formatWebViewDisplayUrl,
  isPluggyDashboardUrl,
  parseItemId,
  parsePluggyConnectItemMessage,
} from '../../../utils/byokFlow';
import { IN_APP_BROWSER_OPTIONS } from '../../../utils/platformInfo';
import { clearPluggyWebViewData } from '../../../utils/pluggyBrowserReset';
import { resolveModalBottomInset, resolveModalTopInset } from '../../../utils/safeArea';
import { PLUGGY_CONNECT_BRIDGE_SCRIPT } from './pluggyWebViewBridge';

export type PluggyPortalMode = 'meu_pluggy' | 'connect';

interface Props {
  visible: boolean;
  mode: PluggyPortalMode;
  url: string;
  sessionKey?: number;
  onClose: () => void;
  onFinishMeuPluggy: () => void;
  onConnectItemCaptured: (itemId: string) => void;
  onFallbackConnectExternal?: () => void;
}

/**
 * WebView in-app unificada para Etapa 2 (`meu.pluggy.ai`) e Etapa 3 (`connect.pluggy.ai`),
 * mantendo o fluxo dentro do Vito com suporte a deep links bancários (`nubank://`, `intent://`)
 * e fallback em 1 toque para Custom Tabs.
 */
export const PluggyPortalWebView: React.FC<Props> = ({
  visible,
  mode,
  url,
  sessionKey = 0,
  onClose,
  onFinishMeuPluggy,
  onConnectItemCaptured,
  onFallbackConnectExternal,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const completedRef = useRef(false);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [loading, setLoading] = useState(true);
  const [capturedItemId, setCapturedItemId] = useState('');
  const [localSessionKey, setLocalSessionKey] = useState(0);
  const [sessionNotice, setSessionNotice] = useState('');

  useEffect(() => {
    if (!visible) {
      completedRef.current = false;
      setCapturedItemId('');
      setSessionNotice('');
      setCurrentUrl(url);
      setLoading(true);
    } else if (url) {
      completedRef.current = false;
      setCapturedItemId('');
      setSessionNotice('');
      setCurrentUrl(url);
    }
  }, [visible, url]);

  const topInset = resolveModalTopInset(insets.top);
  const bottomInset = resolveModalBottomInset(insets.bottom);
  const isConnect = mode === 'connect';

  const emitConnectItem = (itemId: string, forceFinish: boolean) => {
    if (!itemId) return;
    setCapturedItemId(itemId);
    if (forceFinish && !completedRef.current) {
      completedRef.current = true;
      onConnectItemCaptured(itemId);
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    if (!isConnect) return;
    const { data, url: msgUrl } = event.nativeEvent;
    if (typeof data !== 'string' || data.length === 0 || data.length > 2048) return;
    if (msgUrl && !isPluggyDashboardUrl(msgUrl)) return;
    const parsed = parsePluggyConnectItemMessage(data);
    if (!parsed) return;
    setCapturedItemId(parsed.itemId);
    if (parsed.status === 'UPDATED' || parsed.status === 'UPDATING' || parsed.source === 'postmessage') {
      emitConnectItem(parsed.itemId, true);
    }
  };

  const handleOpenExternal = () => {
    if (isConnect && onFallbackConnectExternal) {
      onFallbackConnectExternal();
      return;
    }
    const target = currentUrl || url;
    const browserOpts: WebBrowser.WebBrowserOpenOptions = {
      toolbarColor: IN_APP_BROWSER_OPTIONS.toolbarColor,
      secondaryToolbarColor: IN_APP_BROWSER_OPTIONS.secondaryToolbarColor,
      controlsColor: IN_APP_BROWSER_OPTIONS.controlsColor,
      createTask: false,
      showInRecents: false,
      enableDefaultShareMenuItem: false,
      enableBarCollapsing: true,
      showTitle: false,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      dismissButtonStyle: 'close',
    };
    void WebBrowser.openBrowserAsync(target, browserOpts).catch(() => {
      void Linking.openURL(target);
    });
  };

  const handleClearSession = async () => {
    await clearPluggyWebViewData(webViewRef);
    setCapturedItemId('');
    setCurrentUrl(url);
    setLoading(true);
    setSessionNotice('Sessão e cookies apagados.');
    setLocalSessionKey((k) => k + 1);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={[styles.topBar, { backgroundColor: colors.bg, borderBottomColor: colors.line }]}>
          <TouchableOpacity
            style={[styles.closeCircle, { backgroundColor: colors.bg, borderColor: colors.line }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao Vito"
          >
            <MaterialIcons name="close" size={18} color={colors.ink} />
          </TouchableOpacity>
          <View style={[styles.noVitoBadge, { backgroundColor: colors.ink }]}>
            <Text style={[styles.noVitoText, { color: colors.bg }]}>no Vito</Text>
          </View>
          <View style={[styles.urlBar, { backgroundColor: colors.surf }]}>
            <MaterialIcons name="lock" size={13} color={colors.muted} />
            <Text style={[styles.urlText, { color: colors.ink }]} numberOfLines={1}>
              {formatWebViewDisplayUrl(currentUrl)}
            </Text>
            {loading && <ActivityIndicator size="small" color={colors.muted} />}
          </View>
          <TouchableOpacity
            style={[styles.closeCircle, { backgroundColor: colors.bg, borderColor: colors.line }]}
            onPress={() => void handleClearSession()}
            accessibilityRole="button"
            accessibilityLabel="Limpar dados de navegação"
          >
            <MaterialIcons name="delete-sweep" size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.webWrap}>
          {!!url && (
            <WebView
              key={`${mode}-${sessionKey}-${localSessionKey}`}
              ref={webViewRef}
              source={{ uri: url }}
              originWhitelist={['https://*']}
              injectedJavaScriptBeforeContentLoaded={isConnect ? PLUGGY_CONNECT_BRIDGE_SCRIPT : undefined}
              injectedJavaScript={isConnect ? PLUGGY_CONNECT_BRIDGE_SCRIPT : undefined}
              onMessage={handleMessage}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              allowFileAccess={false}
              allowUniversalAccessFromFileURLs={false}
              mixedContentMode="never"
              setSupportMultipleWindows={false}
              geolocationEnabled={false}
              onShouldStartLoadWithRequest={(req) => {
                const action = classifyPortalNavigation(req.url, req.isTopFrame !== false);
                if (action === 'vito_success') {
                  const id = parseItemId(req.url);
                  if (id) emitConnectItem(id, true);
                  else onConnectItemCaptured(capturedItemId);
                  return false;
                }
                if (action === 'external') {
                  void Linking.openURL(req.url).catch(() => {});
                  return false;
                }
                return action === 'allow';
              }}
              onNavigationStateChange={(nav) => {
                if (nav.url) setCurrentUrl(nav.url);
                setLoading(Boolean(nav.loading));
              }}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => {
                setLoading(false);
                if (isConnect) webViewRef.current?.injectJavaScript(PLUGGY_CONNECT_BRIDGE_SCRIPT);
              }}
            />
          )}
        </View>

        <View style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.line, backgroundColor: colors.bg }]}
              onPress={handleOpenExternal}
              accessibilityRole="button"
              accessibilityLabel="Abrir no navegador"
            >
              <MaterialIcons name="open-in-new" size={15} color={colors.ink} />
              <Text style={[styles.secondaryText, { color: colors.ink }]}>Navegador</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: capturedItemId || !isConnect ? colors.ink : colors.surf },
              ]}
              onPress={() => {
                if (isConnect) {
                  completedRef.current = true;
                  onConnectItemCaptured(capturedItemId);
                } else {
                  onFinishMeuPluggy();
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={isConnect ? 'Concluir autorização' : 'Já conectei no Meu Pluggy'}
            >
              <Text
                style={[
                  styles.primaryText,
                  { color: capturedItemId || !isConnect ? colors.bg : colors.ink },
                ]}
              >
                {isConnect ? (capturedItemId ? 'Sincronizar agora' : 'Já autorizei, continuar') : 'Já conectei, continuar'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.noteRow}>
            <MaterialIcons name="lock-outline" size={14} color={colors.muted} style={styles.noteIcon} />
            <Text style={[styles.noteText, { color: colors.muted }]}>
              {sessionNotice
                ? sessionNotice
                : isConnect
                  ? 'Autorize o Meu Pluggy aqui dentro. Assim que aprovar, o Vito inicia a sincronização.'
                  : 'Conecte seus bancos no Meu Pluggy. Se o app do banco não voltar aqui após autorizar, use "Navegador".'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  closeCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noVitoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  noVitoText: { fontSize: 11, fontWeight: '700' },
  urlBar: { flex: 1, height: 36, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  urlText: { flex: 1, fontSize: 13 },
  webWrap: { flex: 1 },
  bottomBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryBtn: { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  secondaryText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 13, fontWeight: '600' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
