import React from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../navigation/MainTabs';
import { Screen } from '../ui/Screen';
import { TextField } from '../ui/TextField';
import { Body, Title } from '../ui/Typography';

type Props = BottomTabScreenProps<MainTabParamList, 'Ask'>;

export function AskScreen({ route }: Props) {
  const [question, setQuestion] = React.useState(route.params?.q ?? '');

  React.useEffect(() => {
    const next = route.params?.q ?? '';
    setQuestion(next);
  }, [route.params?.q]);

  return (
    <Screen>
      <Title>Ask</Title>
      <Body>Perplexity-like Q&amp;A (placeholder)</Body>

      <TextField placeholder="Pose ta question..." value={question} onChangeText={setQuestion} />
    </Screen>
  );
}
