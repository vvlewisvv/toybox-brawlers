import {
  ACESFilmicToneMapping,
  Color,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type WebGLRendererParameters,
} from 'three'

export type ThreeContext = {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
}

const defaultRendererOpts: WebGLRendererParameters = {
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Creates WebGLRenderer + scene + camera. Used by stage scenes. */
export function createThreeContext(
  canvas: HTMLCanvasElement,
  rendererOpts: WebGLRendererParameters = defaultRendererOpts,
): ThreeContext {
  const scene = new Scene()
  scene.background = new Color(0x0f1115)

  const camera = new PerspectiveCamera(50, 1, 0.1, 200)
  camera.position.set(0, 2.2, 6)

  const renderer = new WebGLRenderer({ canvas, ...rendererOpts })
  const mobile = isMobileDevice()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.09
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  return { scene, camera, renderer }
}
