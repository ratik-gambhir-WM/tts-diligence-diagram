import { useCallback, useEffect, useMemo } from 'react'
import {
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import type { Connection, Edge, OnConnect } from '@xyflow/react'

import {
  buildInitialEdges,
  buildInitialNodes,
  DEFAULT_EDGE_OPTIONS,
} from '../constants/diagram'
import type { DiagramNode } from '../constants/diagram'
import type { PromptOutput } from '../types/PromptOutput'

export function useDiagramFlow(message: string, promptOutput: PromptOutput | null) {
  const initialNodes = useMemo(
    () => buildInitialNodes(message, promptOutput),
    [message, promptOutput],
  )
  const initialEdges = useMemo(() => buildInitialEdges(promptOutput), [promptOutput])

  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

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
  }
}
