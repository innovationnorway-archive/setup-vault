// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as semver from 'semver';
import * as restm from 'typed-rest-client/RestClient';

// os.arch and os.platform does not always match the download url
const osPlat: string = os.platform() == 'win32' ? 'windows' : os.platform();
const osArch: string = os.arch() == 'x64' ? 'amd64' : '386';

if (!tempDirectory) {
  let baseLocation;
  if (process.platform === 'win32') {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\';
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users';
    } else {
      baseLocation = '/home';
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

export async function getVault(version: string) {
  // check cache
  let toolPath: string;
  toolPath = tc.find('vault', version);

  // If not found in cache
  if (!toolPath) {
    // query releases.hashicorp.com for a matching version
    version = await queryLatestMatch(version);
    if (!version) {
      throw new Error(
        `Unable to find matching version for platform ${osPlat} and architecture ${osArch}.`
      );
    }

    // download, extract, cache
    toolPath = await acquireVault(version);
    core.debug('Vault tool is cached under ' + toolPath);
  }

  //
  // prepend the tools path. instructs the agent to prepend for future tasks
  //
  core.addPath(toolPath);
}

async function acquireVault(version: string): Promise<string> {
  //
  // Download - a tool installer intimately knows how to get the tool (and construct urls)
  //
  let downloadUrl: string = getDownloadUrl(version);
  let downloadPath: string | null = null;
  try {
    downloadPath = await tc.downloadTool(downloadUrl);
  } catch (error) {
    core.debug(error);

    throw 'Failed to get current version';
  }

  //
  // Extract
  //
  let extPath: string = tempDirectory;
  if (!extPath) {
    throw new Error('Temp directory not set');
  }

  extPath = await tc.extractZip(downloadPath);

  //
  // Install into the local tool cache
  //
  return await tc.cacheDir(extPath, 'vault', version);
}

//
// Vault versions interface
// see https://releases.hashicorp.com/vault/index.json
//
interface Build {
  name: string;
  version: string;
  os: string;
  arch: string;
  filename: string;
  url: string;
}

interface Version {
  name: string;
  version: string;
  shasums: string;
  shasums_signature: string;
  builds: Build[];
}

interface Versions {
  [version: string]: Version;
}

interface Release {
  name: string;
  versions: Versions;
}

async function queryLatestMatch(versionSpec: string): Promise<string> {
  let versions: string[] = [];
  let rest: restm.RestClient = new restm.RestClient('setup-vault');
  let release: Release | null = (
    await rest.get<Release>('https://releases.hashicorp.com/vault/index.json')
  ).result;

  if (release && release.versions) {
    Object.values(release.versions).forEach((version: Version) => {
      // ensure this version supports your os and platform
      const build = version.builds.find(
        build => osPlat == build.os && osArch == build.arch
      );
      if (build) {
        versions.push(build.version);
      }
    });
  }

  // get the latest version that matches the version spec
  let version: string = evaluateVersions(versions, versionSpec);
  return version;
}

function getDownloadUrl(version: string): string {
  return util.format(
    `https://releases.hashicorp.com/vault/%s/vault_%s_%s_%s.zip`,
    version,
    version,
    osPlat,
    osArch
  );
}

//
// Lifted directly from @actions/tool-cache, assuming
// these will be exported in a future version.
//
function isExplicitVersion(versionSpec: string): boolean {
  const c = semver.clean(versionSpec) || '';
  core.debug(`isExplicit: ${c}`);

  const valid = semver.valid(c) != null;
  core.debug(`explicit? ${valid}`);

  return valid;
}

function evaluateVersions(versions: string[], versionSpec: string): string {
  let version = '';
  core.debug(`evaluating ${versions.length} versions`);
  versions = versions.sort((a, b) => {
    if (semver.gt(a, b)) {
      return 1;
    }
    return -1;
  });
  for (let i = versions.length - 1; i >= 0; i--) {
    const potential: string = versions[i];
    const satisfied: boolean = semver.satisfies(potential, versionSpec);
    if (satisfied) {
      version = potential;
      break;
    }
  }

  if (version) {
    core.debug(`matched: ${version}`);
  } else {
    core.debug('match not found');
  }

  return version;
}
