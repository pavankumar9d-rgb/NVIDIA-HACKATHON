import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act, render, screen, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
import React from 'react';
import { useCountUp } from '../src/lib/animation/useCountUp';
import { DailyMovementChart } from '../src/components/charts/DailyMovementChart';
import { ReconciliationCompositionChart } from '../src/components/charts/ReconciliationCompositionChart';
import type { DailyMovementBucket, CompositionSegment } from '../src/lib/reconciliation/analytics';

describe('useCountUp Presentation Hook', () => {
  it('returns target value on initialization or when motion is reduced', () => {
    const { result } = renderHook(() => useCountUp(5000000, { duration: 0 }));
    expect(result.current).toBe(5000000);
  });

  it('settles to exact integer target value', async () => {
    const { result } = renderHook(() => useCountUp(47638000, { duration: 50, startValue: 47600000 }));
    expect(typeof result.current).toBe('number');
    
    // Wait for animation frame loop to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current).toBe(47638000);
  });
});

describe('Chart Animation and Entrance Motion', () => {
  const mockDailyData: DailyMovementBucket[] = [
    {
      date: '2026-09-01',
      displayDate: '01 Sep',
      bankInflowPaise: 1500000,
      bankOutflowPaise: 500000,
      ledgerInflowPaise: 1500000,
      ledgerOutflowPaise: 500000,
      netBankPaise: 1000000,
      bankCount: 3,
      ledgerCount: 3,
    },
    {
      date: '2026-09-02',
      displayDate: '02 Sep',
      bankInflowPaise: 800000,
      bankOutflowPaise: 1200000,
      ledgerInflowPaise: 800000,
      ledgerOutflowPaise: 1200000,
      netBankPaise: -400000,
      bankCount: 2,
      ledgerCount: 2,
    },
  ];

  const mockSegments: CompositionSegment[] = [
    {
      key: 'CONFIRMED',
      label: 'Confirmed Matches',
      count: 20,
      percentage: 80,
      color: '#17845B',
      hoverColor: '#136c4b',
      volumePaise: 50000000,
      filterType: 'CONFIRMED',
    },
    {
      key: 'AMOUNT_MISMATCH',
      label: 'Amount Variance',
      count: 2,
      percentage: 10,
      color: '#D75E4C',
      hoverColor: '#b54737',
      volumePaise: 24000,
      filterType: 'AMOUNT_MISMATCH',
    },
  ];

  it('DailyMovementChart renders upward animate elements with stagger for bars', () => {
    const { container } = render(React.createElement(DailyMovementChart, { data: mockDailyData }));
    
    // SVG role present
    const svg = screen.getByRole('img', { name: /Daily Inflow and Outflow Cash Movements Chart/i });
    expect(svg).toBeDefined();

    // Inflow and outflow bars have animate tags for height and y from baseline
    const animates = container.querySelectorAll('rect animate');
    expect(animates.length).toBeGreaterThan(0);

    const heightAnimates = Array.from(animates).filter((a) => a.getAttribute('attributeName') === 'height');
    const yAnimates = Array.from(animates).filter((a) => a.getAttribute('attributeName') === 'y');

    expect(heightAnimates.length).toBeGreaterThan(0);
    expect(yAnimates.length).toBeGreaterThan(0);

    // Height animates from 0
    expect(heightAnimates[0].getAttribute('from')).toBe('0');
    // y animates from baseline
    expect(Number(yAnimates[0].getAttribute('from'))).toBeGreaterThan(100);

    // Subtle stagger exists: begin times increase with index
    const begins = heightAnimates.map((a) => parseFloat(a.getAttribute('begin') || '0'));
    if (begins.length > 2) {
      expect(begins[begins.length - 1]).toBeGreaterThanOrEqual(begins[0]);
    }
  });

  it('DailyMovementChart renders net connecting line with smooth reveal clipPath', () => {
    const { container } = render(React.createElement(DailyMovementChart, { data: mockDailyData }));
    
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeDefined();
    expect(polyline?.getAttribute('clip-path') || polyline?.getAttribute('clipPath')).toMatch(/net-reveal/);
    
    const clipRect = container.querySelector('clipPath rect');
    expect(clipRect).toBeDefined();
    const clipAnimate = clipRect?.querySelector('animate');
    expect(clipAnimate?.getAttribute('attributeName')).toBe('width');
    expect(clipAnimate?.getAttribute('from')).toBe('0');
  });

  it('ReconciliationCompositionChart renders multi-segment horizontal progressbar', () => {
    render(React.createElement(ReconciliationCompositionChart, { segments: mockSegments }));
    
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeDefined();

    const buttons = progressbar.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('aria-label')).toContain('Confirmed Matches: 20 (80%)');
  });
});
