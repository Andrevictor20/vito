/**
 * Utilitário web para conversão de arquivos, blobs ou URIs em Base64 puro.
 */
export async function fileUriToBase64(input: File | Blob | string): Promise<string> {
  if (!input) return '';

  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      return input.split(',')[1] || '';
    }

    if (!input.includes('://') && !input.startsWith('/') && input.length > 100) {
      return input;
    }

    try {
      const response = await fetch(input);
      const blob = await response.blob();
      return await blobToBase64(blob);
    } catch (err) {
      console.warn('[fileUtils] Falha ao converter URI para base64:', err);
      return '';
    }
  }

  if (input instanceof Blob) {
    return await blobToBase64(input);
  }

  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result && result.includes(',') ? result.split(',')[1] : result || '';
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}
