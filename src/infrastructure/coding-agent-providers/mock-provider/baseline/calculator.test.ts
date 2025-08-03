// ABOUTME: Test suite for Calculator class covering all operations
// Includes edge cases and error handling validation

import { describe, it, expect } from 'vitest';
import { Calculator } from './src/calculator';

describe('Calculator', () => {
  const calc = new Calculator();

  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(calc.add(2, 3)).toBe(5);
    });

    it('should add negative numbers', () => {
      expect(calc.add(-2, -3)).toBe(-5);
    });

    it('should add zero', () => {
      expect(calc.add(5, 0)).toBe(5);
    });
  });

  describe('subtract', () => {
    it('should subtract two numbers', () => {
      expect(calc.subtract(5, 3)).toBe(2);
    });

    it('should handle negative results', () => {
      expect(calc.subtract(3, 5)).toBe(-2);
    });
  });

  describe('multiply', () => {
    it('should multiply two numbers', () => {
      expect(calc.multiply(4, 3)).toBe(12);
    });

    it('should handle multiplication by zero', () => {
      expect(calc.multiply(5, 0)).toBe(0);
    });
  });

  describe('divide', () => {
    it('should divide two numbers', () => {
      expect(calc.divide(10, 2)).toBe(5);
    });

    it('should throw error when dividing by zero', () => {
      expect(() => calc.divide(10, 0)).toThrow('Division by zero is not allowed');
    });

    it('should handle decimal results', () => {
      expect(calc.divide(10, 3)).toBeCloseTo(3.333, 3);
    });
  });
});
