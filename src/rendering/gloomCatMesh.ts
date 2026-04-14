import { BoxGeometry, CylinderGeometry, Mesh, SphereGeometry, TorusGeometry } from 'three'
import { applyProceduralVisualSizing } from '../gameplay/character/characterVisualSizing'
import { createFighterVisualsRoot, type PlaceholderFighterMesh } from './placeholderFighterMesh'
import {
  createPlushFabricMaterial,
  createPlushPupilMaterial,
  createPlushSoftPatchMaterial,
  createPlushEyeScleraMaterial,
} from './plushMaterials'

/**
 * Gloom — polished black plush cat (ref: sherpa read, dusty pink ears, glossy yellow eyes angled inward,
 * black nose, whiskers, S-curve tail). Torso `body` receives combat tint.
 */
export function createGloomCatMesh(): PlaceholderFighterMesh {
  const { root, visuals } = createFighterVisualsRoot()

  const furBlack = createPlushFabricMaterial(0x141418, {
    roughness: 0.9,
    sheen: 0.42,
    envMapIntensity: 0.52,
  })
  const furSoft = createPlushFabricMaterial(0x222228, {
    roughness: 0.86,
    sheen: 0.46,
    envMapIntensity: 0.56,
  })
  const pink = createPlushSoftPatchMaterial(0xd898ae, { roughness: 0.74, sheen: 0.52 })
  const eyeYellow = createPlushEyeScleraMaterial(0xf2dc4a)
  const pupil = createPlushPupilMaterial(0x050508)
  const noseMat = createPlushPupilMaterial(0x0a0a0c)

  const bodyH = 0.62
  const body = new Mesh(new BoxGeometry(0.64, bodyH, 0.52), furBlack)
  body.castShadow = false
  body.receiveShadow = false
  visuals.add(body)

  const bib = new Mesh(new BoxGeometry(0.26, 0.18, 0.06), furSoft)
  bib.position.set(0, -0.08, 0.28)
  visuals.add(bib)

  const head = new Mesh(new SphereGeometry(0.36, 16, 14), furBlack)
  head.position.set(0, 0.4, 0.06)
  visuals.add(head)

  const earGeo = new SphereGeometry(0.11, 8, 6)
  const earL = new Mesh(earGeo, furBlack)
  earL.position.set(-0.28, 0.62, 0.02)
  earL.scale.set(0.75, 1.15, 0.5)
  earL.rotation.z = 0.12
  const earR = new Mesh(new SphereGeometry(0.11, 8, 6), furBlack)
  earR.position.set(0.28, 0.62, 0.02)
  earR.scale.set(0.75, 1.15, 0.5)
  earR.rotation.z = -0.12
  visuals.add(earL, earR)

  const innerL = new Mesh(new SphereGeometry(0.056, 6, 4), pink)
  innerL.position.set(-0.28, 0.62, 0.07)
  const innerR = new Mesh(new SphereGeometry(0.056, 6, 4), pink)
  innerR.position.set(0.28, 0.62, 0.07)
  visuals.add(innerL, innerR)

  const eyeL = new Mesh(new SphereGeometry(0.11, 12, 10), eyeYellow)
  eyeL.position.set(-0.13, 0.44, 0.28)
  eyeL.rotation.z = 0.18
  eyeL.rotation.x = -0.08
  const eyeR = new Mesh(new SphereGeometry(0.11, 12, 10), eyeYellow)
  eyeR.position.set(0.13, 0.44, 0.28)
  eyeR.rotation.z = -0.18
  eyeR.rotation.x = -0.08
  visuals.add(eyeL, eyeR)

  const pupL = new Mesh(new SphereGeometry(0.048, 6, 4), pupil)
  pupL.position.set(-0.1, 0.43, 0.35)
  const pupR = new Mesh(new SphereGeometry(0.048, 6, 4), pupil)
  pupR.position.set(0.12, 0.43, 0.35)
  visuals.add(pupL, pupR)

  const nose = new Mesh(new SphereGeometry(0.035, 6, 4), noseMat)
  nose.position.set(0, 0.38, 0.36)
  nose.scale.set(1.1, 0.85, 0.9)
  visuals.add(nose)

  const mouthL = new Mesh(new BoxGeometry(0.055, 0.018, 0.02), pink)
  mouthL.position.set(-0.04, 0.32, 0.34)
  mouthL.rotation.z = 0.35
  const mouthR = new Mesh(new BoxGeometry(0.055, 0.018, 0.02), pink)
  mouthR.position.set(0.04, 0.32, 0.34)
  mouthR.rotation.z = -0.35
  visuals.add(mouthL, mouthR)

  const whiskerMat = createPlushFabricMaterial(0x1a1a20, {
    roughness: 0.75,
    skipSurfaceMaps: true,
    sheen: 0.2,
  })
  for (let s = 0; s < 3; s++) {
    const wy = -0.02 + s * 0.025
    const wl = new Mesh(new CylinderGeometry(0.008, 0.006, 0.22, 4), whiskerMat)
    wl.rotation.z = Math.PI / 2
    wl.rotation.y = 0.12 + s * 0.04
    wl.position.set(-0.32, 0.36 + wy, 0.26)
    const wr = new Mesh(new CylinderGeometry(0.008, 0.006, 0.22, 4), whiskerMat)
    wr.rotation.z = Math.PI / 2
    wr.rotation.y = -(0.12 + s * 0.04)
    wr.position.set(0.32, 0.36 + wy, 0.26)
    visuals.add(wl, wr)
  }

  const pawFL = new Mesh(new BoxGeometry(0.15, 0.1, 0.17), furSoft)
  pawFL.position.set(-0.24, -0.32, 0.15)
  const pawFR = new Mesh(new BoxGeometry(0.15, 0.1, 0.17), furSoft)
  pawFR.position.set(0.24, -0.32, 0.15)
  visuals.add(pawFL, pawFR)

  const tailA = new Mesh(new TorusGeometry(0.14, 0.048, 6, 12, Math.PI * 0.95), furBlack)
  tailA.position.set(0.26, -0.16, -0.16)
  tailA.rotation.set(0.45, 0.2, Math.PI * 0.4)
  const tailB = new Mesh(new TorusGeometry(0.11, 0.042, 6, 10, Math.PI * 0.85), furBlack)
  tailB.position.set(0.08, 0.06, -0.42)
  tailB.rotation.set(0.85, -0.35, Math.PI * 0.15)
  visuals.add(tailA, tailB)

  const assets: PlaceholderFighterMesh = {
    root,
    visuals,
    body,
    standHalfHeight: bodyH * 0.5,
    rig: { armL: pawFL, armR: pawFR, head },
  }
  applyProceduralVisualSizing(assets, 'gloom')
  return assets
}
