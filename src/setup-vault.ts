import * as core from '@actions/core';
import * as installer from './installer';

async function run() {
  try {
    //
    // Version is optional.  If supplied, install / use from the tool cache
    //
    const version = core.getInput('version');
    if (version) {
      await installer.getVault(version);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
