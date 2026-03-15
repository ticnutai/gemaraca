import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';

const ThrowingChild = () => {
  throw new Error('Test error');
};

const GoodChild = () => <div>תוכן תקין</div>;

describe('SectionErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <SectionErrorBoundary section="test">
        <GoodChild />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('תוכן תקין')).toBeInTheDocument();
  });

  it('renders error fallback when child throws', () => {
    // Suppress console.error from the boundary
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SectionErrorBoundary section="ניווט">
        <ThrowingChild />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('שגיאה בטעינת ניווט')).toBeInTheDocument();
    expect(screen.getByText('נסה שוב')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('recovers when retry is clicked', () => {
    let shouldThrow = true;
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('boom');
      return <div>recovered</div>;
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <SectionErrorBoundary section="x">
        <MaybeThrow />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('נסה שוב')).toBeInTheDocument();
    // Fix the error and click retry
    shouldThrow = false;
    fireEvent.click(screen.getByText('נסה שוב'));
    rerender(
      <SectionErrorBoundary section="x">
        <MaybeThrow />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('recovered')).toBeInTheDocument();
    spy.mockRestore();
  });
});
