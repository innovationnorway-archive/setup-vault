import io = require('@actions/io')
import fs = require('fs')
import os = require('os')
import path = require('path')

const toolDir = path.join(__dirname, 'runner', 'tools')
const tempDir = path.join(__dirname, 'runner', 'temp')

process.env['RUNNER_TOOL_CACHE'] = toolDir
process.env['RUNNER_TEMP'] = tempDir
import * as installer from '../src/installer'

const IS_WINDOWS = process.platform === 'win32'

describe('installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir)
    await io.rmRF(tempDir)
  }, 100000)

  afterAll(async () => {
    try {
      await io.rmRF(toolDir)
      await io.rmRF(tempDir)
    } catch {
      console.log('Failed to remove test directories')
    }
  }, 100000)

  it('Acquires version of Vault if no matching version is installed', async () => {
    await installer.getVault('1.4.0')
    const vaultDir = path.join(toolDir, 'vault', '1.4.0', os.arch())

    expect(fs.existsSync(`${vaultDir}.complete`)).toBe(true)
    if (IS_WINDOWS) {
      expect(fs.existsSync(path.join(vaultDir, 'vault.exe'))).toBe(true)
    } else {
      expect(fs.existsSync(path.join(vaultDir, 'vault'))).toBe(true)
    }
  }, 100000)

  it('Throws if no location contains correct vault version', async () => {
    let thrown = false
    try {
      await installer.getVault('99.0.0')
    } catch {
      thrown = true
    }
    expect(thrown).toBe(true)
  })

  it('Uses version of vault installed in cache', async () => {
    const vaultDir: string = path.join(toolDir, 'vault', '98.0.0', os.arch())
    await io.mkdirP(vaultDir)
    fs.writeFileSync(`${vaultDir}.complete`, 'hello')
    // This will throw if it doesn't find it in the cache (because no such version exists)
    await installer.getVault('98.0.0')
    return
  })

  it('Doesnt use version of vault that was only partially installed in cache', async () => {
    const vaultDir: string = path.join(toolDir, 'vault', '97.0.0', os.arch())
    await io.mkdirP(vaultDir)
    let thrown = false
    try {
      // This will throw if it doesn't find it in the cache (because no such version exists)
      await installer.getVault('97.0.0')
    } catch {
      thrown = true
    }
    expect(thrown).toBe(true)
    return
  })

  it('Resolves semantic versions installed in cache', async () => {
    const vaultDir: string = path.join(toolDir, 'vault', '96.0.0', os.arch())
    await io.mkdirP(vaultDir)
    fs.writeFileSync(`${vaultDir}.complete`, 'hello')
    // These will throw if it doesn't find it in the cache (because no such version exists)
    await installer.getVault('96.0.0')
    await installer.getVault('96')
    await installer.getVault('96.0')
  })
})
