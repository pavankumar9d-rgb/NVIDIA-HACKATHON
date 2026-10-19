import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from '../src/lib/animation/useCountUp';

describe('useCountUp Presentation Hook', () => {
  it('returns target value on initialization or when motion is reduced', () => {
    const { result } = renderHook(() => useCountUp(5000000, { duration: 0 }));
    // When duration is 0 or immediately settled
    expect(result.current).toBe(5000000);
  });

  it('settles to exact integer target value', async () => {
    const { result } = renderHook(() => useCountUp(47638000, { duration: 50, startValue: 47600000 }));
    expect(typeof result.current).toBe('number');
    
    // Wait for animation frame loop to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    expect(result.current).toBe(47638000);
  });
});

