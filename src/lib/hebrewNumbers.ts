/**
 * Converts a number to Hebrew letters (Gematria)
 * Examples: 1 -> א, 2 -> ב, 10 -> י, 15 -> ט"ו
 */
export function toHebrewNumeral(num: number): string {
  if (num <= 0 || num > 9999) return String(num);

  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const thousands = ['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳'];

  let result = '';
  
  // Thousands
  const thousandsDigit = Math.floor(num / 1000);
  if (thousandsDigit > 0) {
    result += thousands[thousandsDigit];
    num %= 1000;
  }

  // Hundreds
  const hundredsDigit = Math.floor(num / 100);
  if (hundredsDigit > 0) {
    result += hundreds[hundredsDigit];
    num %= 100;
  }

  // Special cases for 15 and 16 (ט"ו, ט"ז instead of יה, יו which spell God's name)
  if (num === 15) {
    result += 'ט״ו';
  } else if (num === 16) {
    result += 'ט״ז';
  } else {
    // Tens
    const tensDigit = Math.floor(num / 10);
    if (tensDigit > 0) {
      result += tens[tensDigit];
      num %= 10;
    }

    // Ones
    if (num > 0) {
      result += ones[num];
    }
  }

  // Add gershayim (") for multi-letter numbers or geresh (') for single letter
  if (result.length > 1 && !result.includes('״') && !result.includes('׳')) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  } else if (result.length === 1) {
    result += '׳';
  }

  return result;
}

/**
 * Converts Hebrew numeral back to a number
 * Examples: "ב" -> 2, "כג" -> 23, "ט״ו" -> 15
 */
export function fromHebrewNumeral(hebrewNum: string): number | null {
  if (!hebrewNum) return null;

  // Remove gershayim and geresh
  const cleaned = hebrewNum.replace(/[״׳]/g, '').trim();
  
  const onesMap: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5,
    'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9
  };
  
  const tensMap: Record<string, number> = {
    'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50,
    'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90
  };
  
  const hundredsMap: Record<string, number> = {
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
    'תק': 500, 'תר': 600, 'תש': 700, 'תת': 800, 'תתק': 900
  };

  let total = 0;
  let i = 0;

  // Check for hundreds
  if (cleaned.length >= 2) {
    const twoChar = cleaned.substring(i, i + 2);
    if (hundredsMap[twoChar]) {
      total += hundredsMap[twoChar];
      i += 2;
    } else if (hundredsMap[cleaned[i]]) {
      total += hundredsMap[cleaned[i]];
      i++;
    }
  } else if (hundredsMap[cleaned[i]]) {
    total += hundredsMap[cleaned[i]];
    i++;
  }

  // Check for tens
  if (i < cleaned.length && tensMap[cleaned[i]]) {
    total += tensMap[cleaned[i]];
    i++;
  }

  // Check for ones
  if (i < cleaned.length && onesMap[cleaned[i]]) {
    total += onesMap[cleaned[i]];
  }

  return total > 0 ? total : null;
}

/**
 * Converts daf format to Hebrew
 * Examples: "2a" -> "ב ע\"א", "10b" -> "י ע\"ב"
 */
export function toDafFormat(dafNumber: number, side: 'a' | 'b' = 'a'): string {
  const hebrewNum = toHebrewNumeral(dafNumber);
  const sideText = side === 'a' ? 'ע״א' : 'ע״ב';
  return `${hebrewNum} ${sideText}`;
}
