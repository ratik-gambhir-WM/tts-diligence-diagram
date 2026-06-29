import { Button } from './Button'

type FileListItem = {
  name: string
  size: number
}

type FileListProps = {
  files: FileListItem[]
  formatFileSize: (bytes: number) => string
  label: string
  onRemove?: (index: number) => void
  removeDisabled?: boolean
  showCountHeader?: boolean
}

export function FileList({
  files,
  formatFileSize,
  label,
  onRemove,
  removeDisabled = false,
  showCountHeader = false,
}: FileListProps) {
  if (files.length === 0) {
    return null
  }

  return (
    <div className="relative mt-6 border-t border-white/12 pt-4">
      {showCountHeader && (
        <div className="mb-3 flex items-center justify-between gap-3 text-[0.82rem] font-bold tracking-[0.12em] text-[#8d93aa] uppercase">
          <span>{label}</span>
          <span>
            {files.length} file{files.length === 1 ? '' : 's'}
          </span>
        </div>
      )}
      <ul className="grid gap-2" aria-label={label}>
        {files.map((file, index) => (
          <li
            className="flex min-w-0 items-center justify-between gap-3 border border-[#28304a] bg-[#080c1c] px-3 py-2 text-left"
            key={`${file.name}-${file.size}-${index}`}
          >
            <span className="min-w-0 truncate text-[0.9rem] font-bold text-[#eef3ff]">
              {file.name}
              {!showCountHeader && ` (${formatFileSize(file.size)})`}
            </span>
            {showCountHeader ? (
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[0.8rem] font-bold text-[#8d93aa]">
                  {formatFileSize(file.size)}
                </span>
                {onRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={removeDisabled}
                    className="h-7 min-w-7 px-2 text-[0.82rem] leading-none"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onRemove(index)}
                  >
                    X
                  </Button>
                )}
              </span>
            ) : (
              onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={removeDisabled}
                  className="text-[0.82rem]"
                  onClick={() => onRemove(index)}
                >
                  Remove
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
