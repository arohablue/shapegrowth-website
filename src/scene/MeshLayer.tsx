import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type DirectionalLight,
  type Material,
  type Object3D,
} from 'three'
import type { RepresentationWeights } from '@/experience/representation'
import { lerp } from '@/experience/easing'
import { ILLUMINANTS } from '@/theme/palette'
import { useTheme } from '@/theme/ThemeContext'
import type { MeshConfig } from './pointCloudConfig'

interface Props {
  object: Object3D
  config: MeshConfig
  weightsRef: React.RefObject<RepresentationWeights>
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * THE SURFACE AND FINAL-PLANT STAGES
 * ────────────────────────────────────────────────────────────────────────────
 * The surface does not fade in. A uniform opacity ramp reads as a decal being
 * turned up; the plant has to look like it is being *closed over*. So the reveal
 * is per-fragment, keyed to world height, sweeping upward in the same direction
 * the samples snapped and the edges grew.
 *
 * That is done by injecting into `MeshStandardMaterial` via `onBeforeCompile`
 * rather than writing a custom `ShaderMaterial`. The injection is about twenty
 * lines; reimplementing three's PBR pipeline to get lights, IBL and tone mapping
 * back would be hundreds, and would silently diverge from whatever material the
 * supplied GLB actually ships with. The final-stage polish that *doesn't* need
 * shader access — roughness, emissive, light intensity — is plain property
 * animation, because there is no reason to put it in GLSL.
 *
 * Lights live here rather than in the canvas because the point cloud is unlit —
 * a raw `ShaderMaterial` ignores them. Mounting them with the mesh means a
 * cloud-only scene pays nothing for lighting it cannot use.
 */
export function MeshLayer({ object, config, weightsRef }: Props) {
  const groupRef = useRef<Object3D>(null)
  const keyLightRef = useRef<DirectionalLight>(null)
  const rimLightRef = useRef<DirectionalLight>(null)
  const { palette, scene: sceneTuning } = useTheme()

  // Shared by reference with every injected program, so a single write here
  // reaches all of the mesh's materials. Identity must never change.
  const uniforms = useMemo(
    () => ({
      uSurface: { value: 0 },
      uRevealSoftness: { value: config.revealSoftness },
      uFrontGlow: { value: config.frontGlow },
      uMeshOpacity: { value: 0 },
      uFinal: { value: 0 },
      uFrontColor: { value: new Color(palette.accent) },
      uBaseY: { value: 0 },
      uSpanY: { value: 1 },
    }),
    [],
  )

  const materials = useMemo(() => {
    // Height range of the actual geometry, so the reveal front is calibrated to
    // this plant rather than to an assumed 0→3.2. A mesh anchored at its base
    // and one anchored at its centre must both sweep bottom to top.
    const bounds = new Box3().setFromObject(object)
    const size = bounds.getSize(new Vector3())
    uniforms.uBaseY.value = bounds.min.y
    uniforms.uSpanY.value = size.y > 1e-6 ? size.y : 1

    const collected: MeshStandardMaterial[] = []

    object.traverse((child) => {
      if (!(child instanceof Mesh)) return
      child.castShadow = false
      child.receiveShadow = false
      // renderOrder 0: the surface draws first, so the wireframe and the
      // residual particles composite over whatever it has already claimed.
      child.renderOrder = 0

      const list: Material[] = Array.isArray(child.material) ? child.material : [child.material]
      const replaced = list.map((source) => {
        // `Object3D.clone` shares materials with the loader's cached scene.
        // Injecting into a shared material would leak this component's reveal
        // logic into every other consumer, and our disposal would break them.
        const material = source.clone() as MeshStandardMaterial

        // Both must be set before first compile. Flipping `transparent` later
        // forces a recompile mid-scroll, which is a visible hitch.
        material.transparent = true
        material.depthWrite = true

        // Re-base the foliage for themes that ask, which today is light only.
        // Set here rather than in the frame loop because it is a property of the
        // theme, not of the scroll — `Color.set` parses a string, and doing that
        // sixty times a second to write the same value would be waste dressed up
        // as animation. Safe against the loader's cache because the clone above
        // has already happened.
        //
        // NOT when the mesh carries its own vertex colours. three multiplies
        // `material.color` INTO the vertex colour rather than replacing it, so
        // on the real scan — whose colour is sampled from the fused point cloud
        // and whose glTF baseColorFactor is deliberately white so it passes
        // through unmultiplied — this would scale every vertex by linear
        // (0.11, 0.25, 0.06) and repaint the yellow flower head olive. That is
        // a measured property of the plant being overwritten by a theme
        // preference. The synthetic fixture has no COLOR_0 and does still want
        // the re-base, which is why this is a capability check and not a flag.
        if (sceneTuning.foliage && !material.vertexColors) material.color.set(sceneTuning.foliage)

        material.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms)

          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              /* glsl */ `
                #include <common>
                uniform float uBaseY;
                uniform float uSpanY;
                varying float vHeight01;
              `,
            )
            // project_vertex is unconditional and has `transformed` in scope;
            // worldpos_vertex would have been the natural hook but three only
            // expands it under certain material flags.
            .replace(
              '#include <project_vertex>',
              /* glsl */ `
                #include <project_vertex>
                vec4 revealWorld = modelMatrix * vec4(transformed, 1.0);
                vHeight01 = (revealWorld.y - uBaseY) / uSpanY;
              `,
            )

          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              /* glsl */ `
                #include <common>
                uniform float uSurface;
                uniform float uRevealSoftness;
                uniform float uFrontGlow;
                uniform float uMeshOpacity;
                uniform float uFinal;
                uniform vec3 uFrontColor;
                varying float vHeight01;
              `,
            )
            // Discarding at the top of main() skips the entire PBR evaluation
            // for not-yet-revealed fragments, so an unrevealed surface costs
            // almost nothing. `revealed` stays in scope for the hook below.
            .replace(
              '#include <clipping_planes_fragment>',
              /* glsl */ `
                #include <clipping_planes_fragment>
                // Endpoints chosen so the front starts fully below the mesh and
                // finishes fully above it for any softness value.
                float revealEdge = mix(-uRevealSoftness * 0.05, 1.0 + uRevealSoftness, uSurface);
                float revealed = 1.0 - smoothstep(revealEdge - uRevealSoftness, revealEdge, vHeight01);
                if (revealed < 0.012) discard;
              `,
            )
            .replace(
              '#include <opaque_fragment>',
              /* glsl */ `
                #include <opaque_fragment>

                // A band riding the reveal front — the surface knitting itself
                // shut. Gone by the final stage, when the plant should read as a
                // plant and not as a process.
                float revealBand = revealed * (1.0 - revealed) * 4.0;
                gl_FragColor.rgb += uFrontColor * revealBand * uFrontGlow * 0.55 * (1.0 - uFinal);

                // There was an additive Fresnel rim here, in the accent hue,
                // fading in with the final stage. Removed. There is already a
                // real rim light doing that job from behind the specimen, and a
                // physical light wrapping a real normal beats a constant-colour
                // edge term that ignores where the light actually is. Two rims
                // doing one job is how a scene starts looking like an effects
                // demo rather than a photograph.

                gl_FragColor.a *= revealed * uMeshOpacity;
              `,
            )
        }

        material.needsUpdate = true
        return material
      })

      child.material = Array.isArray(child.material) ? replaced : replaced[0]!
      collected.push(...replaced)
    })

    return collected
  }, [object, uniforms, sceneTuning.foliage])

  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose()
    }
  }, [materials])

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const w = weightsRef.current
    const opacity = config.opacity * w.surface

    // The whole subtree is skipped while the surface has no presence at all.
    group.visible = w.surface > 0.001
    if (!group.visible) return

    uniforms.uSurface.value = w.surface
    uniforms.uMeshOpacity.value = opacity
    uniforms.uFinal.value = w.finalPlant
    uniforms.uRevealSoftness.value = config.revealSoftness
    uniforms.uFrontGlow.value = config.frontGlow

    // Property animation, not shader work: three already owns these uniforms.
    // `envMapIntensity` used to be animated here. It was dead — there is no
    // environment on this scene and none of these materials carry an envMap, so
    // the value went nowhere. Removed rather than "fixed" by adding an IBL: a
    // grey room probe would wash a deliberately near-black frame with fill light
    // and undo the contrast the whole piece depends on.
    for (const material of materials) {
      material.wireframe = config.wireframe
      material.roughness = lerp(config.roughnessFrom, config.roughnessTo, w.finalPlant)
      if (config.emissiveBoost > 0) material.emissiveIntensity = config.emissiveBoost
    }

    // Lighting resolves with the plant. During the reveal the key is flat and
    // dim so the emissive front reads; by the final stage it is a proper key
    // light and the form has depth. Both endpoints come from the theme — see
    // `SCENE_TUNING`, where the light ramp is deliberately the shallower one.
    const [keyRest, keyFinal] = sceneTuning.keyIntensity
    const [rimRest, rimFinal] = sceneTuning.rimIntensity
    if (keyLightRef.current) keyLightRef.current.intensity = lerp(keyRest, keyFinal, w.finalPlant)
    if (rimLightRef.current) rimLightRef.current.intensity = lerp(rimRest, rimFinal, w.finalPlant)
  })

  return (
    <group ref={groupRef} visible={false}>
      <primitive object={object} />
      {/* The three colours here are `ILLUMINANTS`, not palette tokens. They are
          lamps, and a lamp does not change colour because the page did — what
          changes per theme is how hard they are driven. */}
      <ambientLight intensity={sceneTuning.ambientIntensity} color={ILLUMINANTS.fill} />
      <directionalLight
        ref={keyLightRef}
        position={[2.5, 4, 3]}
        intensity={sceneTuning.keyIntensity[0]}
        color={ILLUMINANTS.key}
      />
      {/* Rim from behind and below-left, separating the surface from the void.
          It used to be the accent chartreuse, which tipped the finished plant
          toward a game-engine green and put the accent hue on the specimen —
          the accent belongs to measurement, not to foliage. The sage fill is
          the palette's own cool neutral and reads as bounce rather than a gel. */}
      <directionalLight
        ref={rimLightRef}
        position={[-3, 1.5, -2.5]}
        intensity={sceneTuning.rimIntensity[0]}
        color={ILLUMINANTS.fill}
      />
    </group>
  )
}
