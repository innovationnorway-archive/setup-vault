# setup-vault

<p align="left">
  <a href="https://github.com/innovationnorway/setup-vault"><img alt="GitHub Actions status" src="https://github.com/innovationnorway/setup-vault/workflows/build-test/badge.svg"></a>
</p>

This action sets up a [Vault](https://www.vaultproject.io/docs) environment for use in actions by:

- optionally downloading and caching a version of Vault by version and adding to `PATH`

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@v2
- uses: innovationnorway/setup-vault@v1
  with:
    version: '~1.4'
- run: vault version
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
