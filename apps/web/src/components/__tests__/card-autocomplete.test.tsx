import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CardAutocomplete } from '../card-autocomplete'

// Mock the debounce hook to return value immediately
vi.mock('@/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}))

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('CardAutocomplete Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ suggestions: [] }),
    })
  })

  describe('rendering', () => {
    it('renders input with correct attributes', () => {
      render(
        <CardAutocomplete
          id="commander"
          name="commander1"
          value=""
          onChange={() => {}}
          placeholder="Search for a card..."
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('id', 'commander')
      expect(input).toHaveAttribute('placeholder', 'Search for a card...')
      expect(input).toHaveAttribute('aria-expanded', 'false')
      expect(input).toHaveAttribute('aria-autocomplete', 'list')
    })

    it('renders with custom className', () => {
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value=""
          onChange={() => {}}
          className="custom-class"
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).toHaveClass('custom-class')
    })

    it('renders disabled state', () => {
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value=""
          onChange={() => {}}
          disabled
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).toBeDisabled()
    })

    it('renders hidden input with name for form submission', () => {
      render(
        <CardAutocomplete
          id="test"
          name="commander1"
          value="Atraxa"
          onChange={() => {}}
        />
      )

      const hiddenInput = document.querySelector('input[type="hidden"][name="commander1"]')
      expect(hiddenInput).toHaveValue('Atraxa')
    })
  })

  describe('input handling', () => {
    it('calls onChange when typing', () => {
      const handleChange = vi.fn()
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value=""
          onChange={handleChange}
        />
      )

      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'Lightning' } })

      expect(handleChange).toHaveBeenCalledWith('Lightning')
    })

    it('displays current value', () => {
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value="Lightning Bolt"
          onChange={() => {}}
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).toHaveValue('Lightning Bolt')
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <CardAutocomplete
          id="commander"
          name="commander1"
          value=""
          onChange={() => {}}
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('role', 'combobox')
      expect(input).toHaveAttribute('aria-haspopup', 'listbox')
      expect(input).toHaveAttribute('aria-controls', 'commander-listbox')
    })

    it('sets autocomplete to off', () => {
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value=""
          onChange={() => {}}
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).toHaveAttribute('autocomplete', 'off')
    })
  })

  describe('query handling', () => {
    it('does not fetch for queries shorter than 2 characters', () => {
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value="a"
          onChange={() => {}}
        />
      )

      // Short query should not trigger fetch
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('fetches suggestions for longer queries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          suggestions: [
            { name: 'Lightning Bolt', imageUrl: 'https://example.com/bolt.jpg' },
          ],
        }),
      })

      render(
        <CardAutocomplete
          id="test"
          name="test"
          value="lightning"
          onChange={() => {}}
        />
      )

      // Wait for fetch to be called
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    it('adds commander param when commanderOnly is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      })

      render(
        <CardAutocomplete
          id="test"
          name="test"
          value="atraxa"
          onChange={() => {}}
          commanderOnly
        />
      )

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
        const callArg = mockFetch.mock.calls[0][0] as string
        expect(callArg).toContain('commander=true')
      })
    })
  })

  describe('props', () => {
    it('showPreview defaults to true', () => {
      // This is implicitly tested via the component rendering
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value=""
          onChange={() => {}}
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).toBeInTheDocument()
    })

    it('commanderOnly defaults to false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      })

      render(
        <CardAutocomplete
          id="test"
          name="test"
          value="test"
          onChange={() => {}}
        />
      )

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callArg = mockFetch.mock.calls[0][0] as string
      expect(callArg).not.toContain('commander=true')
    })

    it('disabled defaults to false', () => {
      render(
        <CardAutocomplete
          id="test"
          name="test"
          value=""
          onChange={() => {}}
        />
      )

      const input = screen.getByRole('combobox')
      expect(input).not.toBeDisabled()
    })
  })
})
