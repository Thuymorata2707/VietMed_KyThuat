import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  nextDefaultStatus,
  matchesFilter,
  isTodayTask,
  isOverdueTask,
  isUpcomingTask,
  taskAttention,
} from '../utils';
import type { EngineerTask } from '../types';

// ── helpers ──────────────────────────────────────────────
// Default kind is 'maintenance' → taskDateValue uses scheduledDate,
// and machine is truthy so needsMachineProfile returns false.

function task(overrides: Partial<EngineerTask> & { status: string }): EngineerTask {
  const { status, ...rest } = overrides;
  return {
    kind: 'maintenance',
    id: 't1',
    code: 'M-001',
    status,
    reviewStatus: overrides.reviewStatus ?? null,
    reviewNote: overrides.reviewNote ?? null,
    type: 'PERIODIC',
    machine: {},
    ...rest,
  } as EngineerTask;
}

// ── nextDefaultStatus ────────────────────────────────────

describe('nextDefaultStatus', () => {
  it('returns current status for COMPLETED', () => {
    expect(nextDefaultStatus(task({ status: 'COMPLETED' }))).toBe('COMPLETED');
  });

  it('returns current status for CANCELLED', () => {
    expect(nextDefaultStatus(task({ status: 'CANCELLED' }))).toBe('CANCELLED');
  });

  it('returns current status for INSTALLED (installation)', () => {
    expect(nextDefaultStatus(task({ kind: 'installation', status: 'INSTALLED' }))).toBe('INSTALLED');
  });

  it('returns IN_PROGRESS for ASSIGNED', () => {
    expect(nextDefaultStatus(task({ status: 'ASSIGNED' }))).toBe('IN_PROGRESS');
  });

  it('returns IN_PROGRESS for SCHEDULED', () => {
    expect(nextDefaultStatus(task({ status: 'SCHEDULED' }))).toBe('IN_PROGRESS');
  });

  it('returns COMPLETED for IN_PROGRESS', () => {
    expect(nextDefaultStatus(task({ status: 'IN_PROGRESS' }))).toBe('COMPLETED');
  });

  it('returns IN_PROGRESS for PENDING', () => {
    expect(nextDefaultStatus(task({ status: 'PENDING' }))).toBe('IN_PROGRESS');
  });

  it('returns IN_PROGRESS for WAITING_PARTS', () => {
    expect(nextDefaultStatus(task({ status: 'WAITING_PARTS' }))).toBe('IN_PROGRESS');
  });
});

// ── matchesFilter ───────────────────────────────────────

describe('matchesFilter', () => {
  it('all matches everything', () => {
    expect(matchesFilter(task({ status: 'COMPLETED' }), 'all')).toBe(true);
    expect(matchesFilter(task({ status: 'PENDING' }), 'all')).toBe(true);
  });

  it('done matches terminal statuses', () => {
    expect(matchesFilter(task({ status: 'COMPLETED' }), 'done')).toBe(true);
    expect(matchesFilter(task({ status: 'CANCELLED' }), 'done')).toBe(true);
    expect(matchesFilter(task({ kind: 'installation', status: 'INSTALLED' }), 'done')).toBe(true);
    expect(matchesFilter(task({ status: 'IN_PROGRESS' }), 'done')).toBe(false);
  });

  it('action shows NEEDS_REVISION tasks even if terminal', () => {
    expect(matchesFilter(task({ status: 'COMPLETED', reviewStatus: 'NEEDS_REVISION' }), 'action')).toBe(true);
  });

  it('action shows non-terminal tasks not PENDING', () => {
    expect(matchesFilter(task({ status: 'IN_PROGRESS', reviewStatus: null }), 'action')).toBe(true);
  });

  it('action hides APPROVED + terminal tasks', () => {
    expect(matchesFilter(task({ status: 'COMPLETED', reviewStatus: 'APPROVED' }), 'action')).toBe(false);
  });

  it('action hides PENDING review tasks', () => {
    expect(matchesFilter(task({ status: 'IN_PROGRESS', reviewStatus: 'PENDING' }), 'action')).toBe(false);
  });

  it('review shows PENDING only', () => {
    expect(matchesFilter(task({ status: 'COMPLETED', reviewStatus: 'PENDING' }), 'review')).toBe(true);
    expect(matchesFilter(task({ status: 'COMPLETED', reviewStatus: 'APPROVED' }), 'review')).toBe(false);
    expect(matchesFilter(task({ status: 'COMPLETED', reviewStatus: 'NEEDS_REVISION' }), 'review')).toBe(false);
  });

  it('revision shows NEEDS_REVISION only', () => {
    expect(matchesFilter(task({ status: 'COMPLETED', reviewStatus: 'NEEDS_REVISION' }), 'revision')).toBe(true);
    expect(matchesFilter(task({ status: 'COMPLETED', reviewStatus: 'PENDING' }), 'revision')).toBe(false);
  });

  it('progress shows IN_PROGRESS and WAITING_PARTS', () => {
    expect(matchesFilter(task({ status: 'IN_PROGRESS' }), 'progress')).toBe(true);
    expect(matchesFilter(task({ status: 'WAITING_PARTS' }), 'progress')).toBe(true);
    expect(matchesFilter(task({ status: 'COMPLETED' }), 'progress')).toBe(false);
  });
});

