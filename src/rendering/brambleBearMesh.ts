import { BoxGeometry, Mesh, SphereGeometry } from 'three'
import { applyProceduralVisualSizing } from '../gameplay/character/characterVisualSizing'
import { createFighterVisualsRoot, type PlaceholderFighterMesh } from './placeholderFighterMesh'
import {
  createPlushFabricMaterial,
  createPlushPupilMaterial,
  createPlushSoftPatchMaterial,
  createPlushEyeScleraMaterial,
} from './plushMaterials'

/**
 * Bramble — oversized teddy bruiser (ref: light brown sherpa, round belly with center seam, bead eyes,
 * soft snout, wide stance). `body` is the combat emissive / KO tint target.
 */
export function createBrambleBearMesh(): PlaceholderFighterMesh {
  const { root, visuals } = createFighterVisualsRoot()

  const furMain = createPlushFabricMaterial(0xb0885a, { roughness: 0.76, sheen: 0.68 })
  const furLight = createPlushSoftPatchMaterial(0xd2b48c, { roughness: 0.72, sheen: 0.58 })
  const furDeep = createPlushFabricMaterial(0x8a6640, { roughness: 0.82 })
  const seamMat = createPlushFabricMaterial(0x6d4a30, {
    roughness: 0.84,
    skipSurfaceMaps: true,
    sheen: 0.35,
  })
  const snoutMat = createPlushSoftPatchMaterial(0xc9a882, {
    roughness: 0.68,
    normalScale: 0.12,
  })
  const eyeWhite = createPlushEyeScleraMaterial(0xf2f0e8)
  const pupil = createPlushPupilMaterial(0x1a1410)
  const noseMat = createPlushPupilMaterial(0x2a2018)

  const bodyH = 1.48
  const body = new Mesh(new BoxGeometry(0.74, bodyH, 0.54), furMain)
  body.castShadow = false
  body.receiveShadow = false
  visuals.add(body)

  const belly = new Mesh(new BoxGeometry(0.38, 0.56, 0.07), furLight)
  belly.position.set(0, -0.1, 0.3)
  visuals.add(belly)
  const seam = new Mesh(new BoxGeometry(0.022, 0.5, 0.09), seamMat)
  seam.position.set(0, -0.1, 0.35)
  visuals.add(seam)

  const head = new Mesh(new SphereGeometry(0.4, 18, 14), furLight)
  head.position.set(0, 0.82, 0.02)
  visuals.add(head)

  const snout = new Mesh(new SphereGeometry(0.16, 12, 10), snoutMat)
  snout.position.set(0, 0.72, 0.34)
  snout.scale.set(1.2, 0.88, 1.28)
  visuals.add(snout)

  const nose = new Mesh(new SphereGeometry(0.055, 8, 6), noseMat)
  nose.position.set(0, 0.7, 0.46)
  visuals.add(nose)

  const eyeL = new Mesh(new SphereGeometry(0.065, 10, 8), eyeWhite)
  eyeL.position.set(-0.12, 0.86, 0.22)
  const eyeR = new Mesh(new SphereGeometry(0.065, 10, 8), eyeWhite)
  eyeR.position.set(0.12, 0.86, 0.22)
  visuals.add(eyeL, eyeR)
  const pupL = new Mesh(new SphereGeometry(0.032, 6, 4), pupil)
  pupL.position.set(-0.11, 0.86, 0.28)
  const pupR = new Mesh(new SphereGeometry(0.032, 6, 4), pupil)
  pupR.position.set(0.11, 0.86, 0.28)
  visuals.add(pupL, pupR)

  const earL = new Mesh(new SphereGeometry(0.14, 10, 8), furDeep)
  earL.position.set(-0.34, 1.06, -0.02)
  const earR = new Mesh(new SphereGeometry(0.14, 10, 8), furDeep)
  earR.position.set(0.34, 1.06, -0.02)
  visuals.add(earL, earR)

  const armL = new Mesh(new BoxGeometry(0.24, 0.44, 0.26), furMain)
  armL.position.set(-0.54, 0.12, 0.02)
  const armR = new Mesh(new BoxGeometry(0.24, 0.44, 0.26), furMain)
  armR.position.set(0.54, 0.12, 0.02)
  visuals.add(armL, armR)

  const footL = new Mesh(new BoxGeometry(0.22, 0.14, 0.28), furDeep)
  footL.position.set(-0.2, -0.76, 0.08)
  const footR = new Mesh(new BoxGeometry(0.22, 0.14, 0.28), furDeep)
  footR.position.set(0.2, -0.76, 0.08)
  visuals.add(footL, footR)

  const assets: PlaceholderFighterMesh = {
    root,
    visuals,
    body,
    standHalfHeight: bodyH * 0.5,
    rig: { armL, armR, head },
  }
  applyProceduralVisualSizing(assets, 'bramble')
  return assets
}
