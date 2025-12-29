// Утилита для извлечения текста из различных форматов файлов

/**
 * Извлекает текст из текстового файла
 */
export const extractTextFromTxt = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

/**
 * Извлекает текст из PDF файла
 * Использует встроенный браузерный парсер или библиотеку pdf.js
 */
export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    // Используем pdfjs-dist если доступен
    // @ts-ignore
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      // @ts-ignore
      const pdfjsLib = window.pdfjsLib;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      
      return fullText.trim();
    }
    
    // Fallback: базовое извлечение текста
    const text = await file.text();
    return text;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Не удалось извлечь текст из PDF. Убедитесь, что файл не защищён паролем.');
  }
};

/**
 * Извлекает текст из ODT файла
 * ODT - это ZIP архив с XML файлами
 */
export const extractTextFromOdt = async (file: File): Promise<string> => {
  try {
    // Используем JSZip если доступен
    // @ts-ignore
    if (typeof window !== 'undefined' && window.JSZip) {
      // @ts-ignore
      const JSZip = window.JSZip;
      
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // content.xml содержит основной текст
      const contentXml = await zip.file('content.xml')?.async('text');
      
      if (!contentXml) {
        throw new Error('content.xml not found in ODT file');
      }
      
      // Простой парсинг XML для извлечения текста
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(contentXml, 'text/xml');
      
      // Извлекаем все текстовые узлы
      const textNodes = xmlDoc.querySelectorAll('text\\:p, text\\:h, text\\:span');
      const texts: string[] = [];
      
      textNodes.forEach(node => {
        const text = node.textContent?.trim();
        if (text) {
          texts.push(text);
        }
      });
      
      return texts.join('\n\n');
    }
    
    // Fallback
    throw new Error('JSZip library not available');
  } catch (error) {
    console.error('Error extracting ODT text:', error);
    throw new Error('Не удалось извлечь текст из ODT файла. Убедитесь, что файл не повреждён.');
  }
};

/**
 * Извлекает текст из DOCX файла
 * DOCX - это тоже ZIP архив с XML
 */
export const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.JSZip) {
      // @ts-ignore
      const JSZip = window.JSZip;
      
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // word/document.xml содержит текст
      const documentXml = await zip.file('word/document.xml')?.async('text');
      
      if (!documentXml) {
        throw new Error('document.xml not found in DOCX file');
      }
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(documentXml, 'text/xml');
      
      // Извлекаем текст из параграфов
      const textNodes = xmlDoc.querySelectorAll('w\\:t');
      const texts: string[] = [];
      
      textNodes.forEach(node => {
        const text = node.textContent?.trim();
        if (text) {
          texts.push(text);
        }
      });
      
      return texts.join(' ');
    }
    
    throw new Error('JSZip library not available');
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    throw new Error('Не удалось извлечь текст из DOCX файла.');
  }
};

/**
 * Универсальная функция для извлечения текста из файла
 */
export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'txt':
    case 'text':
      return extractTextFromTxt(file);
    
    case 'pdf':
      return extractTextFromPdf(file);
    
    case 'odt':
      return extractTextFromOdt(file);
    
    case 'docx':
      return extractTextFromDocx(file);
    
    case 'doc':
      throw new Error('Формат .doc не поддерживается. Пожалуйста, конвертируйте в .docx или .txt');
    
    default:
      // Пытаемся прочитать как текст
      return extractTextFromTxt(file);
  }
};

/**
 * Загружает необходимые библиотеки
 */
export const loadRequiredLibraries = () => {
  // Загружаем JSZip для ODT/DOCX
  if (typeof window !== 'undefined') {
    // @ts-ignore
    if (!window.JSZip) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      document.head.appendChild(script);
    }
    
    // Загружаем PDF.js для PDF
    // @ts-ignore
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // @ts-ignore
        if (window.pdfjsLib) {
          // @ts-ignore
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
      };
      document.head.appendChild(script);
    }
  }
};
