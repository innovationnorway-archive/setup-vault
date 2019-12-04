"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load tempDirectory before it gets wiped by tool-cache
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
const core = __importStar(require("@actions/core"));
const tc = __importStar(require("@actions/tool-cache"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const util = __importStar(require("util"));
const semver = __importStar(require("semver"));
const restm = __importStar(require("typed-rest-client/RestClient"));
// os.arch and os.platform does not always match the download url
const osPlat = os.platform() == 'win32' ? 'windows' : os.platform();
const osArch = os.arch() == 'x64' ? 'amd64' : '386';
if (!tempDirectory) {
    let baseLocation;
    if (process.platform === 'win32') {
        // On windows use the USERPROFILE env variable
        baseLocation = process.env['USERPROFILE'] || 'C:\\';
    }
    else {
        if (process.platform === 'darwin') {
            baseLocation = '/Users';
        }
        else {
            baseLocation = '/home';
        }
    }
    tempDirectory = path.join(baseLocation, 'actions', 'temp');
}
function getVault(version) {
    return __awaiter(this, void 0, void 0, function* () {
        // check cache
        let toolPath;
        toolPath = tc.find('vault', version);
        // If not found in cache
        if (!toolPath) {
            // query releases.hashicorp.com for a matching version
            version = yield queryLatestMatch(version);
            if (!version) {
                throw new Error(`Unable to find matching version for platform ${osPlat} and architecture ${osArch}.`);
            }
            // download, extract, cache
            toolPath = yield acquireVault(version);
            core.debug('Vault tool is cached under ' + toolPath);
        }
        //
        // prepend the tools path. instructs the agent to prepend for future tasks
        //
        core.addPath(toolPath);
    });
}
exports.getVault = getVault;
function acquireVault(version) {
    return __awaiter(this, void 0, void 0, function* () {
        //
        // Download - a tool installer intimately knows how to get the tool (and construct urls)
        //
        let downloadUrl = getDownloadUrl(version);
        let downloadPath = null;
        try {
            downloadPath = yield tc.downloadTool(downloadUrl);
        }
        catch (error) {
            core.debug(error);
            throw 'Failed to get current version';
        }
        //
        // Extract
        //
        let extPath = tempDirectory;
        if (!extPath) {
            throw new Error('Temp directory not set');
        }
        extPath = yield tc.extractZip(downloadPath);
        //
        // Install into the local tool cache
        //
        return yield tc.cacheDir(extPath, 'vault', version);
    });
}
function queryLatestMatch(versionSpec) {
    return __awaiter(this, void 0, void 0, function* () {
        let versions = [];
        let rest = new restm.RestClient('setup-vault');
        let release = (yield rest.get('https://releases.hashicorp.com/vault/index.json')).result;
        if (release && release.versions) {
            Object.values(release.versions).forEach((version) => {
                // ensure this version supports your os and platform
                const build = version.builds.find(build => osPlat == build.os && osArch == build.arch);
                if (build) {
                    versions.push(build.version);
                }
            });
        }
        // get the latest version that matches the version spec
        let version = evaluateVersions(versions, versionSpec);
        return version;
    });
}
function getDownloadUrl(version) {
    return util.format(`https://releases.hashicorp.com/vault/%s/vault_%s_%s_%s.zip`, version, version, osPlat, osArch);
}
//
// Lifted directly from @actions/tool-cache, assuming
// these will be exported in a future version.
//
function isExplicitVersion(versionSpec) {
    const c = semver.clean(versionSpec) || '';
    core.debug(`isExplicit: ${c}`);
    const valid = semver.valid(c) != null;
    core.debug(`explicit? ${valid}`);
    return valid;
}
function evaluateVersions(versions, versionSpec) {
    let version = '';
    core.debug(`evaluating ${versions.length} versions`);
    versions = versions.sort((a, b) => {
        if (semver.gt(a, b)) {
            return 1;
        }
        return -1;
    });
    for (let i = versions.length - 1; i >= 0; i--) {
        const potential = versions[i];
        const satisfied = semver.satisfies(potential, versionSpec);
        if (satisfied) {
            version = potential;
            break;
        }
    }
    if (version) {
        core.debug(`matched: ${version}`);
    }
    else {
        core.debug('match not found');
    }
    return version;
}
