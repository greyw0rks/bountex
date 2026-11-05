import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

function Reward({ reduced = false }: { reduced?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const coin = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * 1.08,
        y = Math.sin(a) * 1.08;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    });
  }, []);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.getElapsedTime();
    if (group.current) {
      group.current.position.y = Math.sin(t * 0.72) * 0.09;
      group.current.rotation.z = Math.sin(t * 0.45) * 0.045;
    }
    if (coin.current) coin.current.rotation.y = -0.35 + Math.sin(t * 0.4) * 0.2;
  });
  const glyph = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.4, -0.48);
    s.lineTo(-0.4, 0.48);
    s.lineTo(0.07, 0.48);
    s.bezierCurveTo(0.59, 0.48, 0.58, 0.03, 0.3, 0);
    s.bezierCurveTo(0.68, -0.17, 0.52, -0.48, 0.09, -0.48);
    s.closePath();
    const h1 = new THREE.Path();
    h1.moveTo(-0.13, 0.14);
    h1.lineTo(0.08, 0.14);
    h1.bezierCurveTo(0.3, 0.14, 0.3, 0.32, 0.08, 0.32);
    h1.lineTo(-0.13, 0.32);
    h1.closePath();
    s.holes.push(h1);
    const h2 = new THREE.Path();
    h2.moveTo(-0.13, -0.29);
    h2.lineTo(0.1, -0.29);
    h2.bezierCurveTo(0.32, -0.29, 0.32, -0.09, 0.1, -0.09);
    h2.lineTo(-0.13, -0.09);
    h2.closePath();
    s.holes.push(h2);
    return new THREE.ExtrudeGeometry(s, {
      depth: 0.03,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 3,
      steps: 1,
    });
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      glyph.dispose();
    },
    [geometry, glyph],
  );
  return (
    <group ref={group} rotation={[0.08, -0.05, -0.16]}>
      <group ref={coin} rotation={[0.14, -0.35, 0]}>
        <mesh geometry={geometry} position={[0, 0, -0.15]}>
          <meshPhysicalMaterial
            color="#8295ff"
            roughness={0.24}
            metalness={0.68}
            clearcoat={1}
            clearcoatRoughness={0.2}
          />
        </mesh>
        <mesh geometry={glyph} position={[0.07, 0, 0.24]}>
          <meshStandardMaterial color="#dde4ff" roughness={0.22} metalness={0.45} />
        </mesh>
        <mesh geometry={geometry} position={[0, 0, -0.21]} scale={[1.03, 1.03, 1]}>
          <meshStandardMaterial color="#aebeff" metalness={0.75} roughness={0.19} />
        </mesh>
      </group>
      <mesh rotation={[1.05, 0.3, 0.4]}>
        <torusGeometry args={[1.62, 0.013, 12, 100]} />
        <meshStandardMaterial
          color="#66769f"
          transparent
          opacity={0.8}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[1.49, -0.25, 0.5]} rotation={[0.2, -0.35, -0.24]}>
        <boxGeometry args={[0.43, 0.43, 0.09]} />
        <meshStandardMaterial color="#c8ff4d" metalness={0.25} roughness={0.32} />
      </mesh>
      <mesh position={[-1.27, 0.92, 0.25]} rotation={[0.5, 0.3, 0.4]}>
        <octahedronGeometry args={[0.18]} />
        <meshStandardMaterial color="#d7ff80" metalness={0.35} roughness={0.2} />
      </mesh>
      <mesh position={[-1.45, -0.58, -0.12]}>
        <sphereGeometry args={[0.095, 20, 20]} />
        <meshStandardMaterial color="#c8ff4d" metalness={0.35} roughness={0.2} />
      </mesh>
      <mesh position={[0.7, 1.22, -0.4]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color="#ced8ff" />
      </mesh>
    </group>
  );
}
export default function RewardScene({
  reduced = false,
  onError,
}: {
  reduced?: boolean;
  onError?: () => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.8], fov: 42 }}
      dpr={[1, 1.5]}
      frameloop={reduced ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => onError?.());
      }}
    >
      <ambientLight intensity={1.25} />
      <directionalLight position={[2, 4, 5]} intensity={4} color="#e2e8ff" />
      <pointLight position={[-3, -1, 3]} intensity={15} color="#5167ff" />
      <pointLight position={[3, -2, 2]} intensity={9} color="#c8ff4d" />
      <Reward reduced={reduced} />
    </Canvas>
  );
}
