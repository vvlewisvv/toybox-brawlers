import { BoxGeometry, Mesh, SphereGeometry } from 'three'
import { applyProceduralVisualSizing } from '../gameplay/character/characterVisualSizing'
import { createFighterVisualsRoot, type PlaceholderFighterMesh } from './placeholderFighterMesh'
import {
  createPlushFabricMaterial,
  createPlushGlossAccentMaterial,
  createPlushSoftPatchMaterial,
  createPlushPupilMaterial,
} from './plushMaterials'

/**
 * Bibi — blue plush “critter” (ref: rabbit-ear silhouette, purple patches, cream belly, glossy button eyes,
 * toothy grin). Torso `body` is the combat tint target.
 */
export function createBibiBearMesh(): PlaceholderFighterMesh {
  const { root, visuals } = createFighterVisualsRoot()

  const furBlue = createPlushFabricMaterial(0x5aa0d8, { roughness: 0.8, sheen: 0.62 })
  const furDeep = createPlushFabricMaterial(0x3d78b8, { roughness: 0.84 })
  const patchPurple = createPlushFabricMaterial(0x7a48c8, { roughness: 0.78, sheen: 0.55 })
  const furLight = createPlushSoftPatchMaterial(0xf2ead8, { roughness: 0.74, sheen: 0.48 })
  const snootMat = createPlushSoftPatchMaterial(0xe8f2fc, {
    roughness: 0.68,
    normalScale: 0.1,
    sheen: 0.44,
  })
  const toothMat = createPlushGlossAccentMaterial(0xfafefc, { roughness: 0.4 })
  const eyeWhite = createPlushGlossAccentMaterial(0xf5f8fc, { roughness: 0.32, clearcoat: 0.5 })
  const irisMat = createPlushGlossAccentMaterial(0x4a9ee8, { roughness: 0.35 })
  const pupil = createPlushPupilMaterial(0x0a1018)
  const mouthInner = createPlushSoftPatchMaterial(0xc86880, { roughness: 0.72 })

  const bodyH = 0.94
  const body = new Mesh(new BoxGeometry(0.42, bodyH, 0.34), furBlue)
  body.castShadow = false
  body.receiveShadow = false
  visuals.add(body)

  const patchShoulderL = new Mesh(new BoxGeometry(0.12, 0.14, 0.06), patchPurple)
  patchShoulderL.position.set(-0.24, 0.28, 0.16)
  const patchKneeR = new Mesh(new BoxGeometry(0.14, 0.12, 0.08), patchPurple)
  patchKneeR.position.set(0.14, -0.38, 0.14)
  visuals.add(patchShoulderL, patchKneeR)

  const tummy = new Mesh(new BoxGeometry(0.24, 0.36, 0.06), furLight)
  tummy.position.set(0, -0.04, 0.19)
  visuals.add(tummy)

  const head = new Mesh(new SphereGeometry(0.3, 16, 14), furBlue)
  head.position.set(0, 0.54, 0.04)
  visuals.add(head)

  const snoot = new Mesh(new SphereGeometry(0.1, 8, 6), snootMat)
  snoot.position.set(0, 0.48, 0.24)
  snoot.scale.set(1.1, 0.82, 1.15)
  visuals.add(snoot)

  const earL = new Mesh(new SphereGeometry(0.12, 8, 6), furDeep)
  earL.position.set(-0.2, 0.78, -0.04)
  earL.scale.set(0.55, 1.35, 0.45)
  earL.rotation.z = 0.45
  earL.rotation.x = -0.15
  const earR = new Mesh(new SphereGeometry(0.12, 8, 6), furDeep)
  earR.position.set(0.2, 0.78, -0.04)
  earR.scale.set(0.55, 1.35, 0.45)
  earR.rotation.z = -0.45
  earR.rotation.x = -0.15
  visuals.add(earL, earR)
  const earTipL = new Mesh(new SphereGeometry(0.06, 6, 4), patchPurple)
  earTipL.position.set(-0.22, 0.92, -0.06)
  const earTipR = new Mesh(new SphereGeometry(0.06, 6, 4), patchPurple)
  earTipR.position.set(0.22, 0.92, -0.06)
  visuals.add(earTipL, earTipR)

  const eyeL = new Mesh(new SphereGeometry(0.1, 12, 10), eyeWhite)
  eyeL.position.set(-0.11, 0.56, 0.22)
  const eyeR = new Mesh(new SphereGeometry(0.1, 12, 10), eyeWhite)
  eyeR.position.set(0.11, 0.56, 0.22)
  visuals.add(eyeL, eyeR)
  const irisL = new Mesh(new SphereGeometry(0.065, 8, 6), irisMat)
  irisL.position.set(-0.1, 0.56, 0.3)
  const irisR = new Mesh(new SphereGeometry(0.065, 8, 6), irisMat)
  irisR.position.set(0.1, 0.56, 0.3)
  visuals.add(irisL, irisR)
  const pupL = new Mesh(new SphereGeometry(0.04, 6, 4), pupil)
  pupL.position.set(-0.09, 0.56, 0.34)
  const pupR = new Mesh(new SphereGeometry(0.04, 6, 4), pupil)
  pupR.position.set(0.11, 0.56, 0.34)
  visuals.add(pupL, pupR)

  const mouthBack = new Mesh(new BoxGeometry(0.22, 0.08, 0.06), mouthInner)
  mouthBack.position.set(0, 0.4, 0.3)
  visuals.add(mouthBack)
  for (let i = 0; i < 5; i++) {
    const tooth = new Mesh(new BoxGeometry(0.04, 0.06, 0.04), toothMat)
    tooth.position.set(-0.1 + i * 0.05, 0.44, 0.32)
    visuals.add(tooth)
  }

  const armL = new Mesh(new BoxGeometry(0.15, 0.28, 0.15), furBlue)
  armL.position.set(-0.32, 0.08, 0.02)
  const armR = new Mesh(new BoxGeometry(0.15, 0.28, 0.15), furBlue)
  armR.position.set(0.32, 0.08, 0.02)
  visuals.add(armL, armR)

  const footL = new Mesh(new BoxGeometry(0.17, 0.12, 0.21), furDeep)
  footL.position.set(-0.12, -0.53, 0.06)
  const footR = new Mesh(new BoxGeometry(0.17, 0.12, 0.21), furDeep)
  footR.position.set(0.12, -0.53, 0.06)
  visuals.add(footL, footR)

  const assets: PlaceholderFighterMesh = {
    root,
    visuals,
    body,
    standHalfHeight: bodyH * 0.5,
    rig: { armL, armR, head },
  }
  applyProceduralVisualSizing(assets, 'bibi')
  return assets
}
