import { useEffect, useRef, useState } from "react";

/** Browser-only STL viewer. Loaded lazily so three.js never runs during SSR. */
export default function StlViewer({ url }: { url: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const wireRef = useRef<{ set: (v: boolean) => void } | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const mount = mountRef.current;
        if (!mount || disposed) return;

        const width = mount.clientWidth || 600;
        const height = mount.clientHeight || 420;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(1, 1, 1);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.4);
        fill.position.set(-1, -0.5, -1);
        scene.add(fill);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load the model (${res.status})`);
        const buffer = await res.arrayBuffer();
        if (disposed) return;

        const geometry = new STLLoader().parse(buffer);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox!;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        setDims(`${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`);
        geometry.center();

        const material = new THREE.MeshStandardMaterial({ color: 0x8ea3c7, metalness: 0.25, roughness: 0.55 });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        wireRef.current = { set: (v: boolean) => (material.wireframe = v) };

        const box = new THREE.Box3().setFromObject(mesh);
        const radius = box.getSize(new THREE.Vector3()).length() || 10;
        camera.position.set(radius * 0.8, radius * 0.6, radius * 0.9);
        camera.near = radius / 200;
        camera.far = radius * 40;
        camera.updateProjectionMatrix();

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        let frame = 0;
        const animate = () => {
          frame = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
          const w = mount.clientWidth || width;
          const h = mount.clientHeight || height;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(frame);
          window.removeEventListener("resize", onResize);
          controls.dispose();
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : "Could not display this model");
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [url]);

  return (
    <div className="space-y-2">
      <div ref={mountRef} className="h-[420px] w-full rounded-md border bg-muted/30" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{error ?? (dims ? `Bounding box ${dims}` : "Loading model…")}</span>
        <button
          type="button"
          className="rounded border px-2 py-1 hover:bg-accent"
          onClick={() => {
            const next = !wireframe;
            setWireframe(next);
            wireRef.current?.set(next);
          }}
        >
          {wireframe ? "Solid" : "Wireframe"}
        </button>
      </div>
    </div>
  );
}
