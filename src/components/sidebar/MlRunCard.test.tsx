// @vitest-environment jsdom
// ^ Opts this file into the jsdom DOM environment (the default env is 'node').
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MlRunCard } from './MlRunCard';
import type { MlAnnotation, MlAnnotationRun } from '@/lib/definitions.ts';

// Fully-shaped fixtures with overridable defaults, same factory pattern as the
// reducer/navigator tests — keeps fixtures honest to the real types.
function makeAnnotation(overrides: Partial<MlAnnotation> = {}): MlAnnotation {
  return {
    id: 'a1',
    text: 'some text',
    className: 'Some Class',
    classId: 'c1',
    coords: [],
    pdfUrl: 'doc.pdf',
    blockId: 'b1',
    createdAt: 0,
    ...overrides,
  };
}

function makeRun(overrides: Partial<MlAnnotationRun> = {}): MlAnnotationRun {
  return {
    id: 'run-1',
    pdfUrl: 'doc.pdf',
    schemaId: 's1',
    annotations: [makeAnnotation()],
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('MlRunCard', () => {
  it('renders the run time as a locale string', () => {
    const createdAt = 1_700_000_000_000;
    render(<MlRunCard run={makeRun({ createdAt })} />);

    // Compute the expected the same way the component does, so the assertion is
    // independent of the test runner's locale/timezone.
    expect(screen.getByText(new Date(createdAt).toLocaleString())).toBeInTheDocument();
  });

  it('pluralizes the highlight count, and uses the singular for exactly one', () => {
    const { rerender } = render(
      <MlRunCard run={makeRun({ annotations: [makeAnnotation(), makeAnnotation({ id: 'a2' })] })} />,
    );
    expect(screen.getByText('2 highlights')).toBeInTheDocument();

    rerender(<MlRunCard run={makeRun({ annotations: [makeAnnotation()] })} />);
    expect(screen.getByText('1 highlight')).toBeInTheDocument();

    rerender(<MlRunCard run={makeRun({ annotations: [] })} />);
    expect(screen.getByText('0 highlights')).toBeInTheDocument();
  });

  it('shows a placeholder for the schema version while the snapshot link is unbuilt', () => {
    render(<MlRunCard run={makeRun()} />);
    expect(screen.getByText(/Schema version:\s*not yet tracked/)).toBeInTheDocument();
  });

  it('shows the snapshot label once one is supplied', () => {
    render(<MlRunCard run={makeRun()} snapshotLabel="v3 — Before export" />);
    expect(screen.getByText(/Schema version:\s*v3 — Before export/)).toBeInTheDocument();
    expect(screen.queryByText(/not yet tracked/)).not.toBeInTheDocument();
  });
});
