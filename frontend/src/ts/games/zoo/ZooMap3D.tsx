import { JSXElement, lazy, Show, Suspense } from "solid-js";

import { ZooSpecies } from "./zoo-animals";
import { ZooDecorId } from "./zoo-decor";
import { ZooPenPosition } from "./zoo-state";
import { ZooAnimalLook, ZooMap } from "./ZooMap";

// three.js only loads when a zoo is opened (its own chunk, not precached)
const ZooScene3D = lazy(async () => import("./three/ZooScene3D"));

let webgl: boolean | undefined;
export function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl;
  try {
    const c = document.createElement("canvas");
    webgl = (c.getContext("webgl2") ?? c.getContext("webgl")) !== null;
  } catch {
    webgl = false;
  }
  return webgl;
}

type Props = {
  animals: ZooSpecies[];
  decor?: ZooDecorId[];
  layout: Partial<Record<ZooSpecies | ZooDecorId, ZooPenPosition>>;
  look: (species: ZooSpecies) => ZooAnimalLook;
  editing: boolean;
  goldenBowls?: boolean;
  /** false pauses the 3D drawing (window closed) */
  active: boolean;
  onMove?: (id: ZooSpecies | ZooDecorId, pos: ZooPenPosition) => void;
};

/**
 * The zoo in 3D, with the 2D map while three.js loads and on devices
 * without WebGL. Same props and saved positions as the 2D map.
 */
export function ZooMap3D(props: Props): JSXElement {
  const flat = (): JSXElement => (
    <ZooMap
      animals={props.animals}
      decor={props.decor}
      layout={props.layout}
      look={props.look}
      editing={props.editing}
      goldenBowls={props.goldenBowls}
      onMove={props.onMove}
    />
  );
  return (
    <Show when={hasWebGL()} fallback={flat()}>
      <Suspense fallback={flat()}>
        <ZooScene3D
          animals={props.animals}
          decor={props.decor}
          layout={props.layout}
          look={props.look}
          editing={props.editing}
          goldenBowls={props.goldenBowls}
          active={props.active}
          onMove={props.onMove}
        />
      </Suspense>
    </Show>
  );
}
