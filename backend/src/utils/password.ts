import crypto from 'crypto';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/**
 * Generates a cryptographically secure random password
 * @param length - Length of the password (default: 12)
 * @returns A secure random password
 */
export const generateTempPassword = (length = 12): string => {
  const getRandomChar = (charset: string): string => {
    const randomIndex = crypto.randomInt(0, charset.length);
    return charset[randomIndex];
  };

  // Ensure at least one character from each type
  let password = '';
  password += getRandomChar(UPPER);
  password += getRandomChar(LOWER);
  password += getRandomChar(DIGITS);
  password += getRandomChar(SYMBOLS);

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i += 1) {
    password += getRandomChar(ALL);
  }

  // Shuffle the password using Fisher-Yates algorithm with crypto.randomInt
  const passwordArray = password.split('');
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
};
