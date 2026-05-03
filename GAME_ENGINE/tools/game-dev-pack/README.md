# Game Dev Pack Tools

Small utility scripts imported from the research bundle after syntax validation.

These scripts are not called by the engine automatically. Treat them as local helpers for
asset preparation and test workflows.

## Scripts

- `asset-generation/retro-diffusion/prepare_reference_image.py` - prepares local sprite/image references for Retro Diffusion-style workflows.
- `testing/imgdiff.py` - compares two rendered images and writes a diff image when they differ.
- `testing/with_server.py` - starts one or more dev servers, waits for ports, runs a command, then cleans up.

## Notes

The fal runner scripts from the Temp folder were not imported as active tools because the
extracted copies were incomplete or depended on broken helper files. Rebuild fal integration
inside the backend when it becomes part of the product pipeline.
