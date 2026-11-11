import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchInput } from '../components/ui/SearchInput';

describe('SearchInput', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces input changes and does not snap back after clicking Clear', () => {
    vi.useFakeTimers();
    const observed: string[] = [];

    function ControlledSearch() {
      const [value, setValue] = useState('');
      return (
        <SearchInput
          value={value}
          debounceMs={300}
          onChange={(next) => {
            observed.push(next);
            setValue(next);
          }}
        />
      );
    }

    render(<ControlledSearch />);
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'UltraBook' } });
    expect(input.value).toBe('UltraBook');
    expect(observed).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(observed).toEqual(['UltraBook']);

    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(input.value).toBe('');
    expect(observed).toEqual(['UltraBook', '']);

    // Wait well past debounce window — should never re-emit 'UltraBook'
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(input.value).toBe('');
    expect(observed).toEqual(['UltraBook', '']);
  });

  it('cancels pending debounce when cleared immediately before debounce fires', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    render(<SearchInput debounceMs={300} onChange={onChange} />);
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Keyboard' } });
    fireEvent.click(screen.getByLabelText('Clear search'));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
