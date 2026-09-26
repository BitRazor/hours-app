# Vestland Fox Finder

Interactive 2D/3D map of where and when to find red foxes (*Vulpes vulpes*) in Vestlandet: Rogaland, Vestland and Møre og Romsdal.

Open `index.html` over HTTP (GitHub Pages or `python3 -m http.server`). It's a static site with no build step.

## Features
- **Chance heatmap** (0–100 relative index) for every ~1.3 km cell, per month.
- **Zero-chance zones**, hatched: sea/fjord and glacier/bare high mountain (>1650 m).
- **Find**: search Norwegian place names (Kartverket stedsnavn API), paste coordinates, use GPS or click the map. Shows the top 8 ranked spots within your radius, with distance, direction, elevation, best months and a Google Maps directions link.
- **Month slider and play button**: see how the map changes through the year (winter snow line, summer uplands).
- **When tab**: sightings per month, sunrise/sunset/twilight for any date and place, a fox activity curve, and "best to watch" time windows.
- **3D**: terrain with draped heatmap, plus optional hotspot columns.
- **Real sightings**: ~2,000 GBIF red fox records, with the selected month highlighted.
- **Arctic fox zones**: coarse areas only. The species is critically endangered, so no den locations are shown.
- Light/dark theme and a mobile bottom-sheet layout.

## Data & model
`tools/` rebuilds `data/`:
1. `fetch.py`: downloads GBIF occurrences (red fox 5219243, arctic fox 5219303) for the area.
2. `dem.py`: builds an elevation mosaic from AWS Terrain Tiles (terrarium, z9 ≈ 150 m).
3. `build.py`: county polygons from Kartverket kommuneinfo (`fylke11.json`, `fylke46.json`, `fylke15.json`) → grid → `data/*.json` and `grid.b64.txt` (base64 of the grid).

The score multiplies **habitat** (elevation, slope, land share), **evidence** (a sighting kernel density with σ≈3.5 km, weighted toward the selected month and blended with the all-year density), a **seasonal elevation shift** (winter pushes foxes below the snow line) and a **visibility** factor (mating Jan–Mar, cubs Jun–Jul, and monthly record counts).

`grid.b64.txt` (base64 of the grid) layout (uint8, row-major, north→south rows equally spaced in Web Mercator): `reason[N] | county[N] | elev/10[N] | score[12][N]`. Reason: 0 = outside, 1 = water, 2 = ice/high alpine, 3 = land.

Limits: sightings follow where people are, lakes aren't masked, and the index is relative, not a probability.

Attribution: © Kartverket, Mapzen/AWS Terrain Tiles, Esri World Imagery, GBIF.org.

## Works offline from outside map servers

The page ships its own terrain tiles (`data/dem`, terrarium zoom 5–9) and a place-name list (`data/places.json`, ~28k names from Kartverket stedsnavn). The base map is coloured from the terrain in the browser. When Kartverket, Esri, AWS terrain or the stedsnavn API are reachable, the app switches to them automatically.
