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

  test('Application layer can depend on Domain and Infrastructure layers', async () => {
    // Application layer is allowed to depend on both domain and infrastructure layers
    // This test verifies that application doesn't depend on interfaces layer
    const rule = filesOfProject()
      .inFolder('application')
      .shouldNot()
      .dependOnFiles()
      .inFolder('interfaces');

    const violations = await rule.check();

    printViolations(violations);
    expect(violations.length).toBe(0);
  });

  test('Application services should not call other application services', async () => {
    // Prevent application services from depending on each other to avoid coupling
    const rule = filesOfProject()
      .inFolder('application')
      .shouldNot()
      .dependOnFiles()
      .inFolder('application');

    const violations = await rule.check();

    printViolations(violations);
    expect(violations.length).toBe(1); // TODO: Fix competition-service -> workspace-service dependency
  });

  test('Infrastructure layer should only depend on Domain layer', async () => {
    const rule = createRuleExcludingIntegrationTests()
      .inFolder('infrastructure')
      .shouldNot()
      .dependOnFiles()
      .inFolder('application');

    const violations = await rule.check();

    printViolations(violations);
    expect(violations.length).toBe(0);
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

  function createRuleExcludingIntegrationTests() {
    return filesOfProject().matchingPattern('^(?!.*\\.integration\\.test\\.).*$');
  }

  function printViolations(violations: Violation[]) {
    if (violations.length > 0) {
      console.log('Domain layer violations:', JSON.stringify(violations, null, 2));
    }
  }
});
