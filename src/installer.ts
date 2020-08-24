import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as os from 'os'
import * as semver from 'semver'
import * as util from 'util'
import * as httpm from '@actions/http-client'
import * as ifm from './interfaces'

const osArch: string = translateOsArch(os.arch())
const osPlat: string = translateOsPlatform(os.platform())

export async function getVault(versionSpec: string): Promise<void> {
  let toolPath: string
  toolPath = tc.find('vault', versionSpec)

  if (!toolPath) {
    const version = await queryLatestMatch(versionSpec)
    if (!version) {
      throw new Error(
        `Unable to find Vault version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`
      )
    }

    toolPath = await acquireVault(version)
    core.debug(`Vault tool is cached under ${toolPath}`)
  }

  core.addPath(toolPath)
}

async function queryLatestMatch(versionSpec: string): Promise<string> {
  const versions: string[] = []
  const http = new httpm.HttpClient('setup-vault', [], {
    allowRetries: true,
    maxRetries: 3
  })
  const url = 'https://releases.hashicorp.com/vault/index.json'
  const response = await http.getJson<ifm.Product>(url)

  const obj = response.result
  if (obj && obj.versions) {
    for (const version of Object.values(obj.versions)) {
      const supportedBuild = version.builds.find(
        build => osPlat === build.os && osArch === build.arch
      )
      if (supportedBuild && semver.valid(supportedBuild.version)) {
        versions.push(supportedBuild.version)
      }
    }
  }

  return evaluateVersions(versions, versionSpec)
}

async function acquireVault(version: string): Promise<string> {
  const downloadUrl: string = getDownloadUrl(version)
  let downloadPath: string | null = null
  try {
    downloadPath = await tc.downloadTool(downloadUrl)
  } catch (error) {
    core.debug(error)

    throw new Error(`Failed to download version ${version}: ${error}`)
  }

  const extPath: string = await tc.extractZip(downloadPath)

  return await tc.cacheDir(extPath, 'vault', version)
}

function getDownloadUrl(version: string): string {
  return util.format(
    `https://releases.hashicorp.com/vault/%s/vault_%s_%s_%s.zip`,
    version,
    version,
    osPlat,
    osArch
  )
}

function translateOsArch(arch: string): string {
  switch (arch) {
    case 'x64':
      return 'amd64'
    case 'x32':
      return '386'
    default:
      return arch
  }
}

function translateOsPlatform(platform: string): string {
  switch (platform) {
    case 'win32':
      return 'windows'
    default:
      return platform
  }
}

//
// Lifted directly from @actions/tool-cache, assuming
// this will be exported in a future version.
//
export function evaluateVersions(
  versions: string[],
  versionSpec: string
): string {
  let version = ''
  core.debug(`evaluating ${versions.length} versions`)
  versions = versions.sort((a, b) => {
    if (semver.gt(a, b)) {
      return 1
    }
    return -1
  })
  for (let i = versions.length - 1; i >= 0; i--) {
    const potential: string = versions[i]
    const satisfied: boolean = semver.satisfies(potential, versionSpec)
    if (satisfied) {
      version = potential
      break
    }
  }

  if (version) {
    core.debug(`matched: ${version}`)
  } else {
    core.debug('match not found')
  }

  return version
}
