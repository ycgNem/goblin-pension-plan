import { REGIONS, type RegionId } from '../data/regions';
import { blocks, blocksSight, SPAWN_GLYPHS, TERRAIN_GLYPHS, TILE, type Mover, type SpawnDef, type TileKind } from './tiles';

export interface Placement {
  glyph: string;
  def: SpawnDef;
  col: number;
  row: number;
}

export interface ExitTile {
  glyph: string;
  col: number;
  row: number;
}

/** A parsed ASCII region map. Rows shorter than the widest row are padded with void. */
export class TileMap {
  readonly cols: number;
  readonly rows: number;
  readonly kinds: TileKind[];
  readonly glyphs: string[];
  readonly exits: ExitTile[] = [];
  readonly spawns: Placement[] = [];
  /** Whether this region's '=' gates are open. Set from the region's gate flag. */
  gateOpen = false;

  constructor(ascii: readonly string[]) {
    this.rows = ascii.length;
    this.cols = Math.max(...ascii.map((r) => r.length));
    this.kinds = new Array<TileKind>(this.cols * this.rows);
    this.glyphs = new Array<string>(this.cols * this.rows);

    for (let row = 0; row < this.rows; row++) {
      const line = (ascii[row] ?? '').padEnd(this.cols, ' ');
      for (let col = 0; col < this.cols; col++) {
        const glyph = line[col] ?? ' ';
        const i = row * this.cols + col;
        this.glyphs[i] = glyph;
        this.kinds[i] = this.parseGlyph(glyph, col, row);
      }
    }
  }

  static forRegion(id: RegionId): TileMap {
    return new TileMap(REGIONS[id].map);
  }

  private parseGlyph(glyph: string, col: number, row: number): TileKind {
    if (glyph >= '0' && glyph <= '9') {
      this.exits.push({ glyph, col, row });
      return 'exit';
    }
    const terrain = TERRAIN_GLYPHS[glyph];
    if (terrain) return terrain;
    const spawn = SPAWN_GLYPHS[glyph];
    if (spawn) {
      this.spawns.push({ glyph, def: spawn, col, row });
      return spawn.solid ? 'prop' : 'floor';
    }
    throw new Error(`Unknown map glyph '${glyph}' at ${col},${row}`);
  }

  get widthPx(): number {
    return this.cols * TILE;
  }

  get heightPx(): number {
    return this.rows * TILE;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  kindAt(col: number, row: number): TileKind {
    return this.inBounds(col, row) ? (this.kinds[row * this.cols + col] ?? 'void') : 'void';
  }

  isBlocked(col: number, row: number, mover: Mover): boolean {
    return blocks(this.kindAt(col, row), mover, this.gateOpen);
  }

  blocksSight(col: number, row: number): boolean {
    return blocksSight(this.kindAt(col, row), this.gateOpen);
  }

  exitAt(col: number, row: number): ExitTile | undefined {
    return this.exits.find((e) => e.col === col && e.row === row);
  }

  findExit(glyph: string): ExitTile | undefined {
    return this.exits.find((e) => e.glyph === glyph);
  }

  spawnOf(kind: SpawnDef['kind']): Placement | undefined {
    return this.spawns.find((s) => s.def.kind === kind);
  }

  /** The tile next to an exit where a goblin arriving through it should stand. */
  arrivalTile(glyph: string): { col: number; row: number } | undefined {
    const exit = this.findExit(glyph);
    if (!exit) return undefined;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const col = exit.col + dc;
      const row = exit.row + dr;
      const kind = this.kindAt(col, row);
      if (kind !== 'exit' && !blocks(kind, 'goblin', true)) return { col, row };
    }
    return undefined;
  }
}
