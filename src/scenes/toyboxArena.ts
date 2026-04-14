import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { FIGHT_PLANE_Z } from '../gameplay/fightingPlane'
import { GROUND_SURFACE_Y } from '../gameplay/groundPlane'

export type ToyboxArenaHandle = {
  /** Toggle with fight vs menu (fighters hidden). */
  fightRoots: Object3D[]
  dispose: () => void
}

/**
 * Single toybox-themed fight shell: shared low-poly geometry, few materials, no textures.
 * Props sit behind the play plane (z &lt; 0) for depth; floor stays at {@link GROUND_SURFACE_Y}.
 */
export function createToyboxArena(scene: Scene): ToyboxArenaHandle {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<MeshStandardMaterial>()
  const fightRoots: Object3D[] = []

  const geo = (g: BufferGeometry): BufferGeometry => {
    geometries.add(g)
    return g
  }

  const mat = (params: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial => {
    const m = new MeshStandardMaterial(params)
    materials.add(m)
    return m
  }

  const addFight = (o: Object3D): void => {
    fightRoots.push(o)
    scene.add(o)
  }

  /** Arena props receive fighter shadows; only fighters cast (keeps shadow map cheap). */
  const markArenaShadow = (o: Object3D): void => {
    o.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.castShadow = false
        obj.receiveShadow = true
      }
    })
  }

  // --- Shared primitives (scaled per mesh; one GPU buffer each) ---
  const unitBox = geo(new BoxGeometry(1, 1, 1))
  const unitCyl8 = geo(new CylinderGeometry(1, 1, 1, 8))
  const unitSphere = geo(new SphereGeometry(1, 10, 8))
  const unitTorus = geo(new TorusGeometry(1, 0.22, 6, 10))

  // --- Materials: warm muted toy-box palette (cohesive with cinematic lighting) ---
  const woodFloor = mat({ color: 0x6e5a4c, roughness: 0.91, metalness: 0.03 })
  const woodDark = mat({ color: 0x524238, roughness: 0.89, metalness: 0.035 })
  const wallPaper = mat({
    color: 0x4a5562,
    roughness: 0.92,
    metalness: 0,
    emissive: 0x2a2228,
    emissiveIntensity: 0.22,
  })
  const rimWood = mat({ color: 0x625042, roughness: 0.88, metalness: 0.045 })
  const plasticRed = mat({ color: 0xb06052, roughness: 0.58, metalness: 0.06 })
  const plasticBlue = mat({ color: 0x4a6488, roughness: 0.54, metalness: 0.07 })
  const plasticYellow = mat({ color: 0xc4a060, roughness: 0.6, metalness: 0.05 })
  const plasticGreen = mat({ color: 0x528a6e, roughness: 0.56, metalness: 0.06 })
  const plasticOrange = mat({ color: 0xc07848, roughness: 0.57, metalness: 0.06 })
  const plasticViolet = mat({ color: 0x786892, roughness: 0.52, metalness: 0.08 })

  // --- Floor (single segment plane) ---
  const floor = new Mesh(geo(new PlaneGeometry(32, 20, 1, 1)), woodFloor)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, GROUND_SURFACE_Y, FIGHT_PLANE_Z - 2)
  floor.userData.groundSurfaceY = GROUND_SURFACE_Y
  addFight(floor)
  markArenaShadow(floor)

  // --- Deep backdrop (atmospheric depth behind play space) ---
  const deepBackdrop = new Mesh(
    geo(new PlaneGeometry(52, 30, 1, 1)),
    mat({ color: 0x181218, roughness: 1, metalness: 0, emissive: 0x120c10, emissiveIntensity: 0.4 }),
  )
  deepBackdrop.position.set(0, 9.5, -17.2)
  addFight(deepBackdrop)
  markArenaShadow(deepBackdrop)

  // --- Soft ceiling plane (encloses the toybox, sells scale) ---
  const ceiling = new Mesh(
    geo(new PlaneGeometry(38, 22, 1, 1)),
    mat({ color: 0x342c30, roughness: 0.96, metalness: 0, emissive: 0x241c20, emissiveIntensity: 0.09 }),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, 12.8, -5.5)
  addFight(ceiling)
  markArenaShadow(ceiling)

  // --- Toybox inner back wall (depth anchor) ---
  const backWall = new Mesh(geo(new PlaneGeometry(36, 18, 1, 1)), wallPaper)
  backWall.position.set(0, 8.2, -11.5)
  addFight(backWall)
  markArenaShadow(backWall)

  // --- Side walls (shallow angle → strong corner depth) ---
  const sideW = 14
  const sideH = 12
  const sideGeo = geo(new PlaneGeometry(sideW, sideH, 1, 1))
  const leftWall = new Mesh(sideGeo, wallPaper)
  leftWall.position.set(-10.5, 6.5, -5.5)
  leftWall.rotation.set(0, Math.PI * 0.2, 0)
  addFight(leftWall)

  const rightWall = new Mesh(sideGeo, wallPaper)
  rightWall.position.set(10.5, 6.5, -5.5)
  rightWall.rotation.set(0, -Math.PI * 0.2, 0)
  addFight(rightWall)
  markArenaShadow(leftWall)
  markArenaShadow(rightWall)

  // --- Box inner lip (back + sides only — never crosses in front of the fight plane z=0) ---
  const lipT = 0.22
  const lipH = 0.38
  const lipL = 20
  const lipY = GROUND_SURFACE_Y + lipH * 0.5

  const lipBack = new Mesh(unitBox, rimWood)
  lipBack.scale.set(lipL, lipH, lipT)
  lipBack.position.set(0, lipY, -8.6)
  addFight(lipBack)
  markArenaShadow(lipBack)

  const lipLeft = new Mesh(unitBox, rimWood)
  lipLeft.scale.set(lipT, lipH, 8.8)
  lipLeft.position.set(-9.85, lipY, -4.2)
  addFight(lipLeft)
  markArenaShadow(lipLeft)

  const lipRight = new Mesh(unitBox, rimWood)
  lipRight.scale.set(lipT, lipH, 8.8)
  lipRight.position.set(9.85, lipY, -4.2)
  addFight(lipRight)
  markArenaShadow(lipRight)

  // --- Corner posts (depth brackets; kept behind / beside play plane) ---
  const post = (x: number, z: number): void => {
    const m = new Mesh(unitBox, woodDark)
    m.scale.set(0.45, 9.5, 0.45)
    m.position.set(x, 4.75, z)
    addFight(m)
    markArenaShadow(m)
  }
  post(-9.5, -8.2)
  post(9.5, -8.2)
  post(-10.1, -2.8)
  post(10.1, -2.8)

  function addBlock(
    cx: number,
    feetY: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    material: MeshStandardMaterial,
  ): void {
    const m = new Mesh(unitBox, material)
    m.position.set(cx, feetY + sy * 0.5, cz)
    m.scale.set(sx, sy, sz)
    addFight(m)
    markArenaShadow(m)
  }

  // --- Oversized alphabet-style blocks (camera left, deep) ---
  addBlock(-7.2, GROUND_SURFACE_Y, -6.2, 2.4, 2.4, 2.4, plasticRed)
  addBlock(-7.2, GROUND_SURFACE_Y + 2.4, -6.2, 2.2, 2.2, 2.2, plasticBlue)
  addBlock(-5.4, GROUND_SURFACE_Y, -8.4, 1.9, 1.9, 1.9, plasticYellow)

  // --- Stacked blocks (right, mid-depth) ---
  addBlock(7.8, GROUND_SURFACE_Y, -5.0, 2.0, 1.4, 2.0, plasticGreen)
  addBlock(7.8, GROUND_SURFACE_Y + 1.4, -5.0, 1.7, 1.3, 1.7, plasticOrange)
  addBlock(8.6, GROUND_SURFACE_Y, -7.2, 1.5, 1.5, 1.5, plasticViolet)

  // --- Giant ball ---
  const ball = new Mesh(unitSphere, plasticRed)
  ball.scale.setScalar(1.35)
  ball.position.set(-2.8, GROUND_SURFACE_Y + 1.35, -7.8)
  addFight(ball)
  markArenaShadow(ball)

  // --- Giant crayon (8-side cylinder + cone) ---
  const crayon = new Group()
  const crayBody = new Mesh(unitCyl8, plasticYellow)
  crayBody.scale.set(0.42, 3.8, 0.42)
  crayBody.position.set(0, 1.9, 0)
  crayon.add(crayBody)
  const crayTip = new Mesh(geo(new ConeGeometry(1, 0.75, 8)), plasticOrange)
  crayTip.scale.set(0.42, 0.55, 0.42)
  crayTip.position.set(0, 3.95, 0)
  crayon.add(crayTip)
  crayon.position.set(3.2, GROUND_SURFACE_Y, -9.0)
  crayon.rotation.z = 0.14
  crayon.rotation.y = -0.35
  addFight(crayon)
  markArenaShadow(crayon)

  // --- Stacking rings (shared torus geometry, 3 meshes) ---
  const ringMat = mat({ color: 0x4a8c9c, roughness: 0.5, metalness: 0.1 })
  for (let i = 0; i < 3; i++) {
    const r = new Mesh(unitTorus, ringMat)
    const scale = 0.95 - i * 0.12
    r.scale.set(scale, scale, scale)
    r.position.set(-9.0, GROUND_SURFACE_Y + 0.45 + i * 0.38, -2.2)
    r.rotation.x = Math.PI / 2
    addFight(r)
    markArenaShadow(r)
  }

  // --- Oversized domino (leaning, silhouette read) ---
  const domino = new Mesh(unitBox, mat({ color: 0xf2ebe4, roughness: 0.78, metalness: 0.02 }))
  domino.scale.set(0.28, 4.2, 1.85)
  domino.position.set(9.2, 2.1, -3.4)
  domino.rotation.z = 0.09
  domino.rotation.y = -0.25
  addFight(domino)
  markArenaShadow(domino)

  // --- Foreground play mat: narrower + muted so silhouettes stay the hero ---
  const rug = new Mesh(
    geo(new PlaneGeometry(12.5, 7.2, 1, 1)),
    mat({ color: 0x3d4a5a, roughness: 0.91, metalness: 0.02 }),
  )
  rug.rotation.x = -Math.PI / 2
  rug.position.set(0, GROUND_SURFACE_Y + 0.006, FIGHT_PLANE_Z - 1.85)
  addFight(rug)
  markArenaShadow(rug)

  const dispose = (): void => {
    for (const o of fightRoots) {
      scene.remove(o)
    }
    fightRoots.length = 0
    for (const g of geometries) g.dispose()
    geometries.clear()
    for (const m of materials) m.dispose()
    materials.clear()
  }

  return { fightRoots, dispose }
}

/** Fight camera: closer framing + gentle downward tilt for a more cinematic read. */
export const TOYBOX_FIGHT_CAMERA_POS = new Vector3(0, 3.18, 7.05)
export const TOYBOX_FIGHT_LOOK_AT = new Vector3(0, 0.88, -0.38)
