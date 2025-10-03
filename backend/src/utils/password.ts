const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

export const generateTempPassword = (length = 12): string => {
  let password = '';
  password += UPPER[Math.floor(Math.random() * UPPER.length)];
  password += LOWER[Math.floor(Math.random() * LOWER.length)];
  password += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  password += SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  for (let i = password.length; i < length; i += 1) {
    password += ALL[Math.floor(Math.random() * ALL.length)];
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};
