import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';
import { VitoVoiceOverlay } from './src/overlay/VitoVoiceOverlay';

// Sanitização de logs em ambiente de produção (elimina vazamento de PII em logcat/console)
if (!__DEV__) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

registerRootComponent(App);
AppRegistry.registerComponent('VitoVoiceOverlay', () => VitoVoiceOverlay);

