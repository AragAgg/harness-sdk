import type { ReactElement, ReactNode } from 'react'
import type { DOMElement } from 'ink'

import type { ChatPanel, ChatPanelRow } from '../chat/controller.js'
import { PanelHelpFooter } from './help-footer.js'
import { Cursor } from './text-input.js'
import { Box, Text, useTheme } from './theme.js'

export interface PanelRowsProps {
  panel: ChatPanel
  rows: readonly ChatPanelRow[]
  selected: number
  start: number
  width: number
  pressedRow?: number
  hoveredRow?: number
  onPanelElement?: (element: DOMElement | null) => void
  onRowElement?: (index: number, element: DOMElement | null) => void
}

export const TONE_COLORS = { normal: undefined, success: 'green', warning: 'yellow', danger: 'red' } as const

/** Badge text always gets a color so a `normal` badge renders gray instead of the accent. */
export function badgeColor(tone: keyof typeof TONE_COLORS): string {
  return TONE_COLORS[tone] ?? 'gray'
}

export function PanelItemHeader({
  label,
  active,
  pressed = false,
  clickable = false,
  bold = false,
  color,
  wrap = 'truncate-end',
}: {
  label: string
  active: boolean
  pressed?: boolean
  clickable?: boolean
  bold?: boolean
  color?: string
  wrap?: 'truncate-end' | 'wrap'
}): ReactElement {
  const { accent } = useTheme()
  const markerColor = active || (pressed && clickable) ? (color ?? accent) : undefined
  const labelColor = active || pressed ? (color ?? accent) : undefined
  return (
    <Box flexShrink={1} overflow="hidden">
      <Box flexShrink={0}>
        <Text {...(markerColor ? { color: markerColor } : {})} dimColor={!active && !pressed}>
          {active && clickable ? '› ' : '  '}
        </Text>
      </Box>
      <Text {...(labelColor ? { color: labelColor } : {})} bold={bold || (active && !pressed)} wrap={wrap}>
        {label}
      </Text>
    </Box>
  )
}

export function PanelTitle({ title, color }: { title: string; color: string }): ReactElement {
  return (
    <Text color={color} bold wrap="truncate-end">
      {title}
    </Text>
  )
}

export function PanelOverlay({
  width,
  height,
  children,
  onElement,
}: {
  width: number
  height?: number
  children: ReactNode
  onElement?: (element: DOMElement | null) => void
}): ReactElement {
  const theme = useTheme()
  return (
    <Box position="absolute" width="100%" height="100%" alignItems="center" justifyContent="center" padding={1}>
      <Box
        ref={onElement}
        width={width}
        {...(height === undefined ? {} : { height, overflow: 'hidden' })}
        flexDirection="column"
        paddingX={1}
        backgroundColor={theme.panel}
      >
        {children}
        <PanelHelpFooter width={Math.max(1, width - 2)} />
      </Box>
    </Box>
  )
}

export function PanelSearchHeader({
  query,
  placeholder,
  focused,
  onElement,
  paddingX,
}: {
  query: string
  placeholder: string
  focused: boolean
  onElement?: (element: DOMElement | null) => void
  paddingX?: number
}): ReactElement {
  const { accent } = useTheme()
  return (
    <Box ref={onElement} {...(paddingX === undefined ? { flexShrink: 1 } : { paddingX })}>
      <Box flexShrink={0} marginRight={1}>
        <Text {...(focused ? { color: accent } : { dimColor: true })}>/</Text>
      </Box>
      <Text {...(query ? {} : { dimColor: true })} wrap={query ? 'truncate-start' : 'truncate-end'}>
        {query || (focused ? '' : placeholder)}
        {focused ? <Cursor /> : null}
      </Text>
    </Box>
  )
}
