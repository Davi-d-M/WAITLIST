'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallPromptContextValue = {
  installPromptAvailable: boolean;
  isInstalled: boolean;
  install: () => Promise<'accepted' | 'dismissed'>;
};

const InstallPromptContext = createContext<InstallPromptContextValue | null>(null);

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) throw new Error('The home-screen install prompt is not available in this browser.');
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') setIsInstalled(true);
    return choice.outcome;
  }, [installPrompt]);

  return (
    <InstallPromptContext.Provider value={{ installPromptAvailable: !!installPrompt, isInstalled, install }}>
      {children}
    </InstallPromptContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(InstallPromptContext);
  if (!context) throw new Error('usePwaInstall must be used within PwaInstallProvider.');
  return context;
}
