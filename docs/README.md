# For maintainers

GitHub Pages builds **this folder** as the public documentation site. Internal design history lives in `docs/superpowers/` and is **excluded** from the published site via `_config.yml`.

After forking, edit **`_config.yml`**:

- `url` — your GitHub Pages root (usually `https://<username>.github.io`).
- `baseurl` — your repository name with a leading slash (e.g. `/wedding`) for **Project Pages**.

Leave them as-is if you’re not publishing docs to Pages.
