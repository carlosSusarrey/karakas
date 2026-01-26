import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommanderImage } from '../commander-image'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, fill, className, sizes }: {
    src: string
    alt: string
    fill?: boolean
    className?: string
    sizes?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-fill={fill}
      data-sizes={sizes}
    />
  ),
}))

// Mock scryfall lib
vi.mock('@/lib/scryfall', () => ({
  getCardImageUrl: vi.fn(),
}))

import { getCardImageUrl } from '@/lib/scryfall'

describe('CommanderImage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when image is available', () => {
    it('renders image with correct src and alt', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/atraxa.jpg')

      const component = await CommanderImage({ commanderName: 'Atraxa, Praetors\' Voice' })
      render(component)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/atraxa.jpg')
      expect(img).toHaveAttribute('alt', 'Atraxa, Praetors\' Voice')
    })

    it('applies default medium size class', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({ commanderName: 'Test Commander' })
      const { container } = render(component)

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('w-24')
      expect(wrapper).toHaveClass('h-32')
    })

    it('applies small size class', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Test Commander',
        size: 'small',
      })
      const { container } = render(component)

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('w-12')
      expect(wrapper).toHaveClass('h-16')
    })

    it('applies large size class', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Test Commander',
        size: 'large',
      })
      const { container } = render(component)

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('w-48')
      expect(wrapper).toHaveClass('h-64')
    })

    it('applies custom className', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Test Commander',
        className: 'custom-class',
      })
      const { container } = render(component)

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('custom-class')
    })

    it('sets correct sizes for small images', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Test Commander',
        size: 'small',
      })
      render(component)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('data-sizes', '48px')
    })

    it('sets correct sizes for medium images', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Test Commander',
        size: 'medium',
      })
      render(component)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('data-sizes', '96px')
    })

    it('sets correct sizes for large images', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Test Commander',
        size: 'large',
      })
      render(component)

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('data-sizes', '192px')
    })
  })

  describe('when image is not available', () => {
    it('renders placeholder when getCardImageUrl returns null', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue(null)

      const component = await CommanderImage({ commanderName: 'Unknown Commander' })
      render(component)

      expect(screen.getByText('No image')).toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('applies size class to placeholder', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue(null)

      const component = await CommanderImage({
        commanderName: 'Unknown Commander',
        size: 'large',
      })
      const { container } = render(component)

      const placeholder = container.firstChild
      expect(placeholder).toHaveClass('w-48')
      expect(placeholder).toHaveClass('h-64')
    })

    it('applies custom className to placeholder', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue(null)

      const component = await CommanderImage({
        commanderName: 'Unknown Commander',
        className: 'custom-placeholder',
      })
      const { container } = render(component)

      const placeholder = container.firstChild
      expect(placeholder).toHaveClass('custom-placeholder')
    })

    it('renders placeholder with correct background color', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue(null)

      const component = await CommanderImage({ commanderName: 'Unknown Commander' })
      const { container } = render(component)

      const placeholder = container.firstChild
      expect(placeholder).toHaveClass('bg-zinc-800')
    })
  })

  describe('scryfall API integration', () => {
    it('calls getCardImageUrl with commander name', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Kenrith, the Returned King',
      })
      render(component)

      expect(getCardImageUrl).toHaveBeenCalledWith('Kenrith, the Returned King')
    })

    it('handles special characters in commander name', async () => {
      vi.mocked(getCardImageUrl).mockResolvedValue('https://example.com/card.jpg')

      const component = await CommanderImage({
        commanderName: 'Atraxa, Praetors\' Voice',
      })
      render(component)

      expect(getCardImageUrl).toHaveBeenCalledWith('Atraxa, Praetors\' Voice')
    })
  })
})
