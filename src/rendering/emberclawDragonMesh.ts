import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  SphereGeometry,
} from 'three'
import { applyProceduralVisualSizing } from '../gameplay/character/characterVisualSizing'
import { createFighterVisualsRoot, type PlaceholderFighterMesh } from './placeholderFighterMesh'
import { createPlushFabricMaterial, createPlushGlossAccentMaterial, createPlushSoftPatchMaterial } from './plushMaterials'

/**
 * Emberclaw — polished red dragon plush (design ref: crimson fleece, tan belly + center seam, dark horns,
 * orange wing webbing, ember eyes & tail flame). Torso `body` receives combat emissive.
 */
export function createEmberclawDragonMesh(): PlaceholderFighterMesh {
  const { root, visuals } = createFighterVisualsRoot()

  const scaleRed = createPlushFabricMaterial(0xd42820, { roughness: 0.78, sheen: 0.64 })
  const scaleDark = createPlushFabricMaterial(0x7a1e16, { roughness: 0.84 })
  const bellyTan = createPlushSoftPatchMaterial(0xd8c4a4, { roughness: 0.74, sheen: 0.52 })
  const bellyStitch = createPlushFabricMaterial(0xa08068, {
    roughness: 0.82,
    normalScale: 0.08,
    sheen: 0.35,
    skipSurfaceMaps: true,
  })
  const hornMat = createPlushFabricMaterial(0x3d2818, {
    roughness: 0.62,
    normalScale: 0.18,
    sheen: 0.42,
  })
  const wingFrame = createPlushFabricMaterial(0xb01e18, { roughness: 0.8, sheen: 0.55 })
  const wingWeb = createPlushFabricMaterial(0xff9a2e, {
    roughness: 0.68,
    sheen: 0.48,
    emissive: 0xff6a18,
    emissiveIntensity: 0.45,
  })
  const toothMat = createPlushGlossAccentMaterial(0xf2f6f0, { roughness: 0.42 })
  const eyeGlow = createPlushSoftPatchMaterial(0xffe8a0, {
    roughness: 0.35,
    sheen: 0.3,
    skipSurfaceMaps: true,
    emissive: 0xffaa33,
    emissiveIntensity: 0.55,
  })
  const flameMat = createPlushFabricMaterial(0xff7a28, {
    roughness: 0.62,
    sheen: 0.5,
    emissive: 0xff5510,
    emissiveIntensity: 0.62,
  })

  const bodyH = 1.32
  const body = new Mesh(new BoxGeometry(0.62, bodyH, 0.48), scaleRed)
  body.castShadow = false
  body.receiveShadow = false
  visuals.add(body)

  const belly = new Mesh(new BoxGeometry(0.34, 0.52, 0.08), bellyTan)
  belly.position.set(0, -0.02, 0.26)
  visuals.add(belly)
  const seam = new Mesh(new BoxGeometry(0.02, 0.48, 0.1), bellyStitch)
  seam.position.set(0, -0.02, 0.31)
  visuals.add(seam)

  const neck = new Mesh(new CylinderGeometry(0.14, 0.2, 0.42, 8), scaleRed)
  neck.rotation.z = Math.PI * 0.08
  neck.position.set(0, 0.52, -0.28)
  visuals.add(neck)

  const head = new Mesh(new SphereGeometry(0.28, 14, 12), scaleRed)
  head.position.set(0, 0.72, -0.52)
  visuals.add(head)

  const faceSeam = new Mesh(new BoxGeometry(0.02, 0.36, 0.12), bellyStitch)
  faceSeam.position.set(0, 0.7, -0.42)
  visuals.add(faceSeam)

  const snout = new Mesh(new ConeGeometry(0.16, 0.36, 8), scaleDark)
  snout.rotation.x = Math.PI / 2
  snout.position.set(0, 0.68, -0.72)
  visuals.add(snout)

  for (let i = 0; i < 5; i++) {
    const tooth = new Mesh(new ConeGeometry(0.028, 0.07, 4), toothMat)
    tooth.rotation.x = Math.PI / 2
    tooth.position.set(-0.08 + i * 0.04, 0.62, -0.68)
    visuals.add(tooth)
  }

  const eyeL = new Mesh(new SphereGeometry(0.055, 8, 6), eyeGlow)
  eyeL.position.set(-0.1, 0.76, -0.58)
  const eyeR = new Mesh(new SphereGeometry(0.055, 8, 6), eyeGlow)
  eyeR.position.set(0.1, 0.76, -0.58)
  visuals.add(eyeL, eyeR)

  const hornGeo = new ConeGeometry(0.065, 0.32, 6)
  const hornL = new Mesh(hornGeo, hornMat)
  hornL.position.set(-0.14, 0.94, -0.48)
  hornL.rotation.z = 0.38
  hornL.rotation.x = -0.22
  const hornR = new Mesh(new ConeGeometry(0.065, 0.32, 6), hornMat)
  hornR.position.set(0.14, 0.94, -0.48)
  hornR.rotation.z = -0.38
  hornR.rotation.x = -0.22
  visuals.add(hornL, hornR)

  const wingLFrame = new Mesh(new BoxGeometry(0.1, 0.52, 0.88), wingFrame)
  wingLFrame.position.set(-0.7, 0.18, 0.08)
  wingLFrame.rotation.y = 0.28
  wingLFrame.rotation.z = 0.1
  const wingLWeb = new Mesh(new BoxGeometry(0.06, 0.38, 0.72), wingWeb)
  wingLWeb.position.set(-0.72, 0.16, 0.08)
  wingLWeb.rotation.y = 0.28
  wingLWeb.rotation.z = 0.1
  const wingRFrame = new Mesh(new BoxGeometry(0.1, 0.52, 0.88), wingFrame)
  wingRFrame.position.set(0.7, 0.18, 0.08)
  wingRFrame.rotation.y = -0.28
  wingRFrame.rotation.z = -0.1
  const wingRWeb = new Mesh(new BoxGeometry(0.06, 0.38, 0.72), wingWeb)
  wingRWeb.position.set(0.72, 0.16, 0.08)
  wingRWeb.rotation.y = -0.28
  wingRWeb.rotation.z = -0.1
  visuals.add(wingLFrame, wingLWeb, wingRFrame, wingRWeb)

  for (let i = 0; i < 5; i++) {
    const spine = new Mesh(new ConeGeometry(0.07, 0.2, 6), hornMat)
    spine.position.set(0, 0.28 + i * 0.16, 0.32)
    spine.rotation.x = Math.PI * 0.55
    visuals.add(spine)
  }

  const tail = new Mesh(new BoxGeometry(0.2, 0.18, 0.82), scaleDark)
  tail.position.set(0, -0.12, 0.62)
  tail.rotation.x = -0.15
  visuals.add(tail)

  const tailTip = new Mesh(new ConeGeometry(0.16, 0.38, 8), flameMat)
  tailTip.rotation.x = -Math.PI / 2 + 0.18
  tailTip.position.set(0, -0.05, 1.06)
  visuals.add(tailTip)
  const tailGlow = new Mesh(new SphereGeometry(0.1, 8, 6), flameMat)
  tailGlow.position.set(0, -0.02, 1.18)
  visuals.add(tailGlow)

  const thighL = new Mesh(new BoxGeometry(0.2, 0.28, 0.24), scaleDark)
  thighL.position.set(-0.2, -0.58, 0.04)
  const thighR = new Mesh(new BoxGeometry(0.2, 0.28, 0.24), scaleDark)
  thighR.position.set(0.2, -0.58, 0.04)
  visuals.add(thighL, thighR)

  const assets: PlaceholderFighterMesh = {
    root,
    visuals,
    body,
    standHalfHeight: bodyH * 0.5,
    rig: { armL: wingLFrame, armR: wingRFrame, head },
  }
  applyProceduralVisualSizing(assets, 'emberclaw')
  return assets
}
