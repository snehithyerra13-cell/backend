const BASE62_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Encodes a base-10 number into a Base62 string.
 * Used for sequential ID-to-ShortCode conversion.
 */
export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_CHARSET[0];
  let encoded = '';
  let temp = num;
  while (temp > 0) {
    encoded = BASE62_CHARSET[temp % 62] + encoded;
    temp = Math.floor(temp / 62);
  }
  return encoded;
}

/**
 * Decodes a Base62 string back to a base-10 number.
 */
export function decodeBase62(str: string): number {
  let decoded = 0;
  for (let i = 0; i < str.length; i++) {
    const index = BASE62_CHARSET.indexOf(str[i]);
    if (index === -1) {
      throw new Error(`Invalid Base62 character: ${str[i]}`);
    }
    decoded = decoded * 62 + index;
  }
  return decoded;
}

/**
 * Generates a random Base62 string of specified length.
 * Standard approach for generating unpredictable short codes.
 */
export function generateRandomShortCode(length: number = 6): string {
  let result = '';
  const charsetLength = BASE62_CHARSET.length;
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charsetLength);
    result += BASE62_CHARSET[randomIndex];
  }
  return result;
}
