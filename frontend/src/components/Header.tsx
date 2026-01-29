import { useThemeStore } from '../store/themeStore'
import { Moon, Sun } from 'lucide-react'
import delicateArchIcon from '../images/delicate-arch.jpeg'

export default function Header(): JSX.Element {
  const darkMode = useThemeStore((state) => state.darkMode)
  const toggleDarkMode = useThemeStore((state) => state.toggleDarkMode)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center justify-center h-16 px-6 mx-auto max-w-screen-2xl">
        <div className="flex mr-4">
          <a href="/" aria-current="page" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex-shrink-0 w-10 h-10 overflow-hidden rounded-md bg-muted">
              <img 
                src={delicateArchIcon} 
                alt="Delicate Arch" 
                loading="lazy"
                decoding="async"
                className="object-cover w-full h-full"
              />
            </div>
            <span className="text-xl font-bold text-foreground">Arches Visitation Analytics</span>
          </a>
        </div>
        <div className="flex items-center justify-between flex-1 space-x-2 md:justify-end">
          <button
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className="inline-flex items-center justify-center gap-2 px-4 text-sm font-medium transition-colors rounded-md ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4" aria-hidden="true" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" aria-hidden="true" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
