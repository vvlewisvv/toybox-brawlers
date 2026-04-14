import { BoxGeometry, Mesh, SphereGeometry } from 'three'
import { applyProceduralVisualSizing } from '../gameplay/character/characterVisualSizing'
import { createFighterVisualsRoot, type PlaceholderFighterMesh } from './placeholderFighterMesh'
import {
  createPlushFabricMaterial,
  createPlushGlossAccentMaterial,
  createPlushSoftPatchMaterial,
} from './plushMaterials'

/**
 * Chomp — polished green plush theropod (ref: cream belly + seam, yellow back plates, open maw with tongue,
 * “button” eyes with warm ring, white claw tips). Torso `body` drives combat tint / emissive.
 */
export function createChompDinosaurMesh(): PlaceholderFighterMesh {
  const { root, visuals } = createFighterVisualsRoot()

  const scaleGreen = createPlushFabricMaterial(0x38a062, { roughness: 0.78, sheen: 0.64 })
  const belly = createPlushSoftPatchMaterial(0xe8dcc8, { roughness: 0.74, sheen: 0.5 })
  const bellyStitch = createPlushFabricMaterial(0xb8a090, {
    roughness: 0.82,
    skipSurfaceMaps: true,
    sheen: 0.32,
  })
  const deepGreen = createPlushFabricMaterial(0x265d40, { roughness: 0.84 })
  const jawMat = createPlushFabricMaterial(0x42c078, { roughness: 0.7, normalScale: 0.24 })
  const toothMat = createPlushGlossAccentMaterial(0xecf2ea, { roughness: 0.44 })
  const plateGold = createPlushGlossAccentMaterial(0xf2d85c, {
    roughness: 0.52,
    clearcoat: 0.38,
  })
  const tongueMat = createPlushSoftPatchMaterial(0xd84c4c, { roughness: 0.68 })
  const eyeRing = createPlushGlossAccentMaterial(0xf5b830, { roughness: 0.45 })

  const bodyH = 1.38
  const body = new Mesh(new BoxGeometry(0.78, bodyH, 0.56), scaleGreen)
  body.castShadow = false
  body.receiveShadow = false
  visuals.add(body)

  const bellyPatch = new Mesh(new BoxGeometry(0.34, 0.58, 0.08), belly)
  bellyPatch.position.set(0, -0.08, 0.32)
  visuals.add(bellyPatch)
  const seam = new Mesh(new BoxGeometry(0.02, 0.52, 0.1), bellyStitch)
  seam.position.set(0, -0.08, 0.37)
  visuals.add(seam)

  const head = new Mesh(new SphereGeometry(0.4, 18, 14), scaleGreen)
  head.position.set(0, 0.76, -0.06)
  visuals.add(head)

  const snout = new Mesh(new BoxGeometry(0.36, 0.22, 0.44), jawMat)
  snout.position.set(0, 0.68, -0.38)
  visuals.add(snout)

  const jawLower = new Mesh(new BoxGeometry(0.32, 0.1, 0.28), deepGreen)
  jawLower.position.set(0, 0.56, -0.36)
  visuals.add(jawLower)

  const tongue = new Mesh(new BoxGeometry(0.2, 0.06, 0.22), tongueMat)
  tongue.position.set(0, 0.6, -0.42)
  visuals.add(tongue)

  for (let i = 0; i < 6; i++) {
    const tooth = new Mesh(new BoxGeometry(0.045, 0.09, 0.045), toothMat)
    tooth.position.set(-0.14 + i * 0.055, 0.64, -0.52)
    visuals.add(tooth)
  }

  const eyeWhite = new Mesh(new SphereGeometry(0.09, 10, 8), toothMat)
  eyeWhite.position.set(-0.16, 0.82, -0.12)
  const eyeWhiteR = new Mesh(new SphereGeometry(0.09, 10, 8), toothMat)
  eyeWhiteR.position.set(0.16, 0.82, -0.12)
  visuals.add(eyeWhite, eyeWhiteR)
  const irisL = new Mesh(new SphereGeometry(0.055, 8, 6), eyeRing)
  irisL.position.set(-0.16, 0.82, -0.18)
  const irisR = new Mesh(new SphereGeometry(0.055, 8, 6), eyeRing)
  irisR.position.set(0.16, 0.82, -0.18)
  visuals.add(irisL, irisR)
  const pupilL = new Mesh(new SphereGeometry(0.038, 6, 4), deepGreen)
  pupilL.position.set(-0.16, 0.82, -0.22)
  const pupilR = new Mesh(new SphereGeometry(0.038, 6, 4), deepGreen)
  pupilR.position.set(0.16, 0.82, -0.22)
  visuals.add(pupilL, pupilR)

  const armGeo = new BoxGeometry(0.16, 0.28, 0.2)
  const armL = new Mesh(armGeo, deepGreen)
  armL.position.set(-0.48, 0.22, 0.08)
  const armR = new Mesh(new BoxGeometry(0.16, 0.28, 0.2), deepGreen)
  armR.position.set(0.48, 0.22, 0.08)
  visuals.add(armL, armR)

  for (let a = 0; a < 2; a++) {
    const ax = a === 0 ? -0.52 : 0.52
    for (let c = 0; c < 3; c++) {
      const claw = new Mesh(new BoxGeometry(0.04, 0.06, 0.05), toothMat)
      claw.position.set(ax + (a === 0 ? -0.02 : 0.02), 0.08 + c * 0.04, 0.12)
      visuals.add(claw)
    }
  }

  const thighL = new Mesh(new BoxGeometry(0.22, 0.32, 0.24), deepGreen)
  thighL.position.set(-0.22, -0.62, 0.06)
  const thighR = new Mesh(new BoxGeometry(0.22, 0.32, 0.24), deepGreen)
  thighR.position.set(0.22, -0.62, 0.06)
  visuals.add(thighL, thighR)

  const tail = new Mesh(new BoxGeometry(0.34, 0.28, 0.72), deepGreen)
  tail.position.set(0, -0.2, 0.52)
  tail.rotation.x = 0.12
  visuals.add(tail)

  for (let i = 0; i < 5; i++) {
    const ridge = new Mesh(new BoxGeometry(0.1 + i * 0.03, 0.12, 0.16), plateGold)
    ridge.position.set(0, 0.32 + i * 0.13, 0.24)
    visuals.add(ridge)
  }

  const assets: PlaceholderFighterMesh = {
    root,
    visuals,
    body,
    standHalfHeight: bodyH * 0.5,
    rig: { armL, armR, head },
  }
  applyProceduralVisualSizing(assets, 'chomp')
  return assets
}
