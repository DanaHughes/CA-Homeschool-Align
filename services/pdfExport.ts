// Turns the work sample page(s) on the screen into a PDF file.
// The page is photographed exactly as it looks (fonts, photo, drawing, typing), so any new
// page design added later is exported automatically.

const PAGE_W = 612; // US Letter in points
const PAGE_H = 792;
const MARGIN = 18;


// The PDF maker cannot wrap text inside text boxes, draw repeating ruled lines, or keep a photo's
// shape inside a box. For the PDF only, swap those pieces for plain equivalents that look the same.
const ruledBackground = (lineHeightPx: number, color: string): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='${lineHeightPx}'><line x1='0' y1='${lineHeightPx - 0.5}' x2='20' y2='${lineHeightPx - 0.5}' stroke='${color}' stroke-width='1'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

const simplifyForPdf = (live: HTMLElement, clone: HTMLElement): void => {
  const liveAreas = Array.from(live.querySelectorAll('textarea'));
  const cloneAreas = Array.from(clone.querySelectorAll('textarea'));
  cloneAreas.forEach((area, idx) => {
    const src = liveAreas[idx];
    if (!src) return;
    const cs = getComputedStyle(src);
    const div = document.createElement('div');
    div.className = area.className;
    div.textContent = src.value;
    Object.assign(div.style, {
      font: cs.font,
      color: cs.color,
      lineHeight: cs.lineHeight,
      padding: cs.padding,
      boxSizing: 'border-box',
      flexGrow: cs.flexGrow,
      flexShrink: cs.flexShrink,
      flexBasis: cs.flexBasis,
      height: cs.height,
      minHeight: cs.minHeight,
      width: '100%',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      overflow: 'hidden',
      background: 'transparent',
      border: '0',
      borderBottom: cs.borderBottom
    });
    if (src.classList.contains('ws-write')) {
      const lh = parseFloat(cs.lineHeight) || 24;
      if (src.classList.contains('primary')) {
        div.style.backgroundImage = `${ruledBackground(lh, '#9aa3af')}, ${ruledBackground(lh / 2, '#cbd2da')}`;
        div.style.backgroundSize = `100% ${lh}px, 100% ${lh / 2}px`;
      } else {
        div.style.backgroundImage = ruledBackground(lh, '#9aa3af');
        div.style.backgroundSize = `100% ${lh}px`;
      }
      div.style.backgroundRepeat = 'repeat-y';
    }
    area.replaceWith(div);
  });

  clone.querySelectorAll<HTMLImageElement>('.ws-pic img').forEach(img => {
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'absolute', left: '0', top: '0', right: '0', bottom: '0',
      backgroundImage: `url("${img.src}")`,
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    });
    img.replaceWith(box);
  });
};

export const safeFileName = (parts: string[]): string =>
  parts
    .map(p => (p || '').trim())
    .filter(Boolean)
    .join(' - ')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || 'Work Sample';

export const buildWorkSamplePdf = async (container: HTMLElement): Promise<Blob> => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const pages = Array.from(container.querySelectorAll<HTMLElement>('.ws-page'));
  if (pages.length === 0) throw new Error('NO_PAGES');

  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      onclone: (_doc, el) => {
        // Same size on every device, no screen-only decoration.
        el.style.width = '680px';
        el.style.maxWidth = '680px';
        el.style.minHeight = '880px';
        el.style.margin = '0';
        el.style.boxShadow = 'none';
        el.style.borderRadius = '0';
        el.querySelectorAll<HTMLElement>('.no-print').forEach(n => n.remove());
        el.querySelectorAll<HTMLElement>('.ws-auto').forEach(n => { n.style.background = 'transparent'; });
        simplifyForPdf(pages[i], el);
      }
    });
    const scale = Math.min((PAGE_W - MARGIN * 2) / canvas.width, (PAGE_H - MARGIN * 2) / canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (PAGE_W - w) / 2, MARGIN, w, h);
  }
  return pdf.output('blob');
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export type ShareResult = 'shared' | 'cancelled' | 'unsupported';

// On phones and tablets (and some computers) this opens the device's share sheet with the PDF
// already attached, so the family can pick Mail, Gmail, Messages and so on.
export const shareFile = async (file: File, title: string, text: string): Promise<ShareResult> => {
  const nav: any = navigator;
  if (!nav.share || !nav.canShare || !nav.canShare({ files: [file] })) return 'unsupported';
  try {
    await nav.share({ files: [file], title, text });
    return 'shared';
  } catch (e: any) {
    return e?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
};

export const openMailDraft = (subject: string, body: string): void => {
  const a = document.createElement('a');
  a.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
