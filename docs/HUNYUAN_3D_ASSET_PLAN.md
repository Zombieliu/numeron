# Hunyuan 3D Asset Plan

This document defines the first 3D art pass for `Numeron` using Tencent Hunyuan 3D Studio as the primary generation tool.

The goal is not a full character-animation production pipeline. The goal is to replace the current shared placeholder model with distinct, readable, game-ready static `glb` assets that fit the existing `0.0.7` runtime.

## Current Runtime Constraint

The current battlefield presentation:

- already supports loading static `glb` scenes for units
- does not yet depend on skeletal animation playback
- benefits most from strong silhouette, clean faction color blocking, and low-to-mid complexity game assets

That means the most practical Hunyuan 3D workflow is:

1. prepare clean concept or render reference images
2. use Hunyuan `image-to-3d` or controlled `text-to-3d`
3. clean the mesh in Blender
4. export `glb`
5. test in the runtime

## Production Priorities

### P0 Must-Have

- `10` unit character models as `glb`
- `1` modular board environment kit
- `3` to `5` simple 3D board markers or props for interaction readability

### P1 Worth Adding

- role-specific base variants
- faction-specific base variants
- star-up adornments or crowns
- environment dressing props

### P2 Later

- animations
- VFX meshes
- alternate skins
- star-specific unit variants

## Asset List

### Unit Characters

These correspond to the existing runtime archetypes:

1. `verdant-bruiser`
2. `signal-ranger`
3. `ash-duelist`
4. `iron-vanguard`
5. `frost-oracle`
6. `ember-medic`
7. `volt-juggler`
8. `grave-warden`
9. `lumen-sentinel`
10. `shade-runner`

Recommended first batch if time is limited:

1. `iron-vanguard`
2. `verdant-bruiser`
3. `grave-warden`
4. `signal-ranger`
5. `ash-duelist`
6. `frost-oracle`

### Board Environment Kit

Minimum useful set:

- `board-ground-main.glb`
- `board-ground-player.glb`
- `board-ground-enemy.glb`
- `board-border-long.glb`
- `board-border-short.glb`
- `board-corner.glb`
- `board-prop-crate.glb`
- `board-prop-beacon.glb`
- `board-prop-banner.glb`

### Readability Props

- `base-vanguard.glb`
- `base-skirmisher.glb`
- `marker-selection.glb`
- `marker-deploy-valid.glb`
- `marker-deploy-blocked.glb`

## Output Spec

Use these as default delivery targets unless a specific asset needs an exception.

### Format

- `glb`

### Geometry

- target range: `10k` to `25k` triangles per unit
- first-pass board props: `1k` to `8k` triangles each
- avoid excessive floating micro-detail

### Materials

- prefer `1` material per unit, `2` max
- use baked detail where possible
- avoid reliance on heavy runtime transparency

### Textures

- default `1024x1024`
- `2048x2048` only for hero assets if clearly justified
- prefer compact PBR sets

### Orientation

- foot contact centered at origin
- upright on `Y`
- all units facing the same forward direction

### Scale

- keep unit heights visually consistent
- allow vanguards to feel heavier and wider
- allow skirmishers to feel lighter and narrower

### Visual Readability

Prioritize:

- strong silhouette
- readable weapon profile
- readable head and shoulder shape
- clear faction color blocking
- readability from isometric or 2.5D camera distance

Do not prioritize:

- facial realism
- very fine surface noise
- tiny props that disappear at gameplay camera distance

## Folder Layout

Recommended import layout:

```text
assets/numeron/models/units/verdant-bruiser.glb
assets/numeron/models/units/signal-ranger.glb
assets/numeron/models/units/ash-duelist.glb
assets/numeron/models/units/iron-vanguard.glb
assets/numeron/models/units/frost-oracle.glb
assets/numeron/models/units/ember-medic.glb
assets/numeron/models/units/volt-juggler.glb
assets/numeron/models/units/grave-warden.glb
assets/numeron/models/units/lumen-sentinel.glb
assets/numeron/models/units/shade-runner.glb

assets/numeron/models/board/board-ground-main.glb
assets/numeron/models/board/board-ground-player.glb
assets/numeron/models/board/board-ground-enemy.glb
assets/numeron/models/board/board-border-long.glb
assets/numeron/models/board/board-border-short.glb
assets/numeron/models/board/board-corner.glb
assets/numeron/models/board/board-prop-crate.glb
assets/numeron/models/board/board-prop-beacon.glb
assets/numeron/models/board/board-prop-banner.glb

assets/numeron/models/markers/base-vanguard.glb
assets/numeron/models/markers/base-skirmisher.glb
assets/numeron/models/markers/marker-selection.glb
assets/numeron/models/markers/marker-deploy-valid.glb
assets/numeron/models/markers/marker-deploy-blocked.glb
```

## Recommended Hunyuan Workflow

### Character Workflow

1. create a single clean reference image
2. generate a base character in Hunyuan 3D Studio
3. reject outputs with weak silhouette or mushy weapons
4. clean mesh and pivot in Blender
5. simplify materials if needed
6. export `glb`
7. test in game camera before approving

### Environment Workflow

1. generate simpler modular pieces, not a giant full scene
2. keep top surfaces readable
3. avoid thin breakable geometry
4. test under current game lighting before approval

## Acceptance Checklist

A unit model is acceptable when:

- it reads clearly from the current gameplay camera
- it is recognizable by role without UI text
- it exports to `glb`
- it loads into the runtime without obvious scale or pivot issues
- it does not materially worsen startup or scene performance

A board asset is acceptable when:

- deployment tiles remain readable
- units do not visually disappear into the ground
- player and enemy sides are distinguishable
- the model does not create visual clutter around health bars or slot readability
