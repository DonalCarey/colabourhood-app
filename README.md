# Colabourhood

A Leaflet and OpenStreetMap-powered Colabourhood prototype for neighbourhood projects in Ballinacurra Gardens, Limerick.

Open `index.html` in a browser, or run a local static web server from this folder.

The prototype uses the public OpenStreetMap tile service for modest development and pilot use. A production deployment should use a suitable hosted tile provider or self-hosted tiles, while preserving OpenStreetMap attribution and privacy-aware location handling.

Projects support two geographic scopes:

- Place-based projects appear as pins at their latitude and longitude.
- Neighbourhood-wide projects appear as map overlays and highlight the Ballinacurra Gardens boundary, without assigning them a misleading point location.

Each seeded project also has a stable detail page under `/projects/<project-slug>/`. These pages contain the overview, media, action plan, supporters, resource commitments, transparent funding ledger and chronological updates.
