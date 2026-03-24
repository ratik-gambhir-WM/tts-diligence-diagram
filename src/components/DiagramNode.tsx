import type { ReactNode } from 'react'

export type DiagramNodeKind =
  | 'service'
  | 'database'
  | 'queue'
  | 'gateway'
  | 'worker'
  | 'external'

export type DiagramNodeTone = 'sky' | 'emerald' | 'violet' | 'rose' | 'amber' | 'slate'

export type DiagramNodeMetaItem = {
  label: string
  value: string
}

export type DiagramNodeProps = {
  children?: ReactNode
  className?: string
  description?: string
  kind: DiagramNodeKind
  label: string
  metadata?: DiagramNodeMetaItem[]
  nodeId?: string
  selected?: boolean
  tags?: string[]
  tone?: DiagramNodeTone
}

const DEFAULT_TONES: Record<DiagramNodeKind, DiagramNodeTone> = {
  service: 'sky',
  database: 'rose',
  queue: 'amber',
  gateway: 'violet',
  worker: 'emerald',
  external: 'slate',
}

const KIND_LABELS: Record<DiagramNodeKind, string> = {
  service: 'Service',
  database: 'Database',
  queue: 'Queue',
  gateway: 'Gateway',
  worker: 'Worker',
  external: 'External',
}

const TONE_CLASSES: Record<DiagramNodeTone, string> = {
  sky: '[--node-accent:#2563eb] [--node-border:rgba(37,99,235,0.28)] [--node-surface-top:rgba(255,255,255,0.98)] [--node-surface-bottom:rgba(219,234,254,0.92)] [--node-shadow:rgba(37,99,235,0.16)]',
  emerald:
    '[--node-accent:#0f766e] [--node-border:rgba(15,118,110,0.28)] [--node-surface-top:rgba(255,255,255,0.98)] [--node-surface-bottom:rgba(204,251,241,0.92)] [--node-shadow:rgba(13,148,136,0.16)]',
  violet:
    '[--node-accent:#6d28d9] [--node-border:rgba(109,40,217,0.28)] [--node-surface-top:rgba(255,255,255,0.98)] [--node-surface-bottom:rgba(237,233,254,0.92)] [--node-shadow:rgba(124,58,237,0.16)]',
  rose: '[--node-accent:#be123c] [--node-border:rgba(190,18,60,0.28)] [--node-surface-top:rgba(255,255,255,0.98)] [--node-surface-bottom:rgba(255,228,230,0.94)] [--node-shadow:rgba(244,63,94,0.16)]',
  amber:
    '[--node-accent:#b45309] [--node-border:rgba(180,83,9,0.3)] [--node-surface-top:rgba(255,255,255,0.98)] [--node-surface-bottom:rgba(254,243,199,0.96)] [--node-shadow:rgba(245,158,11,0.16)]',
  slate:
    '[--node-accent:#334155] [--node-border:rgba(51,65,85,0.26)] [--node-surface-top:rgba(255,255,255,0.98)] [--node-surface-bottom:rgba(226,232,240,0.94)] [--node-shadow:rgba(51,65,85,0.14)]',
}

