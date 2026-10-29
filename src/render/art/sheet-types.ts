// Shapes of the packed art that scripts/art/pack.ts writes into sheets.gen.ts.

export interface ClipDef {
  /** Row of the sheet the clip's frames sit on, left to right. */
  row: number;
  frames: number;
}

export interface SheetDef {
  /** PNG under src/assets/art/. */
  file: string;
  /** Cell size: every frame of the sheet has the same box. */
  w: number;
  h: number;
  /** The pixel of a cell that sits on the entity's position, usually between the feet. */
  ax: number;
  ay: number;
  clips: Readonly<Record<string, ClipDef>>;
}

/** Corner terrain codes in a tileset: 0 lower (floor), 1 upper (wall top), 2 transition (wall face). */
export type Terrain = 0 | 1 | 2;

export interface TileDef {
  /** Top-left of the tile on the tileset image. */
  x: number;
  y: number;
  /** NW, NE, SW, SE. */
  corners: readonly [number, number, number, number];
  /** The 4x4 neighborhood this tile wants, row by row: the middle 2x2 is its corners, -1 is "anything". */
  pattern: readonly number[];
}

export interface TilesetDef {
  file: string;
  size: number;
  tiles: readonly TileDef[];
}

/** A dialogue bust on portraits.png. Code opens its mouth and closes its eyes, so one image gives all four frames. */
export interface PortraitArtDef {
  /** Left edge of its cell; every cell is PORTRAIT_SIZE square. */
  x: number;
  /** The mouth (x, y, width): talking opens it two pixels tall. */
  mouth: readonly [number, number, number];
  /** Each eye's box (x, y, w, h): a blink paints it over with the lid color and a lash line. */
  eyes: readonly (readonly [number, number, number, number])[];
  /** Skin just above the eyes. */
  lid: string;
}

/** A prop on props.png: every variant shares one box, so states swap without the prop shifting. */
export interface PropArtDef {
  w: number;
  h: number;
  /** Top-left of each variant's box ('' is the usual state). */
  variants: Readonly<Record<string, readonly [number, number]>>;
  /** Anchor in the box. Without one, the hand-drawn prop's proportions carry over. */
  anchor?: readonly [number, number];
  /** Where code draws into the prop (a sign's lettering, the hatch window): x, y, w, h in the box. */
  board?: readonly [number, number, number, number];
}

/** A painted title or intro backdrop, on its own image. */
export interface BackdropArtDef {
  file: string;
  w: number;
  h: number;
  /** The title's: where its 480-wide stage starts, and the row the camera's pan ends on. */
  ox?: number;
  rest?: number;
  /** The light map's darkness. A painting brings its own light, so this is brighter than a code backdrop's. */
  ambient?: string;
  /** Points (x, y) and boxes (x, y, w, h) the animation layer uses: bells, the chute, where the goblin sits. */
  marks: Readonly<Record<string, readonly number[]>>;
}
