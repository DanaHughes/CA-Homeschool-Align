// Makes a photo smaller before it is used. Big phone photos upload slowly and add nothing
// the AI needs, so this keeps the longest side to 1600 pixels as a JPEG.

const MAX_SIDE = 1600;

export const shrinkImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.onload = () => {
      const original = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error('NOT_AN_IMAGE'));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 600 * 1024) return resolve(original);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(original);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
