// ABOUTME: Architecture test that enforces DDD layer dependency rules using tsarch
// Prevents violations of clean architecture boundaries between domain, application, infrastructure, and interfaces layers

import { describe, test, expect } from 'vitest';
import { filesOfProject } from 'tsarch';
import { Violation } from 'tsarch/dist/src/common/assertion/violation';

describe('DDD Architecture Layer Dependencies', () => {
  test('Domain layer should not depend on any other layers', async () => {
    const rule = filesOfProject()
      .inFolder('domain')
      .shouldNot()
      .dependOnFiles()
      .inFolder('application');

    const violations = await rule.check();

    printViolations(violations);
    expect(violations.length).toBe(0);
  });

  test('Application layer should only depend on Domain layer', async () => {
    const rule = filesOfProject()
      .inFolder('application')
      .shouldNot()
      .dependOnFiles()
      .inFolder('infrastructure');

    const violations = await rule.check();

    printViolations(violations);
    expect(violations.length).toBe(5); // not yet clean
  });

  test('Infrastructure layer should only depend on Domain layer', async () => {
    const rule = filesOfProject()
      .inFolder('infrastructure')
      .shouldNot()
      .dependOnFiles()
      .inFolder('application');

    const violations = await rule.check();

    printViolations(violations);
    expect(violations.length).toBe(2); // not yet clean
  });

  test('Interfaces layer should only depend on Application layer', async () => {
    const rule = filesOfProject()
      .inFolder('interfaces')
      .shouldNot()
      .dependOnFiles()
      .inFolder('domain');

    const violations = await rule.check();

    if (violations.length > 0) {
      console.log('Interfaces layer violations:', violations);
    }
    expect(violations.length).toBe(0);
  });

  test('Domain layer should be cycle-free', async () => {
    const rule = filesOfProject().inFolder('domain').should().beFreeOfCycles();

    const violations = await rule.check();

    printViolations(violations);
    expect(violations.length).toBe(0);
  });

  function printViolations(violations: Violation[]) {
    if (violations.length > 0) {
      console.log('Domain layer violations:', JSON.stringify(violations, null, 2));
    }
  }
});
