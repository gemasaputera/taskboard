import { assessPassword, passwordIncludesIdentity } from '@kanban/shared';
import { describe, expect, it } from 'vitest';

describe('password rules', () => {
  it('accepts a long password with every character class', () => {
    const assessment = assessPassword('Kanban!Passw0rd');

    expect(assessment.meetsRequirements).toBe(true);
    expect(assessment.score).toBe(4);
    expect(assessment.label).toBe('Very strong');
  });

  it('rejects short, one-class, and common passwords', () => {
    expect(assessPassword('Ab1!').meetsRequirements).toBe(false);
    expect(assessPassword('Ab1!').score).toBe(0);

    const lowercaseOnly = assessPassword('onlylowercase');
    expect(lowercaseOnly.meetsRequirements).toBe(false);
    expect(lowercaseOnly.checks.find((check) => check.id === 'case')?.met).toBe(false);

    const common = assessPassword('Password123!');
    expect(common.meetsRequirements).toBe(false);
    expect(common.checks.find((check) => check.id === 'uncommon')?.met).toBe(false);
  });

  it('detects the username and email local-part inside a password', () => {
    expect(passwordIncludesIdentity('Personaluser!1', { username: 'personaluser' })).toBe(true);
    expect(passwordIncludesIdentity('gema-secret!1', { email: 'gema@example.com' })).toBe(true);
    expect(passwordIncludesIdentity('Kanban!Passw0rd', { username: 'ada' })).toBe(false);

    const assessment = assessPassword('Personaluser!1', { username: 'personaluser' });
    expect(assessment.meetsRequirements).toBe(false);
    expect(assessment.checks.find((check) => check.id === 'personal')?.met).toBe(false);
    expect(assessment.score).toBe(1);
  });
});
