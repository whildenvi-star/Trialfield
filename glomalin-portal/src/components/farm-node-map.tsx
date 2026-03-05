'use client'

import { useCallback, useState } from 'react'
import { ReactFlow, Background, useNodesState, useEdgesState, type Node, type Edge, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ------- Tooltip state -------
interface TooltipState {
  visible: boolean
  x: number
  y: number
  text: string
}

// ------- Node data -------
interface NodeData {
  label: string
  sublabel?: string
  description: string
  [key: string]: unknown
}

// ------- Node styling helpers -------
const HUB_STYLE: React.CSSProperties = {
  background: '#0e0c0b',
  border: '2px solid #C8860A',
  borderRadius: '8px',
  color: '#e8d8c0',
  fontFamily: 'JetBrains Mono, monospace',
  fontWeight: 700,
  fontSize: '13px',
  width: 160,
  padding: '12px 16px',
  textAlign: 'center',
}

const SOURCE_STYLE: React.CSSProperties = {
  background: '#0e0c0b',
  border: '1px solid #2a2218',
  borderRadius: '6px',
  color: '#e8d8c0',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px',
  width: 140,
  padding: '8px 12px',
  textAlign: 'center',
}

const MODULE_STYLE: React.CSSProperties = {
  background: '#0e0c0b',
  border: '1px solid #3a3020',
  borderRadius: '6px',
  color: '#e8d8c0',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '11px',
  width: 130,
  padding: '8px 12px',
  textAlign: 'center',
}

// ------- Layout math -------
const CENTER_X = 420
const CENTER_Y = 320

function circlePoint(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

// ------- Source apps (outer ring, 6 nodes, clockwise from top) -------
const SOURCE_APPS = [
  { id: 'grain-tickets', label: 'Grain Tickets', description: 'Grain traceability — 527+ tickets' },
  { id: 'farm-budget', label: 'Farm Budget', description: 'Enterprise planning & P&L' },
  { id: 'fsa-acres', label: 'FSA Acres', description: 'FSA acreage reporting' },
  { id: 'farm-registry', label: 'Farm Registry', description: 'Field & acre source of truth' },
  { id: 'meristem-malt', label: 'Meristem Malt', description: 'Malt barley processing' },
  { id: 'organic-cert', label: 'Organic Cert', description: 'USDA NOP compliance' },
]

// ------- Portal modules (inner ring, 5 nodes) -------
const PORTAL_MODULES = [
  { id: 'mod-macro-rollup', label: 'Macro Rollup', sublabel: 'Whole-farm P&L', description: 'Aggregated whole-farm profit & loss across all enterprises' },
  { id: 'mod-farm-registry', label: 'Farm Registry', sublabel: 'Field & Acre Registry', description: 'Central field and acre registry — source of truth for all apps' },
  { id: 'mod-org-cert', label: 'Organic Cert', sublabel: 'NOP Compliance', description: 'USDA NOP audit trail and organic certification tracking' },
  { id: 'mod-inputs-seeds', label: 'Inputs & Seeds', sublabel: 'Seed & Input Tracking', description: 'Seed variety and input procurement tracking across seasons' },
  { id: 'mod-fsa-reporting', label: 'FSA Reporting', sublabel: 'FSA Reporting', description: 'FSA acreage and farm program reporting' },
]

// ------- Build nodes -------
function buildNodes(): Node[] {
  const nodes: Node[] = []

  // Center hub
  nodes.push({
    id: 'hub',
    position: { x: CENTER_X - 80, y: CENTER_Y - 30 },
    data: {
      label: 'GLOMALIN',
      description: 'Central farm operations portal aggregating data from all source systems',
    } as NodeData,
    style: HUB_STYLE,
    draggable: false,
  })

  // Source app outer ring — radius 290, 6 nodes, 60° apart starting at 0°
  SOURCE_APPS.forEach((app, i) => {
    const angle = i * 60
    const pos = circlePoint(CENTER_X, CENTER_Y, 290, angle)
    nodes.push({
      id: app.id,
      position: { x: pos.x - 70, y: pos.y - 24 },
      data: {
        label: app.label,
        description: app.description,
      } as NodeData,
      style: SOURCE_STYLE,
      draggable: false,
    })
  })

  // Portal module inner ring — radius 150, 5 nodes, 72° apart starting at 36°
  PORTAL_MODULES.forEach((mod, i) => {
    const angle = 36 + i * 72
    const pos = circlePoint(CENTER_X, CENTER_Y, 150, angle)
    nodes.push({
      id: mod.id,
      position: { x: pos.x - 65, y: pos.y - 24 },
      data: {
        label: mod.label,
        sublabel: mod.sublabel,
        description: mod.description,
      } as NodeData,
      style: MODULE_STYLE,
      draggable: false,
    })
  })

  return nodes
}

// ------- Build edges (all flow to center hub) -------
function buildEdges(): Edge[] {
  const edges: Edge[] = []

  SOURCE_APPS.forEach((app) => {
    edges.push({
      id: `e-${app.id}`,
      source: app.id,
      target: 'hub',
      animated: true,
      style: { stroke: '#3a3020', strokeWidth: 1.5 },
    })
  })

  PORTAL_MODULES.forEach((mod) => {
    edges.push({
      id: `e-${mod.id}`,
      source: mod.id,
      target: 'hub',
      animated: true,
      style: { stroke: '#C8860A', strokeWidth: 1, opacity: 0.5 },
    })
  })

  return edges
}

const INITIAL_NODES = buildNodes()
const INITIAL_EDGES = buildEdges()

// ------- Custom node label renderer -------
// React Flow's default `data.label` renders as-is; for sublabels we use a wrapper node type.
// Since custom node types require registration, we'll encode the label+sublabel in a single
// JSX element by setting data.label to a ReactNode. However, React Flow accepts ReactNode
// for label, so this is fine.
function nodeLabel(data: NodeData): React.ReactNode {
  if (data.sublabel) {
    return (
      <div>
        <div style={{ fontWeight: 600, fontSize: '11px', color: '#e8d8c0' }}>{data.label}</div>
        <div style={{ fontSize: '9px', color: '#6a5a4a', marginTop: '2px' }}>{data.sublabel}</div>
      </div>
    )
  }
  return data.label
}

// ------- Main component -------
export default function FarmNodeMap() {
  const [nodes, , onNodesChange] = useNodesState(
    INITIAL_NODES.map((n) => ({
      ...n,
      data: { ...n.data, label: nodeLabel(n.data as NodeData) },
    }))
  )
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES)

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  })

  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (event, node) => {
      const desc = (node.data as NodeData).description as string
      setTooltip({
        visible: true,
        x: event.clientX + 12,
        y: event.clientY - 10,
        text: desc || '',
      })
    },
    []
  )

  const onNodeMouseMove: NodeMouseHandler = useCallback(
    (event) => {
      setTooltip((prev) =>
        prev.visible ? { ...prev, x: event.clientX + 12, y: event.clientY - 10 } : prev
      )
    },
    []
  )

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }, [])

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseMove={onNodeMouseMove}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        style={{ background: 'transparent' }}
      >
        <Background color="#1a1410" gap={32} size={1} />
      </ReactFlow>

      {/* Hover tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-2 rounded text-xs font-mono shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            background: '#0e0c0b',
            border: '1px solid #2a2218',
            color: '#e8d8c0',
            maxWidth: 220,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
