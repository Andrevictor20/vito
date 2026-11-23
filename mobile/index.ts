import 'react-native-gesture-handler';
import React from 'react';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import App from './App';
import { VitoVoiceOverlayRoot } from './src/overlay/VitoVoiceOverlay';

// Sanitização de logs em ambiente de produção (elimina vazamento de PII em logcat/console)
if (!__DEV__) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// O @react-navigation/stack depende do gesture-handler: o root precisa existir antes do NavigationContainer.
const Root = () =>
  React.createElement(
    GestureHandlerRootView,
    { style: { flex: 1 } },
    React.createElement(App)
  );

registerRootComponent(Root);
AppRegistry.registerComponent('VitoVoiceOverlay', () => VitoVoiceOverlayRoot);
