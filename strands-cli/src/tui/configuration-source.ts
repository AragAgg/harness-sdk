import { readFileSync } from 'node:fs'

import type { HarnessAgentConfig } from '@strands-agents/harness'

import type { ChatConfigurationDocument, ChatConfigurationLanguage, ChatConfigurationSource } from './chat/types.js'
import type { ImportedAgentProject } from './project/import.js'
import { prepareAgentProject } from './project/export.js'
import { agentProjectSource } from './project/source.js'
import { resolveSkillPaths } from './skills.js'
import { errorMessage } from './terminal/sanitize.js'

const CONFIGURATION_LANGUAGES = ['typescript', 'python'] as const

export function configurationSource(
  profile: HarnessAgentConfig,
  project?: ImportedAgentProject,
  baseDir = process.cwd()
): ChatConfigurationSource {
  const documents = Object.fromEntries(
    CONFIGURATION_LANGUAGES.map((language) => [language, configurationDocument(profile, language, project, baseDir)])
  ) as Record<ChatConfigurationLanguage, ChatConfigurationDocument>
  return {
    preferredLanguage: project?.language ?? 'typescript',
    documents,
    ...(project ? { project: { root: project.root, entrypoint: project.entrypoint } } : {}),
  }
}

function configurationDocument(
  profile: HarnessAgentConfig,
  language: ChatConfigurationLanguage,
  project: ImportedAgentProject | undefined,
  baseDir: string
): ChatConfigurationDocument {
  if (project) {
    if (project.language !== language) {
      return {
        source: '',
        generated: false,
        error: `This agent is authored in ${project.language}; export it in the same language to preserve its code.`,
      }
    }
    try {
      return {
        source: readFileSync(project.entrypoint, 'utf8'),
        generated: false,
        path: project.entrypoint,
      }
    } catch (error) {
      return {
        source: '',
        generated: false,
        path: project.entrypoint,
        error: `Could not read ${project.entrypoint}: ${errorMessage(error)}`,
      }
    }
  }
  return generatedDocument(profile, language, baseDir)
}

function generatedDocument(
  profile: HarnessAgentConfig,
  language: ChatConfigurationLanguage,
  baseDir: string
): ChatConfigurationDocument {
  try {
    const skillPaths = resolveSkillPaths(
      typeof profile.skills === 'object' ? [...profile.skills] : profile.skills,
      baseDir,
      false
    )
    const { config } = prepareAgentProject(profile, language, skillPaths, baseDir)
    return {
      source: agentProjectSource(config, language),
      generated: true,
    }
  } catch (error) {
    return {
      source: language === 'python' ? '# Configuration unavailable' : '// Configuration unavailable',
      generated: true,
      error: errorMessage(error),
    }
  }
}
