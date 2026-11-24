import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Country } from "@/lib/api/types";

const RADIUS = 1;
/** A click/hover selects the nearest country whose centre is within this angle of the pointer. */
const PICK_RADIUS_DEG = 6;
const PICK_COS = Math.cos((PICK_RADIUS_DEG * Math.PI) / 180);
/** Pointer travel (px) above which a press is treated as a drag, not a click. */
const DRAG_TOLERANCE = 6;

function toUnitVector(lat: number, lng: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
}

interface Marker {
  country: Country;
  dir: THREE.Vector3;
}

/** Visual-only dot (it never intercepts pointer events — picking happens on the globe surface). */
function Dot({ marker, selected, hovered }: { marker: Marker; selected: boolean; hovered: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const position = useMemo(() => marker.dir.clone().multiplyScalar(RADIUS * 1.008), [marker.dir]);
  const orientation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), marker.dir), [marker.dir]);
  const hasRecipes = marker.country.recipeCount > 0;

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const pulse = 1 + ((Math.sin(clock.elapsedTime * 3) + 1) / 2) * 0.6;
    ring.current.scale.setScalar(selected ? pulse * 1.4 : hovered ? 1.5 : 1);
  });

  const color = selected ? "#c9a24b" : hovered ? "#ffffff" : hasRecipes ? "#e8f0e0" : "#7d8a83";
  const size = selected ? 0.019 : hasRecipes ? 0.012 : 0.007;
  return (
    <group position={position} quaternion={orientation}>
      <mesh raycast={() => null}>
        <circleGeometry args={[size, 20]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {(hasRecipes || selected || hovered) && (
        <mesh ref={ring} raycast={() => null}>
          <ringGeometry args={[size * 1.5, size * 1.9, 28]} />
          <meshBasicMaterial color={color} transparent opacity={selected ? 0.95 : 0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Earth({ countries, selected, onSelect, autoRotate }: { countries: Country[]; selected: string | null; onSelect: (c: Country) => void; autoRotate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState<Marker | null>(null);
  const [map, normal, specular, clouds] = useTexture([
    "/textures/earth_atmos_2048.jpg",
    "/textures/earth_normal_2048.jpg",
    "/textures/earth_specular_2048.jpg",
    "/textures/earth_clouds_1024.png"
  ]) as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture];
  map.colorSpace = THREE.SRGBColorSpace;

  const markers = useMemo<Marker[]>(() => countries.map((c) => ({ country: c, dir: toUnitVector(c.latitude, c.longitude) })), [countries]);

  // When a country is selected (globe or list), turn the globe so it faces the camera.
  const targetRotation = useRef<number | null>(null);
  const selectedMarker = markers.find((m) => m.country.code === selected);
  useEffect(() => {
    targetRotation.current = selectedMarker ? Number.NaN : null; // resolved in the frame loop (needs the camera)
  }, [selectedMarker]);

  useFrame(({ camera }, delta) => {
    const g = group.current;
    if (!g) return;
    if (targetRotation.current !== null && selectedMarker) {
      if (Number.isNaN(targetRotation.current)) {
        const { x, z } = selectedMarker.dir;
        const cameraAzimuth = Math.atan2(camera.position.x, camera.position.z);
        const goal = Math.atan2(-x, z) + cameraAzimuth;
        // Shortest way round from the current angle.
        const diff = Math.atan2(Math.sin(goal - g.rotation.y), Math.cos(goal - g.rotation.y));
        targetRotation.current = g.rotation.y + diff;
      }
      const remaining = targetRotation.current - g.rotation.y;
      g.rotation.y += Math.abs(remaining) < 0.002 ? remaining : remaining * Math.min(1, delta * 4);
      if (Math.abs(remaining) < 0.002) targetRotation.current = null;
    } else if (autoRotate && !hovered) {
      g.rotation.y += delta * 0.05;
    }
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.01;
  });

  /** Nearest country to the surface point under the pointer (in the globe's rotating frame). */
  const pick = (point: THREE.Vector3): Marker | null => {
    if (!group.current) return null;
    const dir = group.current.worldToLocal(point.clone()).normalize();
    let best: Marker | null = null;
    let bestDot = PICK_COS;
    for (const m of markers) {
      const d = m.dir.dot(dir);
      if (d > bestDot) {
        bestDot = d;
        best = m;
      }
    }
    return best;
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const m = pick(e.point);
    setHovered((prev) => (prev?.country.code === m?.country.code ? prev : m));
    document.body.style.cursor = m ? "pointer" : "grab";
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation(); // never let a click pass through the Earth to the far side
    if (e.delta > DRAG_TOLERANCE) return;
    const m = pick(e.point);
    if (m) onSelect(m.country);
  };

  return (
    <group ref={group}>
      <mesh
        onPointerMove={onMove}
        onPointerOut={() => {
          setHovered(null);
          document.body.style.cursor = "";
        }}
        onClick={onClick}
      >
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshPhongMaterial map={map} normalMap={normal} specularMap={specular} shininess={12} />
      </mesh>
      <mesh ref={cloudsRef} scale={1.006} raycast={() => null}>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <meshLambertMaterial map={clouds} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {markers.map((m) => (
        <Dot key={m.country.code} marker={m} selected={selected === m.country.code} hovered={hovered?.country.code === m.country.code} />
      ))}
      {hovered && (
        <Html position={hovered.dir.clone().multiplyScalar(RADIUS * 1.03)} center style={{ pointerEvents: "none" }}>
          <div
            style={{
              transform: "translateY(-26px)",
              whiteSpace: "nowrap",
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(15,20,17,0.85)",
              color: "#fffdf8",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "Inter, system-ui, sans-serif"
            }}
          >
            <span className="flag-emoji">{hovered.country.flagEmoji}</span> {hovered.country.name}
            <span style={{ opacity: 0.7 }}> · {hovered.country.recipeCount} {hovered.country.recipeCount === 1 ? "recipe" : "recipes"}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Interactive globe. Lazy-loaded so three.js only downloads on the Flavor Map. */
export default function Globe({ countries, selected, onSelect }: { countries: Country[]; selected: string | null; onSelect: (c: Country) => void }) {
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [interacting, setInteracting] = useState(false);
  return (
    <Canvas camera={{ position: [0, 0.4, 2.7], fov: 45 }} dpr={[1, 2]} aria-label="Interactive globe of countries" role="img">
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 3, 5]} intensity={1.3} />
      <Earth countries={countries} selected={selected} onSelect={onSelect} autoRotate={!reducedMotion && !interacting && !selected} />
      <OrbitControls
        enablePan={false}
        minDistance={1.4}
        maxDistance={4}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        onStart={() => setInteracting(true)}
        onEnd={() => setInteracting(false)}
      />
    </Canvas>
  );
}