const SURFACE_SHAPE_CLASSES: Record<Exclude<DiagramNodeKind, 'database'>, string> = {
  service: 'rounded-[22px]',
  queue:
    "rounded-full px-[1.2rem] after:absolute after:inset-x-4 after:bottom-[0.85rem] after:border-b after:border-dashed after:border-slate-500/40 after:content-['']",
  gateway:
    'rounded-none px-[1.35rem] [clip-path:polygon(10%_0,90%_0,100%_50%,90%_100%,10%_100%,0_50%)] max-[640px]:rounded-[24px] max-[640px]:px-4 max-[640px]:[clip-path:none]',
  worker:
    'rounded-none [clip-path:polygon(10%_0,90%_0,100%_12%,100%_88%,90%_100%,10%_100%,0_88%,0_12%)] max-[640px]:rounded-[24px] max-[640px]:[clip-path:none]',
  external:
    'rounded-[24px] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.92),inset_0_0_0_5px_rgba(148,163,184,0.2),0_12px_24px_rgba(15,23,42,0.08)]',
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function NodeBody({
  children,
  description,
  kind,
  label,
  metadata,
  nodeId,
  tags,
  surfaceClassName,
}: Pick<DiagramNodeProps, 'children' | 'description' | 'kind' | 'label' | 'metadata' | 'nodeId' | 'tags'> & {
  surfaceClassName?: string
}) {
  return (
    <div
      className={joinClassNames(
        "relative grid min-h-[150px] gap-[0.9rem] overflow-hidden border-[1.5px] border-[var(--node-border)] bg-[linear-gradient(180deg,var(--node-surface-top)_0%,var(--node-surface-bottom)_100%)] px-4 pt-4 pb-[1.05rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_24px_rgba(15,23,42,0.08)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[linear-gradient(90deg,var(--node-accent),rgba(255,255,255,0))] before:content-['']",
        surfaceClassName,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[var(--node-accent)]">
            {KIND_LABELS[kind]}
          </p>
          <h3 className="mt-[0.2rem] mb-0 text-base leading-[1.2]">{label}</h3>
        </div>
        {nodeId ? <span className="shrink-0 text-[0.78rem] font-bold text-slate-600">{nodeId}</span> : null}
      </header>

      {description ? <p className="m-0 text-[0.9rem] leading-[1.5] text-slate-700">{description}</p> : null}

      {metadata && metadata.length > 0 ? (
        <dl className="m-0 grid gap-[0.65rem]">
          {metadata.map((item) => (
            <div key={`${item.label}-${item.value}`} className="grid gap-0.5">
              <dt className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-slate-600">
                {item.label}
              </dt>
              <dd className="m-0 text-[0.86rem] text-slate-950">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {tags && tags.length > 0 ? (
        <div className="flex flex-wrap gap-[0.45rem]" aria-label={`${label} tags`}>
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/90 bg-white/70 px-[0.58rem] py-[0.28rem] text-[0.76rem] font-bold text-[var(--node-accent)]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {children}
    </div>
  )
}

export function DiagramNode({
  children,
  className,
  description,
  kind,
  label,
  metadata = [],
  nodeId,
  selected = false,
  tags = [],
  tone,
}: DiagramNodeProps) {
  const resolvedTone = tone ?? DEFAULT_TONES[kind]
  const rootClassName = joinClassNames(
    'w-full max-w-[320px] text-slate-950 [filter:drop-shadow(0_16px_28px_var(--node-shadow))]',
    TONE_CLASSES[resolvedTone],
    selected && '-translate-y-px',
    kind === 'database' && 'relative pt-3 pb-[14px]',
    className,
  )

  if (kind === 'database') {
    return (
      <article className={rootClassName}>
        <span
          className="absolute top-0 left-0 z-[2] h-[26px] w-full rounded-[999px/56%] border-[1.5px] border-[var(--node-border)] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.96),rgba(255,255,255,0)_72%),linear-gradient(180deg,var(--node-surface-top),var(--node-surface-bottom))]"
          aria-hidden="true"
        />
        <NodeBody
          kind={kind}
          label={label}
          description={description}
          metadata={metadata}
          nodeId={nodeId}
          tags={tags}
          surfaceClassName="z-[1] rounded-b-[26px] pt-[1.7rem] pb-[1.35rem]"
        >
          {children}
        </NodeBody>
        <span
          className="absolute bottom-0 left-0 z-0 h-[26px] w-full rounded-[999px/56%] border-[1.5px] border-[var(--node-border)] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.96),rgba(255,255,255,0)_72%),linear-gradient(180deg,var(--node-surface-top),var(--node-surface-bottom))]"
          aria-hidden="true"
        />
      </article>
    )
  }

  return (
    <article className={rootClassName}>
      <NodeBody
        kind={kind}
        label={label}
        description={description}
        metadata={metadata}
        nodeId={nodeId}
        tags={tags}
        surfaceClassName={SURFACE_SHAPE_CLASSES[kind]}
      >
        {children}
      </NodeBody>
    </article>
  )
}
