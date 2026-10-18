import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'qaddesh.onboarded.v1';

type Ctx = { seen: boolean | null; finish: () => void };
const OnboardingContext = createContext<Ctx>({ seen: true, finish: () => {} });

/** Whether this device has seen the intro. null while it is being read. */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(true)); // storage unavailable: don't block the app on the intro
  }, []);
  const finish = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(KEY, '1').catch(() => {});
  }, []);
  return <OnboardingContext.Provider value={{ seen, finish }}>{children}</OnboardingContext.Provider>;
}

export const useOnboarding = () => useContext(OnboardingContext);
