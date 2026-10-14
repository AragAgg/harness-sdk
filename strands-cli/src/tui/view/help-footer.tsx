import { createContext, Fragment, useContext, type ReactElement } from 'react'
import { Box, type DOMElement } from 'ink'
import type { ChatPanel, ChatPanelRow, ChatSnapshot } from '../chat/types.js'
import type { MetadataTarget } from './interaction.js'
import { contextColor, metadataPlacements } from './presentation.js'
import { Text, useTheme } from './theme.js'

export const PanelHelpContext = createContext<ChatPanel | undefined>(undefined)
export type FooterAction = 'settings' | 'setup' | 'help' | 'update'

export function panelModelId(panel: ChatPanel | undefined, row?: ChatPanelRow): string | undefined {
  if (panel?.kind !== 'models') return undefined
  return row?.value || panel.body?.split('\n', 2)[1] || undefined
}

export function PanelHelpFooter({
  width,
  centered = false,
  modelId,
  scrollable = false,
}: {
  width: number
  centered?: boolean
  modelId?: string
  scrollable?: boolean
}): ReactElement | null {
  const panel = useContext(PanelHelpContext)
  if (!panel) return null
  const displayedModelId = width >= 80 ? (modelId ?? panelModelId(panel)) : undefined
  const permission = panel.kind === 'permission'
  const detail = panel.kind === 'detail' || panel.kind === 'help-detail'
  const actionable = panel.rows.some((row) => row.value !== undefined)
  const customPermissions =
    panel.kind === 'permissions' && panel.slider.options.some((option) => option.id === 'custom' && option.active)
  const keys = permission
    ? panel.stage
      ? '↑↓←→ · Enter save rule · Esc back'
      : width < 64
        ? '↑↓←→ · Enter choose · Esc deny'
        : '↑↓←→ · Enter choose · PgUp/PgDn scroll · Esc deny once'
    : panel.kind === 'error' && scrollable
      ? width < 53
        ? '↑↓ scroll · Esc close'
        : '↑↓ / PgUp / PgDn scroll · Esc close'
      : detail
        ? width < 53
          ? '↑↓ scroll · Esc back'
          : '↑↓ / PgUp / PgDn scroll · Esc back'
        : panel.kind === 'config'
          ? width < 53
            ? `${panel.configuration.project ? 'E open · ' : ''}←→ language · ↑↓ scroll · Esc`
            : `${panel.configuration.project ? 'E open · ' : ''}←→ language · ↑↓ / PgUp / PgDn scroll · Esc close`
          : panel.kind === 'effort'
            ? width < 53
              ? '←→ · Enter done · Esc close'
              : '←→ change · Enter done · Esc close'
            : !actionable
              ? 'Esc close'
              : panel.kind === 'settings'
                ? width < 42
                  ? '↑↓ move · ←→ change · Esc back'
                  : '↑↓ · ←→ change · Tab section · Esc back'
                : panel.kind === 'help'
                  ? width < 53
                    ? 'Tab · / search · ↑↓ · Enter · Esc'
                    : 'Tab section · / search · ↑↓ · Enter open/run · Esc back'
                  : panel.kind === 'models'
                    ? width < 53
                      ? 'Ctrl+Y · Tab · / · ↑↓ · Enter · Esc'
                      : 'Ctrl+Y copy ID · Tab section · / search in models · ↑↓ · Enter choose · Esc back'
                    : panel.kind === 'sessions'
                      ? width < 53
                        ? 'Tab · / · ↑↓ · Enter · Esc'
                        : 'Tab section · / search sessions · ↑↓ · Enter open · Esc back'
                      : panel.kind === 'export'
                        ? '←→ / Tab choose · Enter continue · Esc back'
                        : panel.kind === 'voice'
                          ? width < 53
                            ? 'Tab · ↑↓ · ←→ · Space mute · Enter · Esc'
                            : 'Tab section · ↑↓ move · ←→ change · Space mute · Enter choose · Esc back'
                          : panel.kind === 'tools'
                            ? '↑↓ · Enter toggle · Esc save'
                            : panel.kind === 'tasks'
                              ? width < 53
                                ? 'Tab · / · ←→ · ↑↓ · Enter · Esc'
                                : 'Tab section · / search tasks · ←→ change · ↑↓ · Enter open/toggle · Esc back'
                              : panel.kind === 'permissions'
                                ? width < 53
                                  ? customPermissions
                                    ? 'Tab · / · ←→ · ↑↓ · Enter · Esc'
                                    : '←→ mode · Tab tools · / search · Esc'
                                  : customPermissions
                                    ? 'Tab section · / search tools · ←→ mode · ↑↓ · Enter toggle · Esc save'
                                    : '←→ mode · Tab tools · / search · choose Custom to edit · Esc save'
                                : panel.kind === 'mcp'
                                  ? '/ search · ↑↓ browse · Esc back'
                                  : panel.kind === 'skills'
                                    ? '↑↓ · Enter run · → details · Esc back'
                                    : panel.kind === 'agents'
                                      ? width < 26
                                        ? 'Arrows · Enter · Esc'
                                        : width < 64
                                          ? '↑↓←→ · Enter switch · Esc'
                                          : '↑↓←→ choose · Enter switch · PgUp/PgDn scroll · Esc back'
                                      : panel.filters?.length
                                        ? 'Tab category · Enter · Esc back'
                                        : '↑↓ · Enter open · Esc back'
  return (
    <Box
      width={Math.max(1, width)}
      height={1}
      flexShrink={0}
      justifyContent={displayedModelId ? 'space-between' : centered ? 'center' : 'flex-start'}
      overflow="hidden"
    >
      {displayedModelId ? (
        <Box flexShrink={1} marginRight={1} overflow="hidden">
          <Text dimColor wrap="truncate-end">
            {displayedModelId}
          </Text>
        </Box>
      ) : null}
      <Box flexShrink={displayedModelId ? 0 : 1} overflow="hidden">
        <Text dimColor wrap="truncate-end">
          {keys}
        </Text>
      </Box>
    </Box>
  )
}

