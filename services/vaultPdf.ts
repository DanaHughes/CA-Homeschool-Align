// The branded Student Vault Record PDF.
// Follows the Charter Homeschool Help branding: teal banner with the logo on page 1, a thin teal
// line on later pages, mustard accents, Cormorant Garamond headings, Lora body text, and the
// copyright footer on every page.

import type { Student, LearningRecord } from '../types';

export interface VaultPdfInput {
  student: Student;
  records: LearningRecord[];
  filterText: string; // for example "Learning Period: LP 2 | From 2026-08-15"; empty when no filter
  includeLogic: boolean;
  preparedBy: string;
}

const W = 612; // US Letter, points
const H = 792;
const ML = 47; // 0.65 inch
const CW = W - ML * 2;

const TEAL: [number, number, number] = [54, 124, 146]; // #367c92
const DARK_TEAL: [number, number, number] = [42, 96, 112]; // #2a6070
const ROBIN: [number, number, number] = [129, 173, 179]; // #81adb3
const MUSTARD: [number, number, number] = [231, 182, 79]; // #e7b64f
const GRAY: [number, number, number] = [121, 121, 121]; // #797979
const TEXT: [number, number, number] = [74, 74, 74]; // #4a4a4a
const SOFT_TEAL: [number, number, number] = [237, 244, 245];
const PAPER: [number, number, number] = [244, 243, 239]; // #f4f3ef

