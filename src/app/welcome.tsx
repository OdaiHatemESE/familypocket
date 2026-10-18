import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Onboarding } from '../components/Onboarding';
import { useOnboarding } from '../onboarding';

/** First launch: what قديش is, before signing in. Finishing or skipping goes to sign-in. */
export default function Welcome() {
  const { finish } = useOnboarding();
  return (
    <>
      <StatusBar style="light" />
      <Onboarding onDone={finish} />
    </>
  );
}
