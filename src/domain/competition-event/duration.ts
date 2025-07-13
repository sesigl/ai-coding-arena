// ABOUTME: Duration value object for time measurements
// Supports both measured durations in seconds and NOT_MEASURED state

export class Duration {
  private constructor(private readonly value: number | 'NOT_MEASURED') {}

  static fromSeconds(seconds: number): Duration {
    if (seconds < 0) {
      throw new Error('Duration cannot be negative');
    }
    return new Duration(seconds);
  }

  static notMeasured(): Duration {
    return new Duration('NOT_MEASURED');
  }

  getValue(): number | 'NOT_MEASURED' {
    return this.value;
  }

  isMeasured(): boolean {
    return typeof this.value === 'number';
  }

  equals(other: Duration): boolean {
    return this.value === other.value;
  }
}
