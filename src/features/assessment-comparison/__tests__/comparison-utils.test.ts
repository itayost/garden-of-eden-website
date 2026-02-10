import { describe, it, expect } from 'vitest';
import type { PlayerAssessment } from '@/types/assessment';
import {
  calculateDelta,
  isImprovement,
  formatDelta,
  getComparisonColor,
  compareAssessments,
  type AssessmentDelta,
  type ComparisonResult,
} from '../lib/comparison-utils';

// Helper to create mock assessment
function createMockAssessment(overrides: Partial<PlayerAssessment> = {}): PlayerAssessment {
  return {
    id: 'test-id',
    user_id: 'test-user',
    assessment_date: '2024-01-01',
    sprint_5m: null,
    sprint_10m: null,
    sprint_20m: null,
    jump_2leg_distance: null,
    jump_right_leg: null,
    jump_left_leg: null,
    jump_2leg_height: null,
    blaze_spot_time: null,
    flexibility_ankle: null,
    flexibility_knee: null,
    flexibility_hip: null,
    coordination: null,
    leg_power_technique: null,
    body_structure: null,
    kick_power_kaiser: null,
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
    assessed_by: null,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateDelta', () => {
  it('should return null when either value is null', () => {
    expect(calculateDelta(null, 5)).toBeNull();
    expect(calculateDelta(5, null)).toBeNull();
    expect(calculateDelta(null, null)).toBeNull();
  });

  it('should calculate positive delta correctly', () => {
    expect(calculateDelta(10, 15)).toBe(5);
  });

  it('should calculate negative delta correctly', () => {
    expect(calculateDelta(15, 10)).toBe(-5);
  });

  it('should calculate zero delta when values are equal', () => {
    expect(calculateDelta(10, 10)).toBe(0);
  });

  it('should handle decimal values', () => {
    const result = calculateDelta(1.5, 1.35);
    expect(result).toBeCloseTo(-0.15, 2);
  });
});

describe('isImprovement', () => {
  describe('for lower-is-better fields (sprint times)', () => {
    it('should return true when new value is lower (faster)', () => {
      expect(isImprovement('sprint_5m', -0.15)).toBe(true);
      expect(isImprovement('sprint_10m', -0.2)).toBe(true);
      expect(isImprovement('sprint_20m', -0.5)).toBe(true);
    });

    it('should return false when new value is higher (slower)', () => {
      expect(isImprovement('sprint_5m', 0.1)).toBe(false);
      expect(isImprovement('sprint_10m', 0.2)).toBe(false);
      expect(isImprovement('sprint_20m', 0.5)).toBe(false);
    });
  });

  describe('for blaze_spot_time (higher is better - hit count)', () => {
    it('should return true when count increased', () => {
      expect(isImprovement('blaze_spot_time', 5)).toBe(true);
    });

    it('should return false when count decreased', () => {
      expect(isImprovement('blaze_spot_time', -3)).toBe(false);
    });
  });

  describe('for higher-is-better fields (jumps, flexibility)', () => {
    it('should return true when value increased', () => {
      expect(isImprovement('jump_2leg_distance', 5)).toBe(true);
      expect(isImprovement('jump_right_leg', 3)).toBe(true);
      expect(isImprovement('jump_left_leg', 2)).toBe(true);
      expect(isImprovement('jump_2leg_height', 4)).toBe(true);
      expect(isImprovement('flexibility_ankle', 1)).toBe(true);
      expect(isImprovement('kick_power_kaiser', 5)).toBe(true);
    });

    it('should return false when value decreased', () => {
      expect(isImprovement('jump_2leg_distance', -5)).toBe(false);
      expect(isImprovement('jump_right_leg', -3)).toBe(false);
      expect(isImprovement('flexibility_hip', -2)).toBe(false);
    });
  });

  it('should return null when delta is 0', () => {
    expect(isImprovement('sprint_5m', 0)).toBeNull();
    expect(isImprovement('jump_2leg_distance', 0)).toBeNull();
  });

  it('should return null when delta is null', () => {
    expect(isImprovement('sprint_5m', null)).toBeNull();
  });
});

