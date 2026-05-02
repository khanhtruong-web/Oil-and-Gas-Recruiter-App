import * as mammoth from 'mammoth';

export const extractTextFromDoc = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Extract Ascii
    const uint8Array = new Uint8Array(arrayBuffer);
    let text = "";
    let currentString = "";
    for (let i = 0; i < uint8Array.length; i++) {
        const charCode = uint8Array[i];
        if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13 || charCode === 9) {
            currentString += String.fromCharCode(charCode);
        } else {
            if (currentString.replace(/\s/g, '').length >= 4) {
                text += currentString + "\n";
            }
            currentString = "";
        }
    }
    if (currentString.replace(/\s/g, '').length >= 4) text += currentString;
    
    // Extract UTF-16LE
    const uint16Array = new Uint16Array(arrayBuffer.slice(0, Math.floor(arrayBuffer.byteLength / 2) * 2));
    let text16 = "";
    currentString = "";
    for (let i = 0; i < uint16Array.length; i++) {
        const charCode = uint16Array[i];
        if ((charCode >= 32 && charCode <= 126) || (charCode >= 160 && charCode <= 8000) || charCode === 10 || charCode === 13 || charCode === 9) {
            currentString += String.fromCharCode(charCode);
        } else {
            if (currentString.replace(/\s/g, '').length >= 4) {
                text16 += currentString + "\n";
            }
            currentString = "";
        }
    }
    if (currentString.replace(/\s/g, '').length >= 4) text16 += currentString;

    return `Raw ASCII Extraction:\n${text}\n\nRaw UTF-16 Extraction:\n${text16}`;
};

export const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

export const extractHtmlFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value;
};
