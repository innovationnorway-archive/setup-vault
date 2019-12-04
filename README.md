# setup-vault

<p align="left">
  <a href="https://github.com/volcano-coffee-company/setup-vault"><img alt="GitHub Actions status" src="https://github.com/volcano-coffee-company/setup-vault/workflows/Main%20workflow/badge.svg"></a>
</p>

This action sets up a [Vault](https://www.vaultproject.io/) environment for use in actions by:

- optionally downloading and caching a version of Vault by version and adding to `PATH`

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@master
- uses: volcano-coffee-company/setup-vault@v1
  with:
    version: '1.3'
- run: vault version
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
