import 'react-native-gesture-handler';

import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppProviders } from './src/providers/AppProviders';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  return (
    <>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
      <StatusBar style="auto" />
    </>
  );
}
