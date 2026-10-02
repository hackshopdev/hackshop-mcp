# CAD fabrication packages

Hackshop can generate printable fabrication packages for catalog devices with
trusted physical dimensions. Today this includes desk stands for the Muse gadget
devices that list `physical.printables: ["desk-stand"]`.

Generated packages live at:

```text
site/public/cad/<device_id>/<part>.stl
site/public/cad/<device_id>/<part>.step
site/public/cad/<device_id>/<part>.svg
site/public/cad/<device_id>/<part>.fab.json
site/public/cad/manifest.json
```

Regenerate the committed set from the repo root:

```bash
cd sim-worker
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python -e ".[dev,cad]"
.venv/bin/python -m hackshop_sim.cad.generate --catalog ../catalog.json --out ../site/public/cad
```

Generate one package with measured dimensions or custom parameters:

```bash
cd sim-worker
.venv/bin/python -m hackshop_sim.cad.generate \
  --catalog ../catalog.json \
  --device espressif-esp32-c5-devkitc-1 \
  --part enclosure \
  --t 12.0 \
  --param wall=2.4 \
  --out ../site/public/cad
```

Limits:

- Hackshop generates files only; it does not place print or machining orders.
- Catalog generation requires numeric width, height, and thickness with
  `published` or `drawing` confidence, unless measured overrides are supplied.
- The desk stand assumes a straight USB-C plug no larger than 12.5 x 7 mm.
- STEP files are included for inspection and quoting, but these parts are
  designed for FDM printing and may need redesign for CNC or sheet metal.
