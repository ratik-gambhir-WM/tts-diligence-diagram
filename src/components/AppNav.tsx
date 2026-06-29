import { WestMonroeMark } from './WestMonroeMark'

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
    <nav
      className="mx-auto flex w-full max-w-[1320px] items-center rounded-full border border-white/16 bg-[#070a1b] px-6 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.22)] max-[640px]:px-4"
      aria-label="Main navigation"
    >
      <button
        type="button"
        onClick={onOpenInputPage}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-[#f3c316] transition hover:brightness-110"
        aria-label="Open WM Diligence Studio"
      >
        <WestMonroeMark className="h-7 w-7 shrink-0 [&_rect]:fill-[#f3c316]" />
        <span className="truncate text-[0.72rem] font-bold uppercase tracking-[0.14em] max-[480px]:max-w-[9rem]">
          WM Diligence Studio
        </span>
      </button>

      <div className="flex flex-none items-center justify-center gap-8 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#eef3ff] max-[900px]:hidden">
        {navItems.map((item) => {
          const isActive = item.id === activePage
          const action = getNavAction(item.id)
          const className = [
            isActive
              ? 'border-b border-[#f3c316] pb-1 text-[#f3c316]'
              : 'transition hover:text-[#f3c316]',
            action && !isActive
              ? 'cursor-pointer border-0 bg-transparent p-0 text-[inherit] font-[inherit] tracking-[inherit] uppercase'
              : '',
          ]
            .filter(Boolean)
            .join(' ')

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
        className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/12 bg-transparent text-[#eef3ff] transition hover:border-[#f3c316] hover:text-[#f3c316]"
        aria-label="Open navigation menu"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          ≡
        </span>
      </button>
    </nav>
  )
}
