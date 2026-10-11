import { useEffect, useState } from 'react';
import { dbService } from './dbService';
import { DEFAULT_SITE_TEXT, SiteText, mergeSiteText } from './siteText';
import { DEFAULT_START_HERE, StartHereContent, mergeStartHere } from './startHereContent';

// One shared copy of the editable wording, loaded once when the app opens. Screens that call
// useSiteText() / useStartHere() update by themselves when it arrives or when Dana saves a change.
let siteText: SiteText = DEFAULT_SITE_TEXT;
let startHere: StartHereContent = DEFAULT_START_HERE;
let loadedText = false;
let loadedStart = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const applySiteText = (saved: unknown) => { siteText = mergeSiteText(saved); notify(); };
export const applyStartHere = (saved: unknown) => { startHere = mergeStartHere(saved); notify(); };

const useListener = () => {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
};

export const useSiteText = (): SiteText => {
  useListener();
  useEffect(() => {
    if (loadedText) return;
    loadedText = true;
    dbService.getSiteText().then(applySiteText);
  }, []);
  return siteText;
};

// Start Here content is read only after sign-in (database rules), so it is requested separately.
export const useStartHere = (signedIn: boolean): StartHereContent => {
  useListener();
  useEffect(() => {
    if (!signedIn || loadedStart) return;
    loadedStart = true;
    dbService.getStartHere().then(applyStartHere);
  }, [signedIn]);
  return startHere;
};
