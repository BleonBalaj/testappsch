/**
 * Utility to compress image files and Data URLs to guarantee safe storage
 * within Firestore (1MB document limit) and localStorage (~5MB limit).
 */

export const compressImageFile = (file, maxWidth = 512, maxHeight = 256, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));
    if (!file.type.startsWith('image/')) return reject(new Error('File is not an image'));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Preserve PNG transparency if png, otherwise compress as jpeg
          const isPng = file.type === 'image/png';
          const format = isPng ? 'image/png' : 'image/jpeg';
          const compressed = canvas.toDataURL(format, isPng ? undefined : quality);
          resolve(compressed);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};

export const compressDataUrl = (dataUrl, maxWidth = 512, maxHeight = 256, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!dataUrl || typeof dataUrl !== 'string') return resolve('');
    if (!dataUrl.startsWith('data:image/')) return resolve(dataUrl);

    const img = new Image();
    img.onerror = () => resolve(dataUrl); // fallback to original if parsing fails
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width <= maxWidth && height <= maxHeight && dataUrl.length < 50000) {
          // Already compact enough
          return resolve(dataUrl);
        }

        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = dataUrl.startsWith('data:image/png');
        const format = isPng ? 'image/png' : 'image/jpeg';
        const compressed = canvas.toDataURL(format, isPng ? undefined : quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
};
