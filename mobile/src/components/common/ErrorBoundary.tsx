import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

let Updates: typeof import('expo-updates') | null = null;
try {
  Updates = require('expo-updates');
} catch {
  Updates = null;
}

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught UI error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  private handleReloadApp = async () => {
    try {
      if (Updates && Updates.reloadAsync) {
        await Updates.reloadAsync();
      } else {
        this.handleReset();
      }
    } catch (e) {
      console.warn('[ErrorBoundary] Failed to reloadAsync:', e);
      this.handleReset();
    }
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage } = this.props;
      const title = fallbackTitle || 'Ops, algo deu errado';
      const message =
        fallbackMessage ||
        'Ocorreu uma falha inesperada na interface. Você pode tentar reiniciar o estado da tela ou recarregar o aplicativo.';

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={tokens.colors.error} />
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={this.handleReset} activeOpacity={0.8}>
                <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>Tentar Novamente</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={this.handleReloadApp} activeOpacity={0.8}>
                <MaterialCommunityIcons name="power" size={18} color={tokens.colors.primary} style={styles.buttonIcon} />
                <Text style={styles.secondaryButtonText}>Recarregar App</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.detailsToggle} onPress={this.toggleDetails} activeOpacity={0.7}>
              <Text style={styles.detailsToggleText}>
                {this.state.showDetails ? 'Ocultar detalhes técnicos ▲' : 'Ver detalhes técnicos ▼'}
              </Text>
            </TouchableOpacity>

            {this.state.showDetails && (
              <ScrollView style={styles.detailsScroll} nestedScrollEnabled>
                <Text style={styles.errorText}>
                  {this.state.error?.toString()}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.stackText}>
                    {this.state.errorInfo.componentStack.trim()}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  title: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.textPrimary,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  message: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: tokens.spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    width: '100%',
    marginBottom: tokens.spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm + 2,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  buttonIcon: {
    marginRight: 6,
  },
  primaryButton: {
    backgroundColor: tokens.colors.primary,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: tokens.typography.weight.semibold,
    fontSize: tokens.typography.size.xs,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.colors.primary,
  },
  secondaryButtonText: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
    fontSize: tokens.typography.size.xs,
  },
  detailsToggle: {
    paddingVertical: tokens.spacing.xs,
  },
  detailsToggleText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textMuted,
  },
  detailsScroll: {
    width: '100%',
    maxHeight: 180,
    marginTop: tokens.spacing.sm,
    padding: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  errorText: {
    fontSize: 11,
    color: tokens.colors.error,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  stackText: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
