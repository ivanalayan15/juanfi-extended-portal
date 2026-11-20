# Portal infrastructure and storage

The portal is a static HTML, CSS, and JavaScript bundle served by the hotspot. RouterOS expands template variables on the device. The loader uses the router-provided configuration at `/juanfi-extended.json` to choose between local assets and the configured Opi portal service. Standalone file previews use bundled assets.

This project defines no server database, table relationships, or schema migrations. Client scripts use origin-scoped local and session storage and can fall back to page memory. Hotspot addresses and session details come from each installation at runtime.