describe('formatDelta', () => {
  it('should format positive delta with + sign', () => {
    expect(formatDelta(5, 'jump_2leg_distance')).toBe('+5 ס"מ');
    expect(formatDelta(0.15, 'sprint_5m')).toBe('+0.15 שניות');
  });

  it('should format negative delta with - sign', () => {
    expect(formatDelta(-5, 'jump_2leg_distance')).toBe('-5 ס"מ');
    expect(formatDelta(-0.15, 'sprint_5m')).toBe('-0.15 שניות');
  });

  it('should return "ללא שינוי" for zero delta', () => {
    expect(formatDelta(0, 'sprint_5m')).toBe('ללא שינוי');
  });

  it('should return empty string for null delta', () => {
    expect(formatDelta(null, 'sprint_5m')).toBe('');
  });

  it('should include correct units for each field', () => {
    expect(formatDelta(10, 'kick_power_kaiser')).toBe('+10%');
    expect(formatDelta(-2, 'blaze_spot_time')).toBe('-2 פגיעות');
    expect(formatDelta(3, 'flexibility_knee')).toBe('+3 ס"מ');
  });

  it('should round to 2 decimal places', () => {
    expect(formatDelta(0.123456, 'sprint_5m')).toBe('+0.12 שניות');
  });
});

describe('getComparisonColor', () => {
  it('should return green for improvements', () => {
    expect(getComparisonColor(true)).toBe('green');
  });

  it('should return red for regressions', () => {
    expect(getComparisonColor(false)).toBe('red');
  });

  it('should return neutral for no change (null)', () => {
    expect(getComparisonColor(null)).toBe('neutral');
  });
});

describe('compareAssessments', () => {
  it('should compare all numeric fields between two assessments', () => {
    const older = createMockAssessment({
      id: 'old',
      assessment_date: '2024-01-01',
      sprint_5m: 1.5,
      sprint_10m: 2.5,
      jump_2leg_distance: 200,
      kick_power_kaiser: 70,
    });

    const newer = createMockAssessment({
      id: 'new',
      assessment_date: '2024-02-01',
      sprint_5m: 1.35, // improved (lower)
      sprint_10m: 2.7, // regressed (higher)
      jump_2leg_distance: 210, // improved (higher)
      kick_power_kaiser: 70, // no change
    });

    const result = compareAssessments(older, newer);

    expect(result.olderAssessment).toBe(older);
    expect(result.newerAssessment).toBe(newer);
    expect(result.deltas).toBeDefined();

    // Sprint 5m: improved (decreased by 0.15)
    expect(result.deltas.sprint_5m?.delta).toBeCloseTo(-0.15, 2);
    expect(result.deltas.sprint_5m?.isImprovement).toBe(true);

    // Sprint 10m: regressed (increased by 0.2)
    expect(result.deltas.sprint_10m?.delta).toBeCloseTo(0.2, 2);
    expect(result.deltas.sprint_10m?.isImprovement).toBe(false);

    // Jump 2leg: improved (increased by 10)
    expect(result.deltas.jump_2leg_distance?.delta).toBe(10);
    expect(result.deltas.jump_2leg_distance?.isImprovement).toBe(true);

    // Kick power: no change
    expect(result.deltas.kick_power_kaiser?.delta).toBe(0);
    expect(result.deltas.kick_power_kaiser?.isImprovement).toBeNull();
  });

  it('should handle null values gracefully', () => {
    const older = createMockAssessment({
      sprint_5m: 1.5,
      sprint_10m: null,
    });

    const newer = createMockAssessment({
      sprint_5m: null,
      sprint_10m: 2.5,
    });

    const result = compareAssessments(older, newer);

    expect(result.deltas.sprint_5m?.delta).toBeNull();
    expect(result.deltas.sprint_10m?.delta).toBeNull();
  });

  it('should compare categorical fields', () => {
    const older = createMockAssessment({
      coordination: 'basic',
      body_structure: 'thin_weak',
    });

    const newer = createMockAssessment({
      coordination: 'advanced',
      body_structure: 'good_build',
    });

    const result = compareAssessments(older, newer);

    expect(result.categoricalChanges.coordination).toEqual({
      oldValue: 'basic',
      newValue: 'advanced',
      changed: true,
    });

    expect(result.categoricalChanges.body_structure).toEqual({
      oldValue: 'thin_weak',
      newValue: 'good_build',
      changed: true,
    });
  });

  it('should count improvements and regressions', () => {
    const older = createMockAssessment({
      sprint_5m: 1.5,
      sprint_10m: 2.5,
      sprint_20m: 4.0,
      jump_2leg_distance: 200,
    });

    const newer = createMockAssessment({
      sprint_5m: 1.4, // improved
      sprint_10m: 2.6, // regressed
      sprint_20m: 3.8, // improved
      jump_2leg_distance: 205, // improved
    });

    const result = compareAssessments(older, newer);

    expect(result.summary.improvements).toBe(3);
    expect(result.summary.regressions).toBe(1);
    expect(result.summary.unchanged).toBe(0);
  });
});
