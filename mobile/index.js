import { registerRootComponent } from 'expo';

// Web'de boş olan Alert.alert'i tarayıcı pencereleriyle değiştirir (native'e dokunmaz)
import './src/utils/webAlert';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
