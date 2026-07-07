import { WestMonroeMark } from './WestMonroeMark'
import { classNames } from './classNames'

type AppNavPage = 'diagramming' | 'commentary' | 'json-input'

type AppNavProps = {
  activePage: AppNavPage
  onOpenCommentaryPicker?: () => void
  onOpenDiagramPicker?: () => void
  onOpenInputPage?: () => void
  onOpenJsonInput?: () => void
}

const navItems = [
  { id: 'diagramming', label: 'Diagramming' },
  { id: 'commentary', label: 'Commentary' },
  { id: 'json-input', label: 'JSON Input' },
  { id: 'industries', label: 'Industries' },
  { id: 'about', label: 'About' },
  { id: 'how-to', label: 'How-to' },
] as const

export function AppNav({
  activePage,
  onOpenCommentaryPicker,
  onOpenDiagramPicker,
  onOpenInputPage,
  onOpenJsonInput,
}: AppNavProps) {
  function getNavAction(itemId: (typeof navItems)[number]['id']) {
    if (itemId === 'diagramming') {
      return onOpenInputPage
    }

    if (itemId === 'commentary') {
      return onOpenCommentaryPicker ?? onOpenDiagramPicker
    }

    if (itemId === 'json-input') {
      return onOpenJsonInput
    }

    return undefined
  }

  return (
    <nav className="app-nav" aria-label="Main navigation">
      <button
        type="button"
        onClick={onOpenInputPage}
        className="app-nav-brand"
        aria-label="Open WM Diligence Studio"
      >
        <WestMonroeMark className="app-nav-mark" />
        <span className="app-nav-brand-text">WM Diligence Studio</span>
      </button>

      <div className="app-nav-items">
        {navItems.map((item) => {
          const isActive = item.id === activePage
          const action = getNavAction(item.id)
          const className = classNames(
            'app-nav-item',
            isActive && 'app-nav-active',
            action && !isActive && 'app-nav-action',
          )

          if (isActive) {
            return (
              <span key={item.id} className={className} aria-current="page">
                {item.label}
              </span>
            )
          }

          if (action) {
            return (
              <button key={item.id} type="button" onClick={action} className={className}>
                {item.label}
              </button>
            )
          }

          return (
            <a key={item.id} className={className} href={`#${item.id}`}>
              {item.label}
            </a>
          )
        })}
      </div>
      <button
        type="button"
        className="app-nav-menu-button"
        aria-label="Open navigation menu"
      >
        <span className="app-nav-menu-icon" aria-hidden="true">
          ≡
        </span>
      </button>
    </nav>
  )
}
