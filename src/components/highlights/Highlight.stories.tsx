import type { Story } from '@ladle/react';
import { HighlightOverlay, VISUAL_BLOCK_CLASS_ID } from './HighlightOverlay.tsx';
import type { HighlightOverlayProps } from './types.ts';

// Frame is 480x620 with p-8 (32px padding) and text-[13px] leading-relaxed,
// so each text line is ~21px tall and the first line starts at y≈32. The
// underline coords below place each highlight on a different odd-numbered
// line; the visual block wraps the same span so it visibly contains them.
const sharedProps: HighlightOverlayProps = {
  highlightId: 'testID',
  classId: 'testClassId',
  schemaId: 'testSchemaId',
  source: 'manual',
  color: 'rgba(142, 69, 177, 0.3)',
  positiveExample: true,
};

const visualRectProps: Partial<HighlightOverlayProps> = {
  highlightId: 'visual-block',
  classId: VISUAL_BLOCK_CLASS_ID,
  allCoords: [{ pageNumber: 1, left: 0.04, top: 0.113, width: 0.92, height: 0.286 }],
  positiveExample: true,
};

const mlAnnotationProps: Partial<HighlightOverlayProps> = {
  highlightId: 'provisional-ml',
  classId: 'testClassId',
  source: 'ml',
  allCoords: [{ pageNumber: 1, left: 0.08, top: 0.157, width: 0.55, height: 0.026 }],
  positiveExample: true,
};

const manualPositiveAnnotationProps: Partial<HighlightOverlayProps> = {
  highlightId: 'confirmed-positive',
  classId: 'testClassId',
  source: 'manual',
  allCoords: [{ pageNumber: 1, left: 0.08, top: 0.225, width: 0.55, height: 0.026 }],
  positiveExample: true,
};

const manualNegativeAnnotationProps: Partial<HighlightOverlayProps> = {
  highlightId: 'confirmed-negative',
  classId: 'testClassId',
  source: 'manual',
  allCoords: [{ pageNumber: 1, left: 0.08, top: 0.293, width: 0.55, height: 0.026 }],
  positiveExample: false,
};

function constructProps(overrides: Partial<HighlightOverlayProps>): HighlightOverlayProps {
  return { ...sharedProps, ...overrides };
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-[480px] h-[620px] border border-gray-300 bg-white p-8 overflow-hidden shadow-sm">
    <p className="text-[13px] leading-relaxed text-gray-800 select-none">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut
      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
      laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
      voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat
      non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut
      perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium,
      totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae
      vitae dicta sunt explicabo.
    </p>
    {children}
  </div>
);

export const VisualBlock: Story = () => (
  <Frame>
    <HighlightOverlay {...constructProps(visualRectProps)} />
  </Frame>
);

export const ProvisionalMl: Story = () => (
  <Frame>
    <HighlightOverlay {...constructProps(mlAnnotationProps)} />
  </Frame>
);

export const ConfirmedTextPositive: Story = () => (
  <Frame>
    <HighlightOverlay {...constructProps(manualPositiveAnnotationProps)} />
  </Frame>
);

export const ConfirmedTextNegative: Story = () => (
  <Frame>
    <HighlightOverlay {...constructProps(manualNegativeAnnotationProps)} />
  </Frame>
);

export const AllVariants: Story = () => (
  <Frame>
    <HighlightOverlay {...constructProps(visualRectProps)} />
    <HighlightOverlay {...constructProps(mlAnnotationProps)} />
    <HighlightOverlay {...constructProps(manualPositiveAnnotationProps)} />
    <HighlightOverlay {...constructProps(manualNegativeAnnotationProps)} />
  </Frame>
);
