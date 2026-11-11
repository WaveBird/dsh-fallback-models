# Contributing

Thanks for taking the time to improve `dsh-fallback-models`.

## Development

```bash
npm install
npm test
```

The plugin has no build step:

- `index.js` and `lib/*.js` are plain ESM loaded by the DSH Host.
- `client.js` is loaded by `window.__ModuleLoader__` in the browser.
- `cordis.patch.yml` declares the single Host row.

To test in a live profile, install the folder through the DSH plugin manager:

```jsonc
plugin_manager { "action": "install_bundle", "target": "/absolute/path/to/dsh-fallback-models" }
```

Then refresh the Web GUI. See [INSTALL.md](INSTALL.md) for the full acceptance procedure.

## Pull requests

- Keep the Host half free of browser-only imports and the Client half free of Node-only imports.
- Preserve the no-build-step property: no `src/`, no bundler, no generated remote.
- Add or update a test in `test/` for behavior changes in the failover engine, config resolution, or client registration.
- Update both `README.md` and `README.zh.md` when user-visible behavior changes.
- Do not commit credentials, profile patches, or session data.

## Reporting issues

Please include the DSH version, profile type (Web / desktop / headless), provider route names, and the relevant `fallback-models` section of `cordis.patch.yml` with any secrets removed.
