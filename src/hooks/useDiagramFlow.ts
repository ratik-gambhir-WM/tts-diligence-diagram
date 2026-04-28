import { useCallback, useMemo } from 'react'
import {
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import type { Connection, Edge, OnConnect } from '@xyflow/react'

import {
  buildInitialGraph,
  DEFAULT_EDGE_OPTIONS,
} from '../constants/diagram'
import type { DiagramNode } from '../constants/diagram'
import type { PromptOutput } from '../types/PromptOutput'

type UseDiagramFlowParams = {
  promptOutput: PromptOutput
}

export function useDiagramFlow({ promptOutput }: UseDiagramFlowParams) {
  const diagramGraph = useMemo(() => buildInitialGraph(promptOutput), [promptOutput])

  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>(diagramGraph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(diagramGraph.edges)

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    setEdges((currentEdges) => addEdge({ ...DEFAULT_EDGE_OPTIONS, ...connection }, currentEdges))
  }, [setEdges])

  const selectedNodes = useMemo(
    () => nodes.filter((node): node is DiagramNode => node.selected === true),
    [nodes],
  )

  return {
    edges,
    nodes,
    onConnect,
    onEdgesChange,
    onNodesChange,
    selectedNodes,
    setEdges,
    setNodes,
  }
}
