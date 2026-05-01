import type { DiagramNode } from '../lib/diagram'
import type { PromptOutputParentMetadataValue } from '../types/PromptOutput'

type MetadataPanelProps = {
  nodes: DiagramNode[]
  onClose: () => void
}

function formatMetadataLabel(key: string) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatMetadataValue(value: PromptOutputParentMetadataValue) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

export function MetadataPanel({ nodes, onClose }: MetadataPanelProps) {
  return (
    <aside
      className="min-h-0 h-full overflow-auto border-l border-[#171717]/10 bg-white/94 p-4 shadow-[-16px_0_40px_rgba(23,23,23,0.08)] backdrop-blur-xl"
      aria-label="Selected node metadata"
    >
      <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
        <div>
          <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[#c95518]">Metadata</p>
          <h2 className="m-0 text-[1.2rem]">
            {nodes.length} selected node{nodes.length === 1 ? '' : 's'}
          </h2>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-full border-0 bg-[#171717] px-4 py-2.5 text-[0.95rem] font-bold text-white transition duration-150 ease-out hover:bg-[#2a2a2a]"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {nodes.length === 0 ? (
        <p className="mt-4 text-[#4f4f4f]">
          Select one or more nodes, then use the info icon in the dock.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {nodes.map((node) => {
            const layerMetadataEntries = Object.entries(node.data.metadata.layerMetadata ?? {})

            return (
              <article
                key={node.id}
                className="rounded-[20px] border border-[#171717]/10 bg-[#fafafa] p-4"
              >
              <header className="flex items-start justify-between gap-4 max-[640px]:flex-col">
                <h3 className="m-0 text-base">{node.data.label}</h3>
                <span className="text-[0.82rem] font-bold text-[#5c5c5c]">{node.id}</span>
              </header>

              <p className="mt-3 text-[#4f4f4f]">{node.data.metadata.summary}</p>

              {layerMetadataEntries.length > 0 ? (
                <section className="mt-4 rounded-2xl border border-[#171717]/10 bg-white p-3">
                  <p className="m-0 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">
                    Layer Metadata
                  </p>
                  <dl className="mt-2 grid gap-2">
                    {layerMetadataEntries.map(([key, value]) => (
                      <div key={`${node.id}-${key}`} className="grid gap-1">
                        <dt className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">
                          {formatMetadataLabel(key)}
                        </dt>
                        <dd>{formatMetadataValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              <dl className="mt-4 grid gap-3">
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">Owner</dt>
                  <dd>{node.data.metadata.owner}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">System</dt>
                  <dd>{node.data.metadata.system}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">Runtime</dt>
                  <dd>{node.data.metadata.runtime}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">
                    Environment
                  </dt>
                  <dd>{node.data.metadata.environment}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">Region</dt>
                  <dd>{node.data.metadata.region}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">SLA</dt>
                  <dd>{node.data.metadata.sla}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">
                    Last Deployed
                  </dt>
                  <dd>{node.data.metadata.lastDeployed}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5c5c5c]">
                    Dependencies
                  </dt>
                  <dd>{node.data.metadata.dependencies.join(', ')}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2" aria-label={`${node.data.label} tags`}>
                {node.data.metadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#f7c8a8] px-2.5 py-1 text-[0.82rem] font-bold text-[#9b4716]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              </article>
            )
          })}
        </div>
      )}
    </aside>
  )
}
