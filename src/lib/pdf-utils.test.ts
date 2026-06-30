import { describe, it, expect } from 'vitest';
import { isPdfUrl } from '@/lib/pdf-utils.ts';

// `describe` groups related tests and gives the output a readable heading.
// `it` (alias of `test`) is one individual test case; its string should read
// as a sentence: "it returns true for a plain .pdf extension".
describe('isPdfUrl', () => {
  // A fully worked example so you can see the anatomy: arrange an input,
  // act by calling the function, assert on the result with expect().
  it('returns true for a plain .pdf extension', () => {
    expect(isPdfUrl('https://example.com/report.pdf')).toBe(true);
  });

  it('rejects undefined', () => {
    expect(isPdfUrl(undefined)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isPdfUrl('')).toBe(false);
  });

  it('accepts capitalized PDF extensions', () => {
    expect(isPdfUrl('https://example.com/test.PDF')).toBe(true);
  });

  it('accepts a data: URI with application/pdf', () => {
    expect(isPdfUrl('data:application/pdf;base64,JVBERi0xLjQ=')).toBe(true);
  });

  it('accepts file:// urls', () => {
    expect(isPdfUrl('file:///Users/test/test2.pdf')).toBe(true);
  });

  it('accepts internal pdf urls', () => {
    expect(isPdfUrl('https://arxiv.org/pdf/2504.12495')).toBe(true);
  });

  it('accepts PDFs with query parameters', () => {
    expect(
      isPdfUrl(
        'https://pdf.sciencedirectassets.com/271630/1-s2.0-S0955221920X00124/1-s2.0-S0955221920302922/main.pdf?X-Amz-Security-Token=IQoJb3JpZ2luX2VjEEMaCXVzLWVhc3QtMSJHMEUCIQC9VrAuDVz9DXl1DTV075%2B5UiEBdAKZtBZkg3NfeOFS5wIgVvF8mrCbDkOGVOntCMMa3zxqfngNKb6FGUIwAFM6zk4qsgUICxAFGgwwNTkwMDM1NDY4NjUiDMLZE7n0%2FOHPxFNL0SqPBesoxC7RLN62o1maZfihu5wqVB1cH3tXP4q%2FlxLK0vDwHtR5%2FHW6DikkTHAaB%2FrbcSIYngeaZK9oFhvV2UnnyHzXkGyOItKAJYPZ6ofMGgPFn%2F8Wtai8Y2tYdp1qEF7MTUJUpAU4dw53cbQM6fOsn6yEcW2UHMa4yEb4mRG8vKzvp5moRoEKX5bwE7RkZsk%2BTAKrn%2BnDsX72X6PxGP6YSPQjYFX%2BqSizR7Z4Oez5uXjK1Zf%2FVGlRp3vaKAZMuZU9GBhWWFT7kjfyt9LU5ZsCKwBue%2F%2BVXRXpvyL7aCPBKf%2FEnhWk%2BxpfGYdF5CKx6gayCGiTr9ydf356P4yTLFww%2BiarV9vGjUBDv46UM41swI2AxVyQ9qdmLsh3xILsMeJjGmux%2B8UILRe0wtRAGq6ezuSUi2iky5umao2FfPiNkE8%2F886jveSRvRv8%2Fjb3RHYiVySxVSTgrtY3vX5%2BAJyLi741PaupWdvKzzXOiWrnX0kDaVPjrQvzCwo81Cn3XREmYWxKmEvXywZSOnLHLTp0OFj7OzB4FwiHI3tFmrui9MIyUkH55uaDMmNT9BCEFJ5zM7uFHrl3EW%2B1rpd7asBTFCzydXM0UfrzdZrlRSM12I0T5jdZ%2Bvp%2Fq%2BYeW9SRsltNPZCPOB0VLyO2J95PwcsU%2BRRFhleSH6m8DW7Qi0SRJeVwcIL%2F%2BInUciJ6BDMIrXjWokvEfth%2FKkqaGTfVpnVDFGe4b%2Blqup5st9dDturLQRP9y31ziXVS9g0wenH4%2F9nQfu4AzJUkuChSKyqoLq43%2BKbF5E9rIskxmDwugSpGl1yxOJ7q%2FzfhS20ULIzuLQ66mXNSqUcilHSxajWqhjRDX7jwbUdvQT3PyDmZk768fgAwu%2Fjl0QY6sQEfCXdcha8iPXW4Ww44vcWTV2q7KmxUoRFs7MKmvLnKgXP8k7UGJLkYRKWfSkyPAfQ%2BgrJTdlxPPOX%2BMRjA46WJ71cXZbQEwS7MFRTY%2FjyxFvnRVorq6p8hBbf4%2BQiD21SockQwHRK1izojqaGi39Yzn6kXG7ZQMxsHD94W3whz7I3b6PpmblVnYlP0LjzOPuKIZda7SLVvFzYXgEnMZCuwtW%2F0UMCimIVG2fKBHfx7FFo%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260622T185106Z&X-Amz-SignedHeaders=host&X-Amz-Expires=300&X-Amz-Credential=ASIAQ3PHCVTY5IVPX3YG%2F20260622%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=54f9bcd8b63fa71c80a78250ab6d24235796784803ec9a37fa4c15dacf590f4d&hash=31c39461121ea5c6b9379b465989411bb734ec8497a1e520b6bf54ffc150969d&host=68042c943591013ac2b2430a89b270f6af2c76d8dfd086a07176afe7c76c2c61&pii=S0955221920302922&tid=spdf-76433389-b427-477b-81e9-cbbd75b2b6e1&sid=0944cd69494bc043954930a9bcab560fe2afgxrqa&type=client&tsoh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&rh=d3d3LnNjaWVuY2VkaXJlY3QuY29t&ua=0f1500540000535e525605&rr=a0fd7147ef41d46f&cc=us',
      ),
    ).toBe(true);
  });

  it('accepts PDFs with page numbers', () => {
    expect(isPdfUrl('https://arxiv.org/pdf/2504.12495#page=4')).toBe(true);
  });
});