// ── isTodayTask ──────────────────────────────────────────
// Default kind is 'maintenance' → taskDateValue uses scheduledDate

describe('isTodayTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a non-terminal task scheduled today', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-08' });
    expect(isTodayTask(t)).toBe(true);
  });

  it('returns false for a COMPLETED task today', () => {
    const t = task({ status: 'COMPLETED', scheduledDate: '2026-07-08' });
    expect(isTodayTask(t)).toBe(false);
  });

  it('returns false for a CANCELLED task today', () => {
    const t = task({ status: 'CANCELLED', scheduledDate: '2026-07-08' });
    expect(isTodayTask(t)).toBe(false);
  });

  it('returns false for an INSTALLED installation today', () => {
    const t = task({ kind: 'installation', status: 'INSTALLED', installedAt: '2026-07-08' });
    expect(isTodayTask(t)).toBe(false);
  });

  it('returns false for a task on a different date', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-09' });
    expect(isTodayTask(t)).toBe(false);
  });

  it('returns false when task has no date', () => {
    const t = task({ status: 'IN_PROGRESS' });
    expect(isTodayTask(t)).toBe(false);
  });
});

// ── isOverdueTask ────────────────────────────────────────

describe('isOverdueTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a past-due non-terminal task', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-07' });
    expect(isOverdueTask(t)).toBe(true);
  });

  it('returns false for a terminal task even if past', () => {
    const t = task({ status: 'COMPLETED', scheduledDate: '2026-07-07' });
    expect(isOverdueTask(t)).toBe(false);
  });

  it('returns false for today', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-08' });
    expect(isOverdueTask(t)).toBe(false);
  });

  it('returns false for future date', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-09' });
    expect(isOverdueTask(t)).toBe(false);
  });
});

// ── isUpcomingTask ──────────────────────────────────────

describe('isUpcomingTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a task within next 7 days', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-12' });
    expect(isUpcomingTask(t)).toBe(true);
  });

  it('returns false for terminal task', () => {
    const t = task({ status: 'COMPLETED', scheduledDate: '2026-07-12' });
    expect(isUpcomingTask(t)).toBe(false);
  });

  it('returns true for today (today is within next 7 days)', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-08' });
    expect(isUpcomingTask(t)).toBe(true);
  });

  it('returns false for a past date', () => {
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-07' });
    expect(isUpcomingTask(t)).toBe(false);
  });
});

// ── taskAttention ────────────────────────────────────────
// Default task has machine: {} → needsMachineProfile returns false

describe('taskAttention', () => {
  it('NEEDS_REVISION returns danger label', () => {
    const t = task({ status: 'COMPLETED', reviewStatus: 'NEEDS_REVISION' });
    expect(taskAttention(t)).toEqual({ label: 'Bổ sung theo phản hồi admin', tone: 'danger' });
  });

  it('overdue returns danger label', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T10:00:00'));
    const t = task({ status: 'ASSIGNED', scheduledDate: '2026-07-07', reviewStatus: null });
    expect(taskAttention(t).label).toBe('Quá hạn, xử lý trước');
    expect(taskAttention(t).tone).toBe('danger');
    vi.useRealTimers();
  });

  it('PENDING review returns good label', () => {
    const t = task({ status: 'COMPLETED', reviewStatus: 'PENDING' });
    expect(taskAttention(t)).toEqual({ label: 'Đã gửi, chờ admin duyệt', tone: 'good' });
  });

  it('terminal without review returns neutral label', () => {
    const t = task({ status: 'COMPLETED', reviewStatus: null });
    expect(taskAttention(t)).toEqual({ label: 'Đã hoàn tất', tone: 'neutral' });
  });

  it('APPROVED + terminal returns neutral label', () => {
    const t = task({ status: 'COMPLETED', reviewStatus: 'APPROVED' });
    expect(taskAttention(t)).toEqual({ label: 'Đã hoàn tất', tone: 'neutral' });
  });

  it('non-terminal with no special flags returns neutral', () => {
    const t = task({ status: 'ASSIGNED', reviewStatus: null });
    expect(taskAttention(t)).toEqual({ label: 'Cập nhật kết quả hiện trường', tone: 'neutral' });
  });
});
