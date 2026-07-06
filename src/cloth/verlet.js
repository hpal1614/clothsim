const GRAVITY = 0.28;
const CONSTRAINT_ITERATIONS = 6;
const TEAR_FACTOR = 1.8;

class Point {
  constructor(x, y, z, pinned = false) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.oldX = x;
    this.oldY = y;
    this.oldZ = z;
    this.pinned = pinned;
  }

  update() {
    if (this.pinned) return;
    const vx = (this.x - this.oldX) * 0.99;
    const vy = (this.y - this.oldY) * 0.99;
    const vz = (this.z - this.oldZ) * 0.99;
    this.oldX = this.x;
    this.oldY = this.y;
    this.oldZ = this.z;
    this.x += vx;
    this.y += vy - GRAVITY;
    this.z += vz;
  }
}

class Constraint {
  constructor(p1, p2) {
    this.p1 = p1;
    this.p2 = p2;
    this.restLength = Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
    this.torn = false;
  }

  satisfy() {
    if (this.torn) return;
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const dz = this.p2.z - this.p1.z;
    const dist = Math.hypot(dx, dy, dz) || 0.0001;

    if (dist > this.restLength * TEAR_FACTOR) {
      this.torn = true;
      return;
    }

    const diff = (dist - this.restLength) / dist;
    const offsetX = dx * 0.5 * diff;
    const offsetY = dy * 0.5 * diff;
    const offsetZ = dz * 0.5 * diff;

    if (!this.p1.pinned) {
      this.p1.x += offsetX;
      this.p1.y += offsetY;
      this.p1.z += offsetZ;
    }
    if (!this.p2.pinned) {
      this.p2.x -= offsetX;
      this.p2.y -= offsetY;
      this.p2.z -= offsetZ;
    }
  }
}

/** A rectangular grid of points connected by structural constraints. */
export class ClothPatch {
  constructor({ cols, rows, spacing, originX = 0, originY = 0, originZ = 0, pinTop = true }) {
    this.cols = cols;
    this.rows = rows;
    this.points = [];
    this.constraints = [];
    // horiz[y][x]: constraint between (x,y)-(x+1,y). vert[y][x]: (x,y)-(x,y+1).
    // Kept alongside the flat list so renderers can look up a quad's edges directly.
    this.horiz = [];
    this.vert = [];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const pinned = pinTop && y === 0;
        this.points.push(
          new Point(
            originX + x * spacing,
            originY - y * spacing,
            originZ,
            pinned,
          ),
        );
      }
    }

    const at = (x, y) => this.points[y * cols + x];
    for (let y = 0; y < rows; y++) {
      this.horiz.push([]);
      this.vert.push([]);
      for (let x = 0; x < cols; x++) {
        if (x < cols - 1) {
          const c = new Constraint(at(x, y), at(x + 1, y));
          this.constraints.push(c);
          this.horiz[y][x] = c;
        }
        if (y < rows - 1) {
          const c = new Constraint(at(x, y), at(x, y + 1));
          this.constraints.push(c);
          this.vert[y][x] = c;
        }
      }
    }
  }

  /** True if any edge bounding quad (x,y)-(x+1,y+1) has torn. */
  isQuadTorn(x, y) {
    const top = this.horiz[y]?.[x];
    const bottom = this.horiz[y + 1]?.[x];
    const left = this.vert[y]?.[x];
    const right = this.vert[y]?.[x + 1];
    return [top, bottom, left, right].some((c) => c?.torn);
  }

  /** Removes every constraint pinning the top row, so the whole patch falls free. */
  releaseAllPins() {
    for (const p of this.points) p.pinned = false;
  }

  step() {
    for (const p of this.points) p.update();
    for (let i = 0; i < CONSTRAINT_ITERATIONS; i++) {
      for (const c of this.constraints) c.satisfy();
    }
  }

  /** True once every constraint has torn (patch is fully shredded / detached). */
  isFullyTorn() {
    return this.constraints.every((c) => c.torn);
  }
}
