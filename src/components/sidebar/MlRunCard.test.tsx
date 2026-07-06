// @vitest-environment jsdom
// ^ Opts this file into the jsdom DOM environment (the default env is 'node').
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
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

  it('shows the run nickname as the title, with the timestamp beneath', () => {
    const createdAt = 1_700_000_000_000;
    render(<MlRunCard run={makeRun({ name: 'warily-poked', createdAt })} />);

    expect(screen.getByText('warily-poked')).toBeInTheDocument();
    // Timestamp still present as the secondary line.
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

  it('reports the derived schema-version label passed by the caller', () => {
    render(<MlRunCard run={makeRun()} schemaVersion="amber-ledger" />);
    expect(screen.getByText(/Schema version:\s*amber-ledger/)).toBeInTheDocument();
  });

  it('falls back to "not recorded" when no schema version is resolved', () => {
    render(<MlRunCard run={makeRun()} />);
    expect(screen.getByText(/Schema version:\s*not recorded/)).toBeInTheDocument();
  });

  describe('model', () => {
    it('names the model used for the run', () => {
      render(<MlRunCard run={makeRun({ model: { provider: 'anthropic', model: 'claude-opus-4-8' } })} />);
      expect(screen.getByText(/Model:\s*claude-opus-4-8/)).toBeInTheDocument();
    });

    it('falls back to "not recorded" for runs predating model capture', () => {
      render(<MlRunCard run={makeRun()} />); // no model field
      expect(screen.getByText(/Model:\s*not recorded/)).toBeInTheDocument();
      // With no model there's nothing to disclose.
      expect(screen.queryByRole('button', { name: /config/i })).not.toBeInTheDocument();
    });

    it('hides the config behind a disclosure, revealing it on click', async () => {
      const user = userEvent.setup();
      render(
        <MlRunCard
          run={makeRun({
            model: {
              provider: 'anthropic',
              model: 'claude-opus-4-8',
              baseUrl: 'https://proxy.example.com',
            },
          })}
        />,
      );

      // Collapsed by default: config values are not shown yet.
      const toggle = screen.getByRole('button', { name: /config/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('https://proxy.example.com')).not.toBeInTheDocument();

      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('https://proxy.example.com')).toBeInTheDocument();
      expect(screen.getByText('Anthropic Compatible')).toBeInTheDocument(); // friendly provider label
    });
  });
});
