import 'react-native-gesture-handler';

import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initSentry, wrapApp } from './src/observability/sentry';
import { AppProviders } from './src/providers/AppProviders';

WebBrowser.maybeCompleteAuthSession();
initSentry();

function App() {
  return (
    <>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
      <StatusBar style="auto" />
    </>
  );
}

export default wrapApp(App);
