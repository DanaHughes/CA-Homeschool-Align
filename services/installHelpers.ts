// Helpers for the "Add to your home screen" prompt.
// Browsers differ a lot here, so this figures out which instructions to show.

export type InstallKind = 'inapp' | 'ios' | 'android' | 'desktop-chromium' | 'desktop-safari' | 'other';

export interface InstallEnv {
  ua: string;
  platform: string;
  maxTouchPoints: number;
}

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|TikTok|Snapchat|Pinterest|MicroMessenger|GSA\//i;

// Which set of directions fits this device and browser.
export const detectInstallKind = (env: InstallEnv): InstallKind => {
  const { ua, platform, maxTouchPoints } = env;
  if (IN_APP.test(ua)) return 'inapp';
  const iPadOnMac = platform === 'MacIntel' && maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || iPadOnMac) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Edg\/|Chrome\/|Chromium\//.test(ua)) return 'desktop-chromium';
  if (/Safari\//.test(ua)) return 'desktop-safari';
  return 'other';
};

// Phones and tablets are where families want an app icon, so only they get the automatic pop-up.
export const isTouchDevice = (kind: InstallKind): boolean =>
  kind === 'ios' || kind === 'android' || kind === 'inapp';

export const currentEnv = (): InstallEnv => ({
  ua: navigator.userAgent || '',
  platform: navigator.platform || '',
  maxTouchPoints: navigator.maxTouchPoints || 0
});

// True when the app was opened from the home screen icon already.
export const isInstalledApp = (): boolean => {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
};

const SNOOZE_KEY = 'installPromptSnoozeUntil';
const NEVER_KEY = 'installPromptNever';
export const SNOOZE_DAYS = 14;

export const shouldAutoShow = (now = Date.now()): boolean => {
  try {
    if (localStorage.getItem(NEVER_KEY) === '1') return false;
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return now >= until;
  } catch {
    return true;
  }
};

export const snoozePrompt = (now = Date.now()): void => {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now + SNOOZE_DAYS * 86400_000));
  } catch { /* storage can be blocked; the prompt then just shows again next visit */ }
};

export const neverShowPrompt = (): void => {
  try {
    localStorage.setItem(NEVER_KEY, '1');
  } catch { /* ignore */ }
};

// Android Chrome and desktop Chrome/Edge can offer a one-tap install. They announce it once,
// early, so it is captured here as soon as this file loads.
let deferred: any = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach(l => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    neverShowPrompt();
    listeners.forEach(l => l());
  });
}

export const canOneTapInstall = (): boolean => !!deferred;
export const onInstallAvailabilityChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const runOneTapInstall = async (): Promise<boolean> => {
  if (!deferred) return false;
  const evt = deferred;
  deferred = null;
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    return choice?.outcome === 'accepted';
  } catch {
    return false;
  }
};

export interface InstallSteps {
  title: string;
  steps: string[];
  note?: string;
}

export const installSteps = (kind: InstallKind): InstallSteps => {
  switch (kind) {
    case 'inapp':
      return {
        title: 'First, open this page in your browser',
        steps: [
          'You are inside another app (like Facebook or Instagram), which cannot add apps to your home screen.',
          'Tap the three dots or the share icon in the corner of the screen.',
          'Tap "Open in browser" (or "Open in Safari" or "Open in Chrome").',
          'Once it opens there, come back to this page and follow the steps shown.'
        ]
      };
    case 'ios':
      return {
        title: 'Add to your iPhone or iPad home screen',
        steps: [
          'Tap the Share button. It is a square with an arrow pointing up, at the bottom of the screen on an iPhone and at the top on an iPad.',
          'Scroll down and tap "Add to Home Screen".',
          'Tap "Add" in the top right corner.'
        ],
        note: 'If you do not see "Add to Home Screen", open this page in Safari and try again.'
      };
    case 'android':
      return {
        title: 'Add to your Android home screen',
        steps: [
          'Tap the three dots menu in the top right corner of Chrome.',
          'Tap "Add to Home screen" (it may say "Install app").',
          'Tap "Add" or "Install".'
        ],
        note: 'The wording can differ a little on other browsers.'
      };
    case 'desktop-chromium':
      return {
        title: 'Install on your computer',
        steps: [
          'Look at the right end of the address bar at the top of the window for a small install icon (a screen with a down arrow) and click it.',
          'If you do not see it, open the browser menu (three dots) and look for "Install" or "Save and share".',
          'Click "Install".'
        ]
      };
    case 'desktop-safari':
      return {
        title: 'Add to your Mac Dock',
        steps: [
          'In the menu bar at the top of the screen, click File.',
          'Click "Add to Dock".',
          'Click "Add".'
        ],
        note: 'This needs a recent version of macOS and Safari.'
      };
    default:
      return {
        title: 'Add this app to your home screen',
        steps: [
          'Open your browser menu.',
          'Look for "Add to Home screen" or "Install".',
          'Follow the prompt.'
        ]
      };
  }
};
