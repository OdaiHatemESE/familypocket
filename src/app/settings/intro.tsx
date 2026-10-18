import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Onboarding } from '../../components/Onboarding';

/** The intro again, from settings */
export default function Intro() {
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <>
      <StatusBar style="light" />
      <Onboarding onDone={close} doneLabel="تمام" />
    </>
  );
}
