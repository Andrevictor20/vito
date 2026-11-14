import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../../../context/ThemeContext';
import { formatWebViewDisplayUrl, isAllowedPluggyWebViewUrl, isPluggyDashboardUrl } from '../../../utils/byokFlow';
import { parseCapturedKeysMessage } from '../../../utils/pluggyKeys';
import { resolveModalBottomInset, resolveModalTopInset } from '../../../utils/safeArea';
import { PLUGGY_CAPTURE_BRIDGE_SCRIPT } from './pluggyWebViewBridge';

interface Props {
  visible: boolean;
  initialUrl?: string;
  clientId: string;
  clientSecret: string;
  onCapture: (payload: { clientId?: string; clientSecret?: string }) => void;
  onClose: () => void;
}

/**
 * WebView in-app `#s-br.wv` da Etapa 1 (Plano 26 v2.0):
 * abre `dashboard.pluggy.ai` "no Vito" com barra de captura de Client ID e Client Secret.
 */
export const PluggyDashboardWebView: React.FC<Props> = ({
  visible,
  initialUrl = 'https://dashboard.pluggy.ai',
  clientId,
  clientSecret,
  onCapture,
  onClose,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!visible) {
      setHint('');
      setCurrentUrl(initialUrl);
    }
  }, [visible, initialUrl]);

  const hasId = clientId.trim().length > 0;
  const hasSecret = clientSecret.trim().length > 0;
  const topInset = resolveModalTopInset(insets.top);
  const bottomInset = resolveModalBottomInset(insets.bottom);

  const handleMessage = (event: WebViewMessageEvent) => {
    const { data, url } = event.nativeEvent;
    if (typeof data !== 'string' || data.length === 0 || data.length > 2048) return;
    if (url && !isPluggyDashboardUrl(url)) return;
    const parsed = parseCapturedKeysMessage(data);
    if (!parsed) return;

    if (parsed.clientId && parsed.clientSecret) {
      setHint('');
      onCapture({ clientId: parsed.clientId, clientSecret: parsed.clientSecret });
      return;
    }

    if (parsed.source === 'network' || parsed.source === 'auto_scan') {
      if (parsed.clientSecret) {
        setHint('');
        onCapture({
          ...(parsed.clientId && !hasId ? { clientId: parsed.clientId } : {}),
          clientSecret: parsed.clientSecret,
        });
      } else if (parsed.clientId && !hasId) {
        onCapture({ clientId: parsed.clientId });
      }
      return;
    }

    if (parsed.source === 'scan') {
      const nextPayload: { clientId?: string; clientSecret?: string } = {};
      if (parsed.clientId) nextPayload.clientId = parsed.clientId;
      if (parsed.clientSecret) nextPayload.clientSecret = parsed.clientSecret;
      if (nextPayload.clientId || nextPayload.clientSecret) {
        onCapture(nextPayload);
      }
      if (parsed.partial && !(hasId && parsed.clientSecret) && !(parsed.clientId && hasSecret)) {
        setHint(
          parsed.maskedSecretDetected || parsed.clientId || hasId
            ? 'Client ID capturado. Toque em "Gerar novo secret" na tela da Pluggy para exibir e capturar o Client Secret.'
            : 'Abra "Suas Credenciais" ou "Applications" no painel para capturar as chaves.',
        );
      }
      return;
    }

    // Cópia individual (botão Copiar do Dashboard): atribui secret direto ou UUID distinto do ID.
    if (parsed.clientSecret) {
      setHint('');
      onCapture({ clientSecret: parsed.clientSecret });
      return;
    }
    if (parsed.clientId) {
      if (!hasId) {
        setHint('');
        onCapture({ clientId: parsed.clientId });
      } else if (parsed.clientId.toLowerCase() !== clientId.toLowerCase()) {
        setHint('');
        onCapture({ clientSecret: parsed.clientId });
      }
    }
  };

  const triggerScan = () => {
    setHint('');
    webViewRef.current?.injectJavaScript('window.__vitoScanVisibleKeys && window.__vitoScanVisibleKeys(); true;');
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
        </View>

        <View style={styles.webWrap}>
          <WebView
            ref={webViewRef}
            source={{ uri: initialUrl }}
            originWhitelist={['https://*']}
            injectedJavaScriptBeforeContentLoaded={PLUGGY_CAPTURE_BRIDGE_SCRIPT}
            injectedJavaScript={PLUGGY_CAPTURE_BRIDGE_SCRIPT}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess={false}
            allowUniversalAccessFromFileURLs={false}
            mixedContentMode="never"
            setSupportMultipleWindows={false}
            geolocationEnabled={false}
            onShouldStartLoadWithRequest={(req) => isAllowedPluggyWebViewUrl(req.url, req.isTopFrame !== false)}
            onNavigationStateChange={(nav) => {
              if (nav.url) setCurrentUrl(nav.url);
              setLoading(Boolean(nav.loading));
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => {
              setLoading(false);
              webViewRef.current?.injectJavaScript(PLUGGY_CAPTURE_BRIDGE_SCRIPT);
            }}
          />
        </View>

        <View style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.line }]}>
          <View style={styles.pillRow}>
            <StatusPill label="Client ID" captured={hasId} />
            <StatusPill label="Client Secret" captured={hasSecret} />
            <View style={{ flex: 1 }} />
            {!(hasId && hasSecret) && (
              <TouchableOpacity
                style={[styles.capBtn, { backgroundColor: colors.ink }]}
                onPress={triggerScan}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Capturar chaves"
              >
                <Text style={[styles.capBtnText, { color: colors.bg }]}>Capturar chaves</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!hint && (
            <Text style={[styles.hintText, { color: colors.orange }]} accessibilityLiveRegion="polite">
              {hint}
            </Text>
          )}
          <View style={styles.noteRow}>
            <MaterialIcons name="lock-outline" size={14} color={colors.muted} style={styles.noteIcon} />
            <Text style={[styles.noteText, { color: colors.muted }]}>
              O Vito lê só o que você copiar ou capturar aqui. Sua senha da Pluggy não é guardada.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const StatusPill: React.FC<{ label: string; captured: boolean }> = ({ label, captured }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: captured ? colors.acc : colors.line,
          backgroundColor: captured ? colors.greenBg : colors.bg,
        },
      ]}
    >
      {captured ? (
        <MaterialIcons name="check" size={13} color={colors.acc} />
      ) : (
        <Text style={[styles.pillCircle, { color: colors.muted }]}>○</Text>
      )}
      <Text style={[styles.pillLabel, { color: captured ? colors.ink : colors.muted }]}>{label}</Text>
    </View>
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
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1.5 },
  pillCircle: { fontSize: 12, fontWeight: '600' },
  pillLabel: { fontSize: 12.5, fontWeight: '600' },
  capBtn: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  capBtnText: { fontSize: 13, fontWeight: '600' },
  hintText: { fontSize: 12, fontWeight: '600', marginTop: 8, lineHeight: 16 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
