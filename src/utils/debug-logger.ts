// ABOUTME: Debug logger utility that only logs when DEBUG environment variable is set
// Provides competition progress visibility without exposing implementation details

export class DebugLogger {
  private static isDebugEnabled = process.env.DEBUG === 'true';

  static log(phase: string, message: string, data?: unknown): void {
    if (!this.isDebugEnabled) return;

    const timestamp = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[DEBUG ${timestamp}] ${phase}: ${message}`);

    if (data) {
      // eslint-disable-next-line no-console
      console.log(`[DEBUG ${timestamp}] Data:`, JSON.stringify(data, null, 2));
    }
  }

  static logPhaseStart(phase: string, details?: string): void {
    this.log(phase, `Starting ${details || phase}...`);
  }

  static logPhaseEnd(phase: string, success: boolean, details?: string): void {
    const status = success ? 'SUCCESS' : 'FAILED';
    this.log(phase, `${status}: ${details || phase}`);
  }

  static logProgress(phase: string, step: string, details?: unknown): void {
    this.log(phase, `Progress: ${step}`, details);
  }

  static logDot(): void {
    if (!this.isDebugEnabled) return;
    process.stdout.write('.');
  }

  static logContent(phase: string, content: string): void {
    if (!this.isDebugEnabled) return;
    // eslint-disable-next-line no-console
    console.log(`[${phase}] ${content}`);
  }
}
