import { parseQueryInt, parseQueryFloat, parseQueryBoolean, parseDateRange, wasValueClamped } from '../../utils/queryParsing';

describe('Query Parsing Utils', () => {
  describe('parseQueryInt', () => {
    it('should parse valid integer string', () => {
      expect(parseQueryInt('42')).toBe(42);
    });

    it('should return default value for invalid string', () => {
      expect(parseQueryInt('invalid')).toBe(1); // default default
    });

    it('should return provided default for invalid string', () => {
      expect(parseQueryInt('invalid', { default: 10 })).toBe(10);
    });

    it('should enforce minimum value', () => {
      expect(parseQueryInt('5', { min: 10 })).toBe(10);
    });

    it('should enforce maximum value', () => {
      expect(parseQueryInt('100', { max: 50 })).toBe(50);
    });

    it('should return value within range', () => {
      expect(parseQueryInt('25', { min: 10, max: 50 })).toBe(25);
    });

    it('should handle negative numbers', () => {
      expect(parseQueryInt('-10')).toBe(-10);
    });

    it('should handle empty string as invalid', () => {
      expect(parseQueryInt('', { default: 5 })).toBe(5);
    });
  });

  describe('parseQueryFloat', () => {
    it('should parse valid float string', () => {
      expect(parseQueryFloat('3.14')).toBe(3.14);
    });

    it('should return default value for invalid string', () => {
      expect(parseQueryFloat('invalid')).toBe(0); // default default
    });

    it('should return provided default for invalid string', () => {
      expect(parseQueryFloat('invalid', { default: 1.5 })).toBe(1.5);
    });

    it('should enforce minimum value', () => {
      expect(parseQueryFloat('0.5', { min: 1.0 })).toBe(1.0);
    });

    it('should enforce maximum value', () => {
      expect(parseQueryFloat('10.5', { max: 5.0 })).toBe(5.0);
    });
  });

  describe('parseQueryBoolean', () => {
    it('should parse "true" string as true', () => {
      expect(parseQueryBoolean('true')).toBe(true);
      expect(parseQueryBoolean('TRUE')).toBe(true);
      expect(parseQueryBoolean('True')).toBe(true);
    });

    it('should parse "1" string as true', () => {
      expect(parseQueryBoolean('1')).toBe(true);
    });

    it('should parse "false" string as false', () => {
      expect(parseQueryBoolean('false')).toBe(false);
      expect(parseQueryBoolean('FALSE')).toBe(false);
      expect(parseQueryBoolean('False')).toBe(false);
    });

    it('should parse "0" string as false', () => {
      expect(parseQueryBoolean('0')).toBe(false);
    });

    it('should return default for invalid strings', () => {
      expect(parseQueryBoolean('invalid', false)).toBe(false);
      expect(parseQueryBoolean('invalid', true)).toBe(true);
      expect(parseQueryBoolean('', false)).toBe(false);
    });

    it('should return false as default when not specified', () => {
      expect(parseQueryBoolean('invalid')).toBe(false);
    });
  });

  describe('parseDateRange', () => {
    it('should parse valid date range', () => {
      const result = parseDateRange('2024-01-01', '2024-12-31');

      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
      expect(result.start?.toISOString().startsWith('2024-01-01')).toBe(true);
      expect(result.end?.toISOString().startsWith('2024-12-31')).toBe(true);
    });

    it('should handle only start date', () => {
      const result = parseDateRange('2024-01-01', undefined);

      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeUndefined();
    });

    it('should handle only end date', () => {
      const result = parseDateRange(undefined, '2024-12-31');

      expect(result.start).toBeUndefined();
      expect(result.end).toBeInstanceOf(Date);
    });

    it('should handle invalid dates', () => {
      const result = parseDateRange('invalid', 'also-invalid');

      expect(result.start).toBeUndefined();
      expect(result.end).toBeUndefined();
    });

    it('should swap dates if start is after end', () => {
      const result = parseDateRange('2024-12-31', '2024-01-01');

      expect(result.start && result.end && result.start <= result.end).toBe(true);
    });
  });

  describe('wasValueClamped', () => {
    it('should return true when value was clamped to min', () => {
      const result = parseQueryInt('5', { min: 10 });
      expect(wasValueClamped()).toBe(true);
    });

    it('should return true when value was clamped to max', () => {
      const result = parseQueryInt('100', { max: 50 });
      expect(wasValueClamped()).toBe(true);
    });

    it('should return false when value was not clamped', () => {
      const result = parseQueryInt('25', { min: 10, max: 50 });
      expect(wasValueClamped()).toBe(false);
    });

    it('should return false for invalid values using default', () => {
      const result = parseQueryInt('invalid', { default: 25, min: 10, max: 50 });
      expect(wasValueClamped()).toBe(false);
    });
  });
});
