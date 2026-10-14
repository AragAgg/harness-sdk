import type { ReactElement } from 'react'
import type { DOMElement } from 'ink'

import type { ChatContextUsage, ChatPanel, ChatPanelRow, ChatSettings } from '../chat/controller.js'
import {
  clampViewportStart,
  COMPOSER_RESOURCE_PANEL_HEIGHT,
  isComposerPanel,
  panelControlTarget,
  panelRowCapacity,
  type ModelPanelFocus,
  type SettingsPanelFocus,
} from './interaction.js'
import { contextColor, formatContext, wrapLines } from './presentation.js'
import { ComposerListPanel } from './composer-list-panel.js'
import { ContextPanel } from './context-panel.js'
import { ConfigurationDock } from './configuration-view.js'
import { DetailPanel } from './detail-panel.js'
import { EffortPanel } from './effort-panel.js'
import { ErrorPanel } from './error-panel.js'
import { errorPanelLayout } from './error-panel-layout.js'
import { ExportPanel } from './export-panel.js'
import { HelpPanel } from './help-panel.js'
import { ModelPicker } from './model-panel.js'
import { SessionsPanel } from './sessions-panel.js'
import { PanelItemHeader, PanelOverlay, PanelTitle, badgeColor, TONE_COLORS } from './panel-components.js'
import { PanelHelpFooter } from './help-footer.js'
import { PermissionPanel } from './permission-panel.js'
import { PermissionsPanel } from './permissions-panel.js'
import { SettingsControl, SettingsPicker } from './settings-panel.js'
import { TasksPanel } from './tasks-panel.js'
import { Cursor } from './text-input.js'
import { Box, Text, useTheme } from './theme.js'
import { VoicePanel } from './voice-panel.js'