export function ComposerFooter({
  snapshot,
  width,
  pressed,
  hovered,
  hoveredAction,
  availableUpdate,
  onMetadataElement,
  onActionElement,
}: {
  snapshot: ChatSnapshot
  width: number
  pressed?: MetadataTarget
  hovered?: MetadataTarget
  hoveredAction?: FooterAction
  availableUpdate?: string
  onMetadataElement?: (target: MetadataTarget, element: DOMElement | null) => void
  onActionElement?: (action: FooterAction, element: DOMElement | null) => void
}): ReactElement {
  const palette = useTheme()
  const { accent, foreground, warning } = palette
  return (
    <Box height={1} marginTop={1} width={width} flexShrink={0} paddingX={1} overflow="hidden">
      {metadataPlacements(snapshot, width, availableUpdate).map((segment) => (
        <Box
          key={segment.target}
          width={segment.width}
          flexShrink={0}
          justifyContent={segment.alignment}
          overflow="hidden"
        >
          {segment.actions ? (
            segment.actions.map((action, index) => (
              <Fragment key={action.target}>
                {index > 0 ? <Text>{'  '}</Text> : null}
                <Box ref={(element) => onActionElement?.(action.target, element)}>
                  <Text
                    color={hoveredAction === action.target ? accent : action.target === 'update' ? warning : foreground}
                  >
                    {action.text}
                  </Text>
                </Box>
              </Fragment>
            ))
          ) : segment.controls ? (
            segment.controls.map((control, index) => (
              <Fragment key={control.target}>
                {index > 0 ? <Text color={foreground}> • </Text> : null}
                <Box ref={(element) => onMetadataElement?.(control.target, element)}>
                  <Text
                    color={
                      hovered === control.target || pressed === control.target
                        ? accent
                        : control.target === 'context'
                          ? contextColor(snapshot.context, palette)
                          : foreground
                    }
                  >
                    {control.text}
                  </Text>
                </Box>
              </Fragment>
            ))
          ) : (
            <Text dimColor>{segment.text}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}
