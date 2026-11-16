# Spheres Home

Spheres Home adds a plugin page with the Spheres welcome animation and links to
the built-in Messages and Agents pages. Its specialist cards give sample requests
and copyable starter instructions for Marketing, Sales, Finance, Customer
Support, and Data. Open Agents to paste those instructions into a Codex agent's
Identity settings. The plugin bundles the existing avatar renderer and paper
artwork in a single module.

Run this from the repository root to build the installable folder.

```sh
bin/node scripts/build-spheres-home.mjs
```

In Spheres, open **Settings → Plugins → Manage plugins → Add → Browse**. Select
`dist-plugins/spheres-home`. If Spheres shows a review, choose **Install plugin**.
Open **Spheres Home** from the app dock.

Pass an output directory as the first argument to build the same plugin into a
different folder.
