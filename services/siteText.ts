// The app's own wording and web addresses that Dana can change in the Admin tab ("Text & Links").
// They are saved in the database (settings/siteText). If nothing is saved, or a box is left empty,
// these original words are used, so a mistake can never leave a screen blank.
// The words on the payment screen are separate (services/paywallText.ts) and so are the Start Here
// steps and questions (services/startHereContent.ts).

export interface TextDef {
  key: string;
  group: string;
  label: string;
  help: string;
  rows: number;
  limit: number;
  isLink?: boolean;
  fallback: string;
}

export const BLUEPRINT_URL = 'https://www.charterhomeschoolhelp.com/products/the-charter-homeschool-blueprint';
export const WEBSITE_URL = 'https://www.charterhomeschoolhelp.com';

export const TEXT_DEFS: TextDef[] = [
  { key: 'loginTagline', group: 'Sign-in page', label: 'Tagline', help: 'The small teal line under the app name.', rows: 1, limit: 60, fallback: 'MAKING HOMESCHOOL DOABLE.' },
  {
    key: 'loginIntro1', group: 'Sign-in page', label: 'First paragraph', help: 'The first paragraph under the tagline.', rows: 4, limit: 500,
    fallback: "Turn any real life or hands-on learning activity into a charter-ready work sample instantly. Just snap a photo or describe the activity, and the app will generate several polished work sample options your child may annotate within the app or print out before adding their feedback. That's it!"
  },
  {
    key: 'loginIntro2', group: 'Sign-in page', label: 'Second paragraph', help: 'The second paragraph.', rows: 4, limit: 500,
    fallback: 'This is the fastest way to get a charter-ready work sample based on real-life knowledge your child actually participated in, without the extra busy work or searching for worksheets the night before your learning period meetings. Perfect for personal or PSA records as well!'
  },
  { key: 'loginIntro3', group: 'Sign-in page', label: 'Last line (bold)', help: 'The short bold line at the end.', rows: 1, limit: 200, fallback: 'Developed by a CA charter homeschool teacher with you in mind.' },

  {
    key: 'optionsHeading', group: 'Work sample options page', label: 'Heading', help: 'The sentence above the work sample options.', rows: 3, limit: 300,
    fallback: 'Click on the work sample option that sounds like the best fit for your child, or that best supports an I Can Statement or standard goal for your child.'
  },
  { key: 'optionsDropdown', group: 'Work sample options page', label: 'Dropdown under each option', help: 'The small arrow line that opens the standard code and text.', rows: 1, limit: 80, fallback: 'Standard covered in this activity' },

  { key: 'vaultSubtitle', group: 'Student Vault', label: 'Vault page subtitle', help: 'The small line under "Student Vault".', rows: 1, limit: 120, fallback: "Private storage for your child's work sample records." },
  { key: 'saveProfilePrompt', group: 'Student Vault', label: 'Pop-up when saving to a student', help: 'Shown when a family picks which student to save to.', rows: 1, limit: 120, fallback: 'Select which profile should store this work sample record.' },
  { key: 'coveredTag', group: 'Student Vault', label: 'Tag when a standard repeats', help: 'Type {n} where the number of times should appear.', rows: 1, limit: 40, fallback: 'Covered {n}x' },
  { key: 'includeLogicLabel', group: 'Student Vault', label: 'Export checkbox', help: 'The checkbox on the Vault export screen.', rows: 1, limit: 100, fallback: 'Include "how the activity covered the standard"' },
  { key: 'csvLogicHeading', group: 'Student Vault', label: 'Spreadsheet (CSV) column heading', help: 'The last column heading in the Vault spreadsheet export.', rows: 1, limit: 80, fallback: 'How the Activity Covered the Standard' },
  { key: 'blueprintLine', group: 'Student Vault', label: 'Line near the export', help: 'Shown above the Blueprint link on the Vault export screen.', rows: 2, limit: 200, fallback: 'Need help turning your learning activities into charter-approved work samples?' },
  { key: 'blueprintLinkText', group: 'Student Vault', label: 'Blueprint link words', help: 'The clickable words after that line.', rows: 1, limit: 100, fallback: 'Check out our comprehensive Charter Homeschool Blueprint' },

  { key: 'headerByline', group: 'Header and footer', label: 'Small line under the app name', help: 'Links to your website.', rows: 1, limit: 80, fallback: 'by Charter Homeschool Help' },
  { key: 'footerLine', group: 'Header and footer', label: 'Footer line', help: 'The year and the copyright symbol are added in front for you.', rows: 1, limit: 120, fallback: 'Charter Homeschool Help | All Rights Reserved' },

  { key: 'websiteUrl', group: 'Web addresses', label: 'Your website', help: 'Where the logo, the "by" line and the footer go. Must start with https://', rows: 1, limit: 300, isLink: true, fallback: WEBSITE_URL },
  { key: 'blueprintUrl', group: 'Web addresses', label: 'Charter Homeschool Blueprint page', help: 'Where the Blueprint links go. Must start with https://', rows: 1, limit: 300, isLink: true, fallback: BLUEPRINT_URL }
];

export type SiteText = Record<string, string>;

export const DEFAULT_SITE_TEXT: SiteText = Object.fromEntries(TEXT_DEFS.map(d => [d.key, d.fallback]));

// Only real web addresses are accepted for links.
export const isSafeUrl = (value: string): boolean => /^https:\/\/[^\s]+$/i.test(value.trim());

// Combines what was saved with the original words. Empty boxes fall back to the original words,
// over-long text is trimmed, and a link that is not a real https:// address is ignored.
export const mergeSiteText = (saved: unknown): SiteText => {
  const result: SiteText = { ...DEFAULT_SITE_TEXT };
  if (saved && typeof saved === 'object') {
    for (const def of TEXT_DEFS) {
      const value = (saved as Record<string, unknown>)[def.key];
      if (typeof value !== 'string' || !value.trim()) continue;
      const trimmed = value.trim().slice(0, def.limit);
      if (def.isLink && !isSafeUrl(trimmed)) continue;
      result[def.key] = trimmed;
    }
  }
  return result;
};

export const fillCount = (template: string, n: number): string => template.replace(/\{n\}/g, String(n));
