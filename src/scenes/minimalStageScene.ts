import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { createThreeContext } from '../rendering/threeContext'
import {
  createToyboxArena,
  TOYBOX_FIGHT_CAMERA_POS,
  TOYBOX_FIGHT_LOOK_AT,
} from './toyboxArena'

export type MinimalStageOptions = {
  /** Once per frame before rendering; `dt` is seconds since last frame (capped). */
  beforeRender?: (dtSeconds: number) => void
}

export type MinimalStageHandle = {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  /** Fight arena + camera vs menu backdrop (no fight geometry, different framing). */
  setStagePresentation(mode: 'fight' | 'menu'): void
  dispose: () => void
}

/**
 * Toybox arena + lighting tuned for plush reads: one shadow-casting key, fog depth, ACES (renderer).
 */
export function startMinimalStage(
  canvas: HTMLCanvasElement,
  options: MinimalStageOptions = {},
): MinimalStageHandle {
  const { scene, camera, renderer } = createThreeContext(canvas)

  try {
    console.info(
      '[Plushdown:Boot] WebGLRenderer OK · pixelRatio=%s · canvasCss=%sx%s',
      renderer.getPixelRatio(),
      canvas.clientWidth || '(0)',
      canvas.clientHeight || '(0)',
    )
  } catch (e) {
    console.error('[Plushdown:Boot] WebGLRenderer diagnostics failed:', e)
  }

  const fightBackground = new Color(0x2a2226)
  const menuBackground = new Color(0x0f1115)
  scene.background = menuBackground.clone()

  /** Warm, dark fog — depth without flattening plush rim from the back light. */
  const fightFog = new Fog(0x1c1418, 10.5, 44)

  const hemiBounce = new HemisphereLight(0xffecd8, 0x5a483e, 0.52)
  scene.add(hemiBounce)

  const ambient = new AmbientLight(0xc8b4a8, 0.26)
  scene.add(ambient)

  const key = new DirectionalLight(0xfff0e6, 1.08)
  key.position.set(6.2, 12.5, 9)
  key.target.position.set(0, 0.75, -2)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.00028
  key.shadow.normalBias = 0.072
  const shCam = key.shadow.camera
  shCam.near = 0.5
  shCam.far = 48
  shCam.left = -19
  shCam.right = 19
  shCam.top = 18.5
  shCam.bottom = -5.5
  shCam.updateProjectionMatrix()
  scene.add(key)
  scene.add(key.target)

  /** Strong warm backlight (behind fighters, toward camera) — rim on plush silhouettes. */
  const backRimWarm = new DirectionalLight(0xffb078, 0.95)
  backRimWarm.position.set(-0.8, 6.4, -13.2)
  backRimWarm.target.position.set(0, 1.05, 0.6)
  scene.add(backRimWarm)
  scene.add(backRimWarm.target)

  /** Secondary warm kicker from stage-right-back — separates twin fighters. */
  const backRimKicker = new DirectionalLight(0xffd8b8, 0.24)
  backRimKicker.position.set(8.2, 5.1, -9.5)
  backRimKicker.target.position.set(0, 0.9, 0)
  scene.add(backRimKicker)
  scene.add(backRimKicker.target)

  const fillFront = new DirectionalLight(0xfff6ee, 0.3)
  fillFront.position.set(0.6, 3.6, 12.5)
  fillFront.target.position.set(0, 0.55, 0)
  scene.add(fillFront)
  scene.add(fillFront.target)

  /** Soft pool of warm light on the play plane — grounds the cast. */
  const floorWarmth = new PointLight(0xffcfa8, 0.48, 32, 2.1)
  floorWarmth.position.set(0.2, 1.05, 1.6)
  scene.add(floorWarmth)

  const dustCount = 42
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 22
    dustPos[i * 3 + 1] = 1.8 + Math.random() * 9.5
    dustPos[i * 3 + 2] = -1.2 - Math.random() * 13
  }
  const dustGeo = new BufferGeometry()
  dustGeo.setAttribute('position', new BufferAttribute(dustPos, 3))
  const dustMat = new PointsMaterial({
    color: 0xffe8dc,
    size: 0.055,
    transparent: true,
    opacity: 0.38,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const dustParticles = new Points(dustGeo, dustMat)
  dustParticles.position.set(0, 0, 0)
  dustParticles.visible = false
  scene.add(dustParticles)

  const toybox = createToyboxArena(scene)

  const fightCameraPos = TOYBOX_FIGHT_CAMERA_POS.clone()
  const fightLookTarget = TOYBOX_FIGHT_LOOK_AT.clone()
  const menuLookTarget = new Vector3(0, 1.1, 0)
  const menuCameraPos = new Vector3(0, 4.4, 14.5)

  scene.fog = null
  camera.fov = 50
  camera.position.copy(menuCameraPos)
  camera.lookAt(menuLookTarget)
  camera.updateProjectionMatrix()

  const arenaRoots = toybox.fightRoots

  const setStagePresentation = (mode: 'fight' | 'menu'): void => {
    const fight = mode === 'fight'
    for (const m of arenaRoots) {
      m.visible = fight
    }
    dustParticles.visible = fight
    scene.background = fight ? fightBackground.clone() : menuBackground.clone()
    scene.fog = fight ? fightFog : null
    if (fight) {
      camera.fov = 40
      camera.position.copy(fightCameraPos)
      camera.lookAt(fightLookTarget)
    } else {
      camera.fov = 50
      camera.position.copy(menuCameraPos)
      camera.lookAt(menuLookTarget)
    }
    camera.updateProjectionMatrix()
  }

  const setSize = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }

  setSize()
  const ro = new ResizeObserver(setSize)
  ro.observe(canvas)

  let raf = 0
  let last = performance.now()
  let dustPhase = 0
  const tick = () => {
    raf = requestAnimationFrame(tick)
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (dustParticles.visible) {
      dustPhase += dt
      dustParticles.rotation.y += dt * 0.014
      dustParticles.position.y = Math.sin(dustPhase * 0.28) * 0.22
    }
    try {
      options.beforeRender?.(dt)
    } catch (err) {
      console.error('[Plushdown] beforeRender threw — frame skipped for sim, render still attempted:', err)
    }
    try {
      renderer.render(scene, camera)
    } catch (err) {
      console.error('[Plushdown] renderer.render:', err)
    }
  }
  tick()

  const dispose = () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    toybox.dispose()
    scene.remove(dustParticles)
    dustGeo.dispose()
    dustMat.dispose()
    hemiBounce.dispose()
    ambient.dispose()
    key.dispose()
    backRimWarm.dispose()
    backRimKicker.dispose()
    fillFront.dispose()
    floorWarmth.dispose()
    renderer.dispose()
  }

  return { scene, camera, renderer, setStagePresentation, dispose }
}
