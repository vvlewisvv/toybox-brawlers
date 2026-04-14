import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from 'three'
import type { FighterCollisionVolumes } from '../gameplay/combat/collisionVolumes'

const COLORS = {
  hurt: 0x5cff7a,
  push: 0xffcc44,
  hit: 0xff4d4d,
} as const

/**
 * Wireframe boxes for hurt / push / hit. Shared unit cube geometry, per-mesh materials.
 */
export class CollisionDebugRenderer {
  private readonly group = new Group()
  private readonly geometry = new BoxGeometry(1, 1, 1)
  private readonly meshes: {
    hurt: Mesh
    push: Mesh
    hit: Mesh
  }[]

  constructor(scene: Scene) {
    this.group.name = 'collision-debug'
    scene.add(this.group)

    const mkMesh = (color: number) => {
      const mat = new MeshBasicMaterial({
        color,
        wireframe: true,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      })
      const mesh = new Mesh(this.geometry, mat)
      mesh.frustumCulled = false
      mesh.renderOrder = 900
      this.group.add(mesh)
      return mesh
    }

    this.meshes = [
      { hurt: mkMesh(COLORS.hurt), push: mkMesh(COLORS.push), hit: mkMesh(COLORS.hit) },
      { hurt: mkMesh(COLORS.hurt), push: mkMesh(COLORS.push), hit: mkMesh(COLORS.hit) },
    ]

    this.group.visible = false
  }

  sync(
    a: FighterCollisionVolumes | null,
    b: FighterCollisionVolumes | null,
    visible: boolean,
  ): void {
    if (!visible || !a || !b) {
      this.group.visible = false
      return
    }

    this.group.visible = true
    this.applySet(0, a)
    this.applySet(1, b)
  }

  private applySet(index: 0 | 1, vol: FighterCollisionVolumes): void {
    const set = this.meshes[index]
    this.fitBoxMesh(set.hurt, vol.hurt)
    this.fitBoxMesh(set.push, vol.push)
    if (vol.hit) {
      this.fitBoxMesh(set.hit, vol.hit)
      set.hit.visible = true
    } else {
      set.hit.visible = false
    }
  }

  private fitBoxMesh(mesh: Mesh, box: Box3): void {
    const c = new Vector3()
    const s = new Vector3()
    box.getCenter(c)
    box.getSize(s)
    mesh.position.copy(c)
    mesh.scale.copy(s)
  }

  dispose(scene: Scene): void {
    scene.remove(this.group)
    this.geometry.dispose()
    for (const set of this.meshes) {
      for (const m of Object.values(set)) {
        const mat = m.material
        if (!Array.isArray(mat)) mat.dispose()
        else mat.forEach((x) => x.dispose())
      }
    }
  }
}
