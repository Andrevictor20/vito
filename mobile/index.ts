import { registerRootComponent } from 'expo';
import App from './App';

// Sanitização de logs em ambiente de produção (elimina vazamento de PII em logcat/console)
if (!__DEV__) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

registerRootComponent(App);