export function ResourcePanel({
  panel,
  context,
  settings,
  selected,
  viewportStart,
  terminalWidth,
  terminalHeight,
  composer,
  query,
  filter,
  modelPanelFocus,
  settingsPanelFocus,
  pressedFilter,
  hoveredFilter,
  pressedRow,
  hoveredRow,
  pressedControl,
  hoveredControl,
  detailScroll,
  rows: allRows,
  energyFrame = 0,
  onPanelElement,
  onRowElement,
  onControlElement,
  onFilterElement,
  onSearchElement,
  onSliderElement,
}: {
  panel: ChatPanel
  context: ChatContextUsage
  settings: ChatSettings
  selected: number
  viewportStart: number
  terminalWidth: number
  terminalHeight: number
  /** Content box of the prompt editor when the panel renders inside it. */
  composer?: { width: number; height: number }
  query: string
  filter: string
  modelPanelFocus: ModelPanelFocus
  settingsPanelFocus: SettingsPanelFocus
  pressedFilter?: string
  hoveredFilter?: string
  pressedRow?: number
  hoveredRow?: number
  pressedControl?: string
  hoveredControl?: string
  detailScroll: number
  rows: readonly ChatPanelRow[]
  energyFrame?: number
  onPanelElement?: (element: DOMElement | null) => void
  onRowElement?: (index: number, element: DOMElement | null) => void
  onControlElement?: (key: string, element: DOMElement | null) => void
  onFilterElement?: (id: string, element: DOMElement | null) => void
  onSearchElement?: (element: DOMElement | null) => void
  onSliderElement?: (element: DOMElement | null) => void
}): ReactElement {
  const palette = useTheme()
  const { surface, warning, selection, accent } = palette
  // Tool lists render as a checklist with a warning-colored body.
  const checklist = panel.kind === 'permissions' || panel.kind === 'tools'
  const preferredWidth = isComposerPanel(panel.kind) ? terminalWidth - 4 : checklist ? 96 : 84
  const width = composer?.width ?? Math.max(1, Math.min(preferredWidth, terminalWidth - 4))

  if (panel.kind === 'help') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    const capacity = panelRowCapacity(panel.kind, height, allRows)
    const start = clampViewportStart(viewportStart, allRows.length, capacity)
    return (
      <Box ref={onPanelElement} width={width} height={height} overflow="hidden" flexDirection="column">
        <HelpPanel
          panel={panel}
          rows={allRows.slice(start, start + capacity)}
          allRows={allRows}
          selected={selected}
          start={start}
          width={width}
          height={Math.max(1, height - 1)}
          query={query}
          filter={filter}
          focus={modelPanelFocus}
          {...(pressedRow !== undefined ? { pressedRow } : {})}
          {...(hoveredRow !== undefined ? { hoveredRow } : {})}
          {...(pressedFilter ? { pressedFilter } : {})}
          {...(hoveredFilter ? { hoveredFilter } : {})}
          {...(onRowElement ? { onRowElement } : {})}
          {...(onFilterElement ? { onFilterElement } : {})}
          {...(onSearchElement ? { onSearchElement } : {})}
        />
        <PanelHelpFooter width={width} />
      </Box>
    )
  }

  if (panel.kind === 'error') {
    const height = composer?.height ?? errorPanelLayout(panel, width, Math.min(10, terminalHeight - 2)).height
    return (
      <ErrorPanel
        panel={panel}
        width={width}
        height={height}
        scroll={detailScroll}
        {...(onPanelElement ? { onElement: onPanelElement } : {})}
      />
    )
  }

  if (panel.kind === 'detail' || panel.kind === 'help-detail') {
    return (
      <DetailPanel
        panel={panel}
        width={width}
        height={composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT}
        scroll={detailScroll}
        {...(onPanelElement ? { onElement: onPanelElement } : {})}
      />
    )
  }

  if (panel.kind === 'effort') {
    return (
      <EffortPanel
        slider={panel.slider}
        {...(panel.body ? { body: panel.body } : {})}
        width={width}
        height={composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT - 2}
        energyFrame={energyFrame}
        {...(onPanelElement ? { onElement: onPanelElement } : {})}
        {...(onSliderElement ? { onSliderElement } : {})}
      />
    )
  }
  if (panel.kind === 'config') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    return (
      <ConfigurationDock
        configuration={panel.configuration}
        explicit
        language={filter}
        scroll={detailScroll}
        width={width}
        height={height}
        {...(pressedFilter ? { pressedFilter } : {})}
        {...(hoveredFilter ? { hoveredFilter } : {})}
        {...(onPanelElement ? { onElement: onPanelElement } : {})}
        {...(onFilterElement ? { onFilterElement } : {})}
      />
    )
  }
  if (panel.kind === 'permission') {
    return (
      <PermissionPanel
        panel={panel}
        rows={allRows}
        selected={selected}
        viewportStart={viewportStart}
        scroll={detailScroll}
        width={width}
        height={composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT}
        {...(pressedRow !== undefined ? { pressedRow } : {})}
        {...(hoveredRow !== undefined ? { hoveredRow } : {})}
        {...(onPanelElement ? { onPanelElement } : {})}
        {...(onRowElement ? { onRowElement } : {})}
      />
    )
  }
  if (panel.kind === 'sessions') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    const capacity = panelRowCapacity(panel.kind, height, allRows)
    const start = clampViewportStart(viewportStart, allRows.length, capacity)
    return (
      <Box ref={onPanelElement} width={width} height={height} overflow="hidden" flexDirection="column">
        <SessionsPanel
          panel={panel}
          rows={allRows.slice(start, start + capacity)}
          allRows={allRows}
          selected={selected}
          start={start}
          width={width}
          height={Math.max(1, height - 1)}
          query={query}
          filter={filter}
          focus={modelPanelFocus}
          animate={settings.animations}
          {...(pressedFilter ? { pressedFilter } : {})}
          {...(hoveredFilter ? { hoveredFilter } : {})}
          {...(pressedRow !== undefined ? { pressedRow } : {})}
          {...(hoveredRow !== undefined ? { hoveredRow } : {})}
          {...(onFilterElement ? { onFilterElement } : {})}
          {...(onSearchElement ? { onSearchElement } : {})}
          {...(onRowElement ? { onRowElement } : {})}
        />
        <PanelHelpFooter width={width} />
      </Box>
    )
  }
  if (panel.kind === 'voice') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    return (
      <Box ref={onPanelElement} width={width} height={height} overflow="hidden" flexDirection="column">
        <VoicePanel
          title={panel.title}
          rows={allRows}
          selected={selected}
          width={width}
          height={Math.max(1, height - 1)}
          {...(pressedRow !== undefined ? { pressedRow } : {})}
          {...(hoveredRow !== undefined ? { hoveredRow } : {})}
          {...(pressedControl ? { pressedControl } : {})}
          {...(hoveredControl ? { hoveredControl } : {})}
          {...(onRowElement ? { onRowElement } : {})}
          {...(onControlElement ? { onControlElement } : {})}
          {...(onSliderElement ? { onSliderElement } : {})}
        />
        <PanelHelpFooter width={width} />
      </Box>
    )
  }
  if (panel.kind === 'models' || panel.kind === 'settings') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    const capacity = panelRowCapacity(panel.kind, height, allRows)
    const start = clampViewportStart(viewportStart, allRows.length, capacity)
    const rows = allRows.slice(start, start + capacity)
    const modelId = panel.kind === 'models' ? allRows[hoveredRow ?? selected]?.value : undefined
    const sectionProps = {
      rows,
      allRows,
      selected,
      start,
      width,
      // The help footer takes the last row.
      height: Math.max(1, height - 1),
      ...(pressedRow !== undefined ? { pressedRow } : {}),
      ...(hoveredRow !== undefined ? { hoveredRow } : {}),
      ...(onRowElement ? { onRowElement } : {}),
      ...(pressedFilter ? { pressedFilter } : {}),
      ...(hoveredFilter ? { hoveredFilter } : {}),
      ...(onFilterElement ? { onFilterElement } : {}),
    }
    return (
      <Box ref={onPanelElement} width={width} height={height} overflow="hidden" flexDirection="column">
        {panel.kind === 'models' ? (
          <ModelPicker
            {...sectionProps}
            panel={panel}
            query={query}
            filter={filter}
            focus={modelPanelFocus}
            animate={settings.animations}
            {...(onSearchElement ? { onSearchElement } : {})}
          />
        ) : (
          <SettingsPicker
            {...sectionProps}
            panel={panel}
            focus={settingsPanelFocus}
            {...(pressedControl ? { pressedControl } : {})}
            {...(hoveredControl ? { hoveredControl } : {})}
            {...(onControlElement ? { onControlElement } : {})}
          />
        )}
        <PanelHelpFooter width={width} {...(modelId ? { modelId } : {})} />
      </Box>
    )
  }
  if (panel.kind === 'export') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    const capacity = panelRowCapacity(panel.kind, height, allRows)
    const start = clampViewportStart(viewportStart, allRows.length, capacity)
    return (
      <ExportPanel
        panel={panel}
        rows={allRows.slice(start, start + capacity)}
        selected={selected}
        start={start}
        width={width}
        height={height}
        query={query}
        {...(pressedRow !== undefined ? { pressedRow } : {})}
        {...(hoveredRow !== undefined ? { hoveredRow } : {})}
        {...(onPanelElement ? { onPanelElement } : {})}
        {...(onRowElement ? { onRowElement } : {})}
      />
    )
  }
  if (panel.kind === 'tasks') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    const capacity = panelRowCapacity(panel.kind, height, allRows)
    const start = clampViewportStart(viewportStart, allRows.length, capacity)
    return (
      <Box ref={onPanelElement} width={width} height={height} overflow="hidden" flexDirection="column">
        <TasksPanel
          panel={panel}
          rows={allRows.slice(start, start + capacity)}
          allRows={allRows}
          selected={selected}
          start={start}
          width={width}
          height={Math.max(1, height - 1)}
          query={query}
          focus={modelPanelFocus}
          {...(pressedRow !== undefined ? { pressedRow } : {})}
          {...(hoveredRow !== undefined ? { hoveredRow } : {})}
          {...(onRowElement ? { onRowElement } : {})}
          {...(onSearchElement ? { onSearchElement } : {})}
          {...(onSliderElement ? { onSliderElement } : {})}
        />
        <PanelHelpFooter width={width} />
      </Box>
    )
  }
  if (panel.kind === 'permissions') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    const capacity = panelRowCapacity(panel.kind, height, allRows)
    const start = clampViewportStart(viewportStart, allRows.length, capacity)
    return (
      <Box ref={onPanelElement} width={width} height={height} overflow="hidden" flexDirection="column">
        <PermissionsPanel
          panel={panel}
          rows={allRows.slice(start, start + capacity)}
          allRows={allRows}
          selected={selected}
          start={start}
          width={width}
          height={Math.max(1, height - 1)}
          query={query}
          focus={modelPanelFocus}
          {...(pressedRow !== undefined ? { pressedRow } : {})}
          {...(hoveredRow !== undefined ? { hoveredRow } : {})}
          {...(pressedControl ? { pressedControl } : {})}
          {...(hoveredControl ? { hoveredControl } : {})}
          {...(onRowElement ? { onRowElement } : {})}
          {...(onControlElement ? { onControlElement } : {})}
          {...(onSearchElement ? { onSearchElement } : {})}
          {...(onSliderElement ? { onSliderElement } : {})}
        />
        <PanelHelpFooter width={width} />
      </Box>
    )
  }
  if (panel.kind === 'tools' || panel.kind === 'mcp' || panel.kind === 'skills') {
    const height = composer?.height ?? COMPOSER_RESOURCE_PANEL_HEIGHT
    const capacity = panelRowCapacity(panel.kind, height, allRows)
    const start = clampViewportStart(viewportStart, allRows.length, capacity)
    return (
      <ComposerListPanel
        panel={panel}
        rows={allRows.slice(start, start + capacity)}
        allRows={allRows}
        selected={selected}
        start={start}
        width={width}
        height={height}
        query={query}
        {...(pressedRow !== undefined ? { pressedRow } : {})}
        {...(hoveredRow !== undefined ? { hoveredRow } : {})}
        {...(pressedControl ? { pressedControl } : {})}
        {...(hoveredControl ? { hoveredControl } : {})}
        {...(onPanelElement ? { onPanelElement } : {})}
        {...(onRowElement ? { onRowElement } : {})}
        {...(onControlElement ? { onControlElement } : {})}
      />
    )
  }
  const panelHeight = composer?.height ?? terminalHeight
  const capacity = panelRowCapacity(panel.kind, panelHeight, allRows)
  const start = clampViewportStart(viewportStart, allRows.length, capacity)
  const rows = allRows.slice(start, start + capacity)
  const searchable = panel.searchable === true
  const compactList = ['skills', 'mcp', 'tasks', 'permissions', 'tools'].includes(panel.kind)
  const wrapLongContent = allRows.length === 0
  if (panel.kind === 'context') {
    if (context.breakdown) {
      return (
        <ContextPanel
          context={context}
          width={width}
          height={composer?.height ?? 14}
          {...(onPanelElement ? { onPanelElement } : {})}
        />
      )
    }
    const used = context.projectedTokens ?? context.currentTokens
    const wide = width >= 64
    const contentWidth = Math.min(wide ? 96 : 52, width)
    const columnWidth = wide ? Math.floor((contentWidth - 4) / 2) : contentWidth
    const stats = [
      ['Input', context.inputTokens],
      ['Output', context.outputTokens],
      ['Cache read', context.cacheReadInputTokens],
      ['Cache write', context.cacheWriteInputTokens],
    ] as const
    const stat = ([label, tokens]: (typeof stats)[number], statWidth?: number): ReactElement => (
      <Box key={label} {...(statWidth === undefined ? {} : { width: statWidth })} justifyContent="space-between">
        <Text dimColor>{label}</Text>
        <Text>{tokens?.toLocaleString() ?? '—'}</Text>
      </Box>
    )
    return (
      <Box
        ref={onPanelElement}
        width={width}
        {...(composer ? { height: composer.height } : {})}
        flexDirection="column"
        alignItems="center"
        overflow="hidden"
      >
        <Box width={contentWidth} flexGrow={1} flexDirection="column" justifyContent="center" overflow="hidden">
          <Box
            width="100%"
            overflow="hidden"
            {...(wide ? { flexDirection: 'row', justifyContent: 'space-between' } : { flexDirection: 'column' })}
          >
            <Box width={columnWidth} flexShrink={0} flexDirection="column">
              <Text bold color={accent} wrap="truncate-end">
                {panel.title}
              </Text>
              {context.contextWindow ? (
                <Text color={contextColor(context, palette)} wrap="truncate-end">
                  {formatContext(context, Math.max(1, columnWidth - 12))}
                </Text>
              ) : null}
              <Text dimColor wrap="truncate-end">
                {used?.toLocaleString() ?? '—'}
                {context.contextWindow ? ` / ${context.contextWindow.toLocaleString()}` : ''} tokens
              </Text>
              <Text dimColor wrap="truncate-end">
                {used === undefined ? 'Send a message to measure context' : 'Category breakdown unavailable'}
              </Text>
            </Box>
            <Box width={columnWidth} flexShrink={0} flexDirection="column" {...(wide ? {} : { marginTop: 1 })}>
              <Box justifyContent="space-between">
                <Text bold>Last turn</Text>
                <Text>{context.totalTokens?.toLocaleString() ?? '—'} tokens</Text>
              </Box>
              {wide
                ? stats.map((entry) => stat(entry))
                : [stats.slice(0, 2), stats.slice(2)].map((pair) => (
                    <Box key={pair[0]![0]} justifyContent="space-between">
                      {pair.map((entry) => stat(entry, Math.floor((contentWidth - 2) / 2)))}
                    </Box>
                  ))}
            </Box>
          </Box>
        </Box>
        <PanelHelpFooter width={contentWidth} centered />
      </Box>
    )
  }
  const content = (
    <Box
      flexDirection="column"
      overflow="hidden"
      {...(composer ? { height: Math.max(1, composer.height - 1), flexShrink: 0 } : {})}
    >
      <Box paddingX={1} justifyContent="space-between">
        <PanelTitle title={panel.title} color={accent} />
        {allRows.length > capacity ? (
          <Text dimColor>
            {selected + 1}/{allRows.length}
          </Text>
        ) : null}
      </Box>
      {panel.body ? (
        wrapLongContent || checklist ? (
          <Box paddingX={1} flexDirection="column">
            {wrapLines(panel.body ?? '', Math.max(10, width - 5)).map((line, index) => (
              <Text key={`${panel.id}-body-${index}`} {...(checklist ? { color: warning } : {})}>
                {line || ' '}
              </Text>
            ))}
            {checklist ? <Text> </Text> : null}
          </Box>
        ) : (
          <Box paddingX={1}>
            <Text dimColor wrap="truncate-end">
              {(panel.body ?? '').replace(/\n/g, ' | ')}
            </Text>
          </Box>
        )
      ) : null}
      {panel.filters?.length ? (
        <Box paddingX={1} flexWrap="wrap">
          {panel.filters.map((item, index) => {
            const pressed = item.id === pressedFilter
            return (
              <Box
                key={item.id}
                flexShrink={0}
                marginRight={index < panel.filters!.length - 1 ? 1 : 0}
                backgroundColor={item.id === hoveredFilter || pressed ? selection : undefined}
              >
                <Box ref={(element) => onFilterElement?.(item.id, element)}>
                  <Text
                    {...(item.id === filter ? { color: accent } : {})}
                    bold={item.id === filter}
                    dimColor={item.id !== filter}
                    underline={item.id === filter}
                  >
                    {item.label}
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>
      ) : null}
      {searchable ? (
        <Box paddingX={1}>
          <Text dimColor>Search: </Text>
          <Text>
            {query}
            <Cursor />
          </Text>
        </Box>
      ) : null}
      {rows.length === 0 && !panel.body ? (
        <Box paddingX={1}>
          <Text dimColor>No matches</Text>
        </Box>
      ) : (
        rows.map((row, visibleIndex) => {
          const index = start + visibleIndex
          const selectedRow = index === selected && row.value !== undefined
          const rowPressed = index === pressedRow
          const rowColor = TONE_COLORS[row.tone ?? 'normal']
          const description = row.description
          return (
            <Box key={`${panel.id}-${index}`} flexDirection="column">
              {row.section && row.section !== rows[visibleIndex - 1]?.section ? (
                <Box paddingX={checklist ? 2 : 1} marginTop={checklist ? 1 : 0}>
                  <Text {...(checklist ? { color: accent } : {})} dimColor bold>
                    {row.section}
                  </Text>
                </Box>
              ) : null}
              <Box
                ref={(element) => onRowElement?.(index, element)}
                paddingX={checklist ? 2 : 1}
                flexDirection="column"
                backgroundColor={
                  index === hoveredRow || rowPressed || selectedRow ? selection : row.current ? surface : undefined
                }
              >
                <Box justifyContent={panel.kind === 'tools' ? 'flex-start' : 'space-between'}>
                  <PanelItemHeader
                    label={row.label}
                    active={selectedRow}
                    pressed={rowPressed}
                    clickable={row.value !== undefined}
                    {...(row.bold !== undefined ? { bold: row.bold } : {})}
                    color={rowColor ?? accent}
                    wrap={wrapLongContent ? 'wrap' : 'truncate-end'}
                  />
                  {row.control ? (
                    <Box marginLeft={panel.kind === 'tools' ? 2 : 0}>
                      {panel.kind === 'tools' && row.control.kind === 'toggle' ? (
                        <Box
                          ref={(element) => onControlElement?.(panelControlTarget(index, 'toggle'), element)}
                          width={1}
                        >
                          <Text {...(row.control.checked ? { color: accent } : {})} dimColor={!row.control.checked}>
                            {row.control.checked ? '☑' : '☐'}
                          </Text>
                        </Box>
                      ) : (
                        <SettingsControl
                          {...(pressedControl ? { pressedControl } : {})}
                          control={row.control}
                          rowIndex={index}
                          {...(onControlElement ? { onControlElement } : {})}
                        />
                      )}
                    </Box>
                  ) : row.badge ? (
                    <Text color={badgeColor(row.badge.tone)}> {row.badge.text}</Text>
                  ) : null}
                </Box>
                {description && !compactList ? (
                  <Text dimColor wrap={wrapLongContent ? 'wrap' : 'truncate-end'}>
                    {'  '}
                    {description}
                  </Text>
                ) : null}
              </Box>
            </Box>
          )
        })
      )}
      {compactList && allRows[selected]?.description ? (
        <Box paddingX={1} flexDirection="column">
          {wrapLines(allRows[selected]!.description.split('\n')[0]!, Math.max(1, width - 6))
            .slice(0, 3)
            .map((line, index) => (
              <Text key={index} dimColor>
                {line}
              </Text>
            ))}
        </Box>
      ) : null}
    </Box>
  )
  return composer ? (
    <Box ref={onPanelElement} width={width} height={composer.height} flexDirection="column" overflow="hidden">
      {content}
      <PanelHelpFooter width={width} />
    </Box>
  ) : (
    <PanelOverlay width={width} {...(onPanelElement ? { onElement: onPanelElement } : {})}>
      {content}
    </PanelOverlay>
  )
}