const fetchBase64 = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ASSET_${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export const vaultFileName = (name: string, d = new Date()): string =>
  `Student Vault Record - ${name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Student'} - ${d.toISOString().slice(0, 10)}.pdf`;

export const buildVaultPdf = async (input: VaultPdfInput): Promise<{ blob: Blob; fileName: string }> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  // Brand fonts and logo. If any of them cannot load (for example no internet), the PDF still
  // gets made with standard fonts and no logo.
  let heading = 'times';
  let body = 'times';
  let logo: string | null = null;
  try {
    const [cb, lr, lb, li] = await Promise.all([
      fetchBase64('/fonts/CormorantGaramond_700Bold.ttf'),
      fetchBase64('/fonts/Lora_400Regular.ttf'),
      fetchBase64('/fonts/Lora_700Bold.ttf'),
      fetchBase64('/fonts/Lora_400Regular_Italic.ttf')
    ]);
    doc.addFileToVFS('CormorantGaramond_700Bold.ttf', cb);
    doc.addFont('CormorantGaramond_700Bold.ttf', 'CormorantGaramond', 'bold');
    doc.addFileToVFS('Lora_400Regular.ttf', lr);
    doc.addFont('Lora_400Regular.ttf', 'Lora', 'normal');
    doc.addFileToVFS('Lora_700Bold.ttf', lb);
    doc.addFont('Lora_700Bold.ttf', 'Lora', 'bold');
    doc.addFileToVFS('Lora_400Regular_Italic.ttf', li);
    doc.addFont('Lora_400Regular_Italic.ttf', 'Lora', 'italic');
    heading = 'CormorantGaramond';
    body = 'Lora';
  } catch (e) {
    console.warn('Brand fonts unavailable, using standard fonts:', e);
  }
  try {
    logo = 'data:image/png;base64,' + (await fetchBase64('/brand/chh-logo.png'));
  } catch (e) {
    console.warn('Logo unavailable:', e);
  }

  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const font = (family: string, style: 'normal' | 'bold' | 'italic', size: number) => {
    doc.setFont(family, style);
    doc.setFontSize(size);
  };

  // Word wrapping that counts the extra letter spacing, so lines never run past the margin.
  const wrap = (text: string, maxW: number, charSpace: number): string[] => {
    const out: string[] = [];
    String(text || '').split(/\r?\n/).forEach(para => {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      words.forEach(w => {
        const test = line ? `${line} ${w}` : w;
        if (doc.getTextWidth(test) + charSpace * test.length > maxW && line) {
          out.push(line);
          line = w;
        } else {
          line = test;
        }
      });
      out.push(line);
    });
    return out;
  };

  const drawLines = (lines: string[], x: number, y: number, lh: number, charSpace: number): number => {
    lines.forEach((l, i) => doc.text(l, x, y + i * lh, { charSpace }));
    return y + lines.length * lh;
  };

  // ----- page furniture -----
  const banner = () => {
    fill(TEAL);
    doc.rect(0, 0, W, 82.8, 'F');
    fill(MUSTARD);
    doc.rect(0, 82.8, W, 3, 'F');
    let textX = ML;
    if (logo) {
      doc.addImage(logo, 'PNG', ML, 16, 50.4, 50.4);
      textX = ML + 50.4 + 10;
    }
    doc.setTextColor(255, 255, 255);
    font(heading, 'bold', 14);
    doc.text('CHARTER HOMESCHOOL HELP', textX, 30, { charSpace: 2 });
    doc.setTextColor(184, 212, 218);
    font(body, 'italic', 8.5);
    doc.text('Clarity for California Charter Homeschool Families', textX, 49, { charSpace: 0.6 });
  };

  const topLine = () => {
    fill(TEAL);
    doc.rect(0, 0, W, 3, 'F');
  };

  const FOOT_TOP = H - 64; // content must stay above this
  const newPage = (): number => {
    doc.addPage();
    topLine();
    return 46;
  };

  // ----- page 1 -----
  banner();
  let y = 120;
  doc.setTextColor(DARK_TEAL[0], DARK_TEAL[1], DARK_TEAL[2]);
  font(heading, 'bold', 26);
  doc.text('Student Vault Record', ML, y, { charSpace: 1.2 });
  y += 18;
  color(GRAY);
  font(body, 'italic', 10);
  doc.text('Private parent record. Confidential, for parent use only.', ML, y, { charSpace: 0.8 });
  y += 22;

  // Student card
  const metaLines: string[] = [];
  metaLines.push(`Grade ${input.student.gradeLevel}`);
  if (input.filterText) metaLines.push(input.filterText);
  metaLines.push(`Prepared by ${input.preparedBy || 'a parent'} on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);
  metaLines.push(`${input.records.length} record${input.records.length === 1 ? '' : 's'} included`);
  const cardH = 20 + 26 + metaLines.length * 14 + 12;
  fill(PAPER);
  doc.roundedRect(ML, y, CW, cardH, 6, 6, 'F');
  fill(MUSTARD);
  doc.rect(ML, y, 4, cardH, 'F');
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  font(heading, 'bold', 22);
  doc.text(input.student.name, ML + 18, y + 32, { charSpace: 1 });
  color(TEXT);
  font(body, 'normal', 9.5);
  metaLines.forEach((l, i) => doc.text(l, ML + 18, y + 54 + i * 14, { charSpace: 0.8 }));
  y += cardH + 28;

  // Section heading with mustard underline
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  font(heading, 'bold', 17);
  doc.text('Learning Records', ML, y, { charSpace: 1.2 });
  fill(MUSTARD);
  doc.rect(ML, y + 5, 64, 2, 'F');
  y += 28;

  // ----- records -----
  const BODY_CS = 0.8;
  input.records.forEach(rec => {
    const activityLines = wrap(rec.activityDescription || '', CW - 18, BODY_CS);
    font(body, 'normal', 9.5);
    const stdText = `${rec.standardCode}  ${rec.standardDescription || ''}`;
    const stdLines = wrap(stdText, CW - 18, BODY_CS);
    const logicLines = input.includeLogic && rec.matchLogic ? wrap(rec.matchLogic, CW - 18 - 24, BODY_CS) : [];

    const h =
      14 + // date row
      activityLines.length * 14 + 4 +
      stdLines.length * 13 + 4 +
      (logicLines.length ? 12 + 12 + logicLines.length * 13 + 12 + 6 : 0) +
      14;

    if (y + h > FOOT_TOP) y = newPage();

    // left accent bar
    fill(ROBIN);
    doc.rect(ML, y - 2, 3, h - 12, 'F');

    let cy = y + 8;
    // date and subject
    color(GRAY);
    font(body, 'bold', 8);
    doc.text(rec.activityDate || '', ML + 14, cy, { charSpace: 0.8 });
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    font(body, 'bold', 8);
    doc.text(String(rec.standardSubject || '').toUpperCase(), W - ML, cy, { align: 'right', charSpace: 1.2 });
    cy += 16;

    // activity
    color([47, 47, 47]);
    font(body, 'bold', 10.5);
    cy = drawLines(wrap(rec.activityDescription || '', CW - 18, BODY_CS), ML + 14, cy, 14, BODY_CS) + 2;

    // standard
    font(body, 'normal', 9.5);
    color(TEXT);
    const codeW = (() => { font(body, 'bold', 9.5); return doc.getTextWidth(rec.standardCode) + BODY_CS * rec.standardCode.length; })();
    font(body, 'bold', 9.5);
    doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.text(rec.standardCode, ML + 14, cy, { charSpace: BODY_CS });
    font(body, 'normal', 9.5);
    color(TEXT);
    const descLines = wrap(rec.standardDescription || '', CW - 18 - codeW - 8, BODY_CS);
    // first line sits beside the code, the rest below
    if (descLines.length) doc.text(descLines[0], ML + 14 + codeW + 8, cy, { charSpace: BODY_CS });
    cy += 13;
    if (descLines.length > 1) {
      const rest = wrap(descLines.slice(1).join(' '), CW - 18, BODY_CS);
      cy = drawLines(rest, ML + 14, cy, 13, BODY_CS);
    }
    cy += 4;

    // how the activity met the standard
    if (logicLines.length) {
      cy += 2;
      const boxH = 12 + 12 + logicLines.length * 13 + 8;
      fill(SOFT_TEAL);
      doc.roundedRect(ML + 14, cy, CW - 14, boxH, 4, 4, 'F');
      fill(ROBIN);
      doc.rect(ML + 14, cy, 3, boxH, 'F');
      doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
      font(body, 'bold', 7);
      doc.text('HOW THE ACTIVITY MET THE STANDARD', ML + 28, cy + 14, { charSpace: 1.2 });
      color(TEXT);
      font(body, 'italic', 9.5);
      drawLines(logicLines, ML + 28, cy + 28, 13, BODY_CS);
      cy += boxH;
    }

    y += h;
    // hairline between records
    doc.setDrawColor(230, 230, 228);
    doc.setLineWidth(0.5);
    doc.line(ML, y - 6, W - ML, y - 6);
  });

  // ----- footer on every page -----
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    fill(MUSTARD);
    doc.rect(0, H - 3, W, 3, 'F');
    color(GRAY);
    font(body, 'normal', 7.5);
    doc.text(`© ${new Date().getFullYear()} Charter Homeschool Help  |  charterhomeschoolhelp.com`, W / 2, H - 36, { align: 'center', charSpace: 0.4 });
    doc.text(`Page ${p} of ${total}`, W - ML, H - 36, { align: 'right', charSpace: 0.4 });
    font(body, 'italic', 7);
    doc.text('Zero-Reporting Guarantee Active  •  Private Parent Record', W / 2, H - 24, { align: 'center', charSpace: 0.3 });
  }

  return { blob: doc.output('blob'), fileName: vaultFileName(input.student.name) };
};
