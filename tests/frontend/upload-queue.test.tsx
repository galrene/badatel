import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { UploadProvider, useUploadQueue } from '../../src/context/UploadContext';
import * as api from '../../src/api';

vi.mock('../../src/api', () => ({
  computeFileHash: vi.fn(),
  checkDuplicateHashes: vi.fn(),
  uploadFileWithProgress: vi.fn()
}));

const TestConsumer: React.FC = () => {
  const {
    tasks,
    activeCount,
    queuedCount,
    completedCount,
    enqueueUploads,
    cancelUpload,
    clearCompleted
  } = useUploadQueue();

  return (
    <div>
      <span data-testid="active-count">{activeCount}</span>
      <span data-testid="queued-count">{queuedCount}</span>
      <span data-testid="completed-count">{completedCount}</span>
      <button
        data-testid="enqueue-btn"
        onClick={() => {
          const f1 = new File(['1'], 'blueprint-1.png', { type: 'image/png' });
          const f2 = new File(['2'], 'blueprint-2.png', { type: 'image/png' });
          const f3 = new File(['3'], 'blueprint-3.png', { type: 'image/png' });
          enqueueUploads([f1, f2, f3], { target: 'doc', targetId: 'b-test-1', targetName: '[A] Test Block' });
        }}
      >
        Enqueue 3 Files
      </button>
      <button
        data-testid="cancel-first-btn"
        onClick={() => {
          if (tasks[0]) cancelUpload(tasks[0].id);
        }}
      >
        Cancel First
      </button>
      <button data-testid="clear-completed-btn" onClick={clearCompleted}>
        Clear Completed
      </button>
      <ul data-testid="tasks-list">
        {tasks.map(t => (
          <li key={t.id} data-testid={`task-${t.filename}`}>
            {t.filename}:{t.status}
          </li>
        ))}
      </ul>
    </div>
  );
};

describe('Frontend: Global Upload Queue Pipeline (WF-6, WF-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues files, processes duplicates, and enforces concurrency limit of 2', async () => {
    vi.mocked(api.computeFileHash).mockResolvedValue('hash123');
    vi.mocked(api.checkDuplicateHashes).mockResolvedValue([
      { hash: 'hash123', exists: false }
    ]);

    let resolveUpload1: any;
    const upload1Promise = new Promise(resolve => { resolveUpload1 = resolve; });

    vi.mocked(api.uploadFileWithProgress)
      .mockImplementationOnce(() => upload1Promise as any)
      .mockResolvedValue({
        url: '/uploads/blueprint-2.png',
        filename: 'blueprint-2.png',
        width: 800,
        height: 600
      });

    const onDocumentCompleted = vi.fn();

    render(
      <UploadProvider onDocumentCompleted={onDocumentCompleted}>
        <TestConsumer />
      </UploadProvider>
    );

    // Enqueue 3 files
    fireEvent.click(screen.getByTestId('enqueue-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('task-blueprint-1.png')).toBeInTheDocument();
      expect(screen.getByTestId('task-blueprint-2.png')).toBeInTheDocument();
      expect(screen.getByTestId('task-blueprint-3.png')).toBeInTheDocument();
    });

    // Task 1 remains uploading, while tasks 2 and 3 have completed
    await waitFor(() => {
      const activeCount = Number(screen.getByTestId('active-count').textContent);
      const completedCount = Number(screen.getByTestId('completed-count').textContent);
      expect(activeCount).toBe(1);
      expect(completedCount).toBe(2);
      expect(screen.getByTestId('task-blueprint-1.png')).toHaveTextContent(/blueprint-1\.png:\s*uploading/);
      expect(screen.getByTestId('task-blueprint-2.png')).toHaveTextContent(/blueprint-2\.png:\s*completed/);
      expect(screen.getByTestId('task-blueprint-3.png')).toHaveTextContent(/blueprint-3\.png:\s*completed/);
    });

    // Finish upload 1
    await act(async () => {
      resolveUpload1({
        url: '/uploads/blueprint-1.png',
        filename: 'blueprint-1.png',
        width: 1000,
        height: 800
      });
    });

    await waitFor(() => {
      expect(onDocumentCompleted).toHaveBeenCalled();
    });
  });

  it('handles deduplication by directly completing without calling uploadFileWithProgress', async () => {
    vi.mocked(api.computeFileHash).mockResolvedValue('existing-hash');
    vi.mocked(api.checkDuplicateHashes).mockResolvedValue([
      {
        hash: 'existing-hash',
        exists: true,
        deduplicated: true,
        url: '/uploads/existing-doc.png',
        filename: 'existing-doc.png',
        width: 1200,
        height: 900
      }
    ]);

    const onDocumentCompleted = vi.fn();

    render(
      <UploadProvider onDocumentCompleted={onDocumentCompleted}>
        <TestConsumer />
      </UploadProvider>
    );

    fireEvent.click(screen.getByTestId('enqueue-btn'));

    await waitFor(() => {
      expect(onDocumentCompleted).toHaveBeenCalledWith(
        'b-test-1',
        expect.objectContaining({
          url: '/uploads/existing-doc.png',
          title: expect.stringContaining('blueprint')
        })
      );
    });

    // Verify uploadFileWithProgress was not invoked for deduplicated file
    expect(api.uploadFileWithProgress).not.toHaveBeenCalled();
  });
});
