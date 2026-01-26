import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from '../header'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, className, onClick }: {
    children: React.ReactNode
    href: string
    className?: string
    onClick?: () => void
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}))

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when user is not logged in', () => {
    it('renders logo', () => {
      render(<Header />)
      expect(screen.getByText('Karakas')).toBeInTheDocument()
    })

    it('renders login and signup links', () => {
      render(<Header />)
      expect(screen.getByText('Log in')).toBeInTheDocument()
      expect(screen.getByText('Sign up')).toBeInTheDocument()
    })

    it('does not render menu button', () => {
      render(<Header />)
      expect(screen.queryByText('Menu')).not.toBeInTheDocument()
    })

    it('does not render logout link', () => {
      render(<Header />)
      expect(screen.queryByText('Log out')).not.toBeInTheDocument()
    })
  })

  describe('when user is logged in', () => {
    it('renders username', () => {
      render(<Header username="testuser" />)
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('renders menu button', () => {
      render(<Header username="testuser" />)
      expect(screen.getByText('Menu')).toBeInTheDocument()
    })

    it('renders logout link', () => {
      render(<Header username="testuser" />)
      expect(screen.getByText('Log out')).toBeInTheDocument()
    })

    it('does not render login/signup when logged in', () => {
      render(<Header username="testuser" />)
      expect(screen.queryByText('Log in')).not.toBeInTheDocument()
      expect(screen.queryByText('Sign up')).not.toBeInTheDocument()
    })
  })

  describe('dropdown menu', () => {
    it('is closed by default', () => {
      render(<Header username="testuser" />)
      expect(screen.queryByRole('link', { name: 'Playgroups' })).not.toBeInTheDocument()
    })

    it('opens when menu button is clicked', () => {
      render(<Header username="testuser" />)

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton)

      expect(screen.getByRole('link', { name: 'Playgroups' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Games' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Decks' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Stats' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Friends' })).toBeInTheDocument()
    })

    it('closes when menu button is clicked again', () => {
      render(<Header username="testuser" />)

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton) // open
      fireEvent.click(menuButton) // close

      expect(screen.queryByRole('link', { name: 'Playgroups' })).not.toBeInTheDocument()
    })

    it('closes when a menu item is clicked', () => {
      render(<Header username="testuser" />)

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton)

      const playgroupsLink = screen.getByRole('link', { name: 'Playgroups' })
      fireEvent.click(playgroupsLink)

      expect(screen.queryByRole('link', { name: 'Games' })).not.toBeInTheDocument()
    })

    it('closes when clicking outside', () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <Header username="testuser" />
        </div>
      )

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton)
      expect(screen.getByRole('link', { name: 'Playgroups' })).toBeInTheDocument()

      fireEvent.mouseDown(screen.getByTestId('outside'))
      expect(screen.queryByRole('link', { name: 'Playgroups' })).not.toBeInTheDocument()
    })
  })

  describe('active tab highlighting', () => {
    it('highlights playgroups when active', () => {
      render(<Header username="testuser" activeTab="playgroups" />)

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton)

      const playgroupsLink = screen.getByRole('link', { name: 'Playgroups' })
      expect(playgroupsLink).toHaveClass('font-medium')
    })

    it('highlights games when active', () => {
      render(<Header username="testuser" activeTab="games" />)

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton)

      const gamesLink = screen.getByRole('link', { name: 'Games' })
      expect(gamesLink).toHaveClass('font-medium')
    })

    it('highlights decks when active', () => {
      render(<Header username="testuser" activeTab="decks" />)

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton)

      const decksLink = screen.getByRole('link', { name: 'Decks' })
      expect(decksLink).toHaveClass('font-medium')
    })
  })

  describe('navigation links', () => {
    it('has correct href for logo', () => {
      render(<Header username="testuser" />)
      const logo = screen.getByText('Karakas')
      expect(logo.closest('a')).toHaveAttribute('href', '/')
    })

    it('has correct href for logout', () => {
      render(<Header username="testuser" />)
      const logout = screen.getByText('Log out')
      expect(logout.closest('a')).toHaveAttribute('href', '/logout')
    })

    it('has correct href for login when not logged in', () => {
      render(<Header />)
      const login = screen.getByText('Log in')
      expect(login.closest('a')).toHaveAttribute('href', '/login')
    })

    it('has correct href for signup when not logged in', () => {
      render(<Header />)
      const signup = screen.getByText('Sign up')
      expect(signup.closest('a')).toHaveAttribute('href', '/signup')
    })

    it('has correct hrefs for menu items', () => {
      render(<Header username="testuser" />)

      const menuButton = screen.getByText('Menu')
      fireEvent.click(menuButton)

      expect(screen.getByRole('link', { name: 'Playgroups' })).toHaveAttribute('href', '/playgroups')
      expect(screen.getByRole('link', { name: 'Games' })).toHaveAttribute('href', '/games')
      expect(screen.getByRole('link', { name: 'Decks' })).toHaveAttribute('href', '/decks')
      expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/stats')
      expect(screen.getByRole('link', { name: 'Friends' })).toHaveAttribute('href', '/friends')
    })
  })
})
