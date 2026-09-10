/* global Buffer -- a Node global; this stub only ever runs under the test runner. */
/**
 * An in-memory stand-in for expo-file-system, so the file-backed caches can be
 * tested under plain Node.
 *
 * It implements only what the app uses, and implements it HONESTLY — same
 * semantics, same failure modes. A stub that is more forgiving than the real
 * thing lets a bug pass here and fail on the phone, which is worse than having
 * no test at all because it looks like coverage.
 *
 * Faithful in the ways that matter:
 *   - a File under a Directory that was never created does not exist
 *   - reading a missing file throws, exactly as the real one does
 *   - deleting a Directory removes everything beneath it
 *   - `uri` is a real-looking path, because code builds and compares them
 *
 * `__reset` and `__files` are test-only; the app never sees them.
 */

/** path -> string contents. Directories are tracked separately, because an
 *  empty directory is a real state the app depends on. */
const files = new Map();
const dirs = new Set(['file:///documents']);

const DOCUMENTS = 'file:///documents';

function join(...parts) {
  return parts
    .map((p, i) => (i === 0 ? String(p).replace(/\/+$/, '') : String(p).replace(/^\/+|\/+$/g, '')))
    .filter(Boolean)
    .join('/');
}

/** The uri of anything passed as a parent: a Directory, a File, or a string. */
function uriOf(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return x.uri ?? '';
}

class Directory {
  constructor(...parts) {
    this.uri = join(...parts.map(uriOf).filter(Boolean));
  }

  get exists() {
    return dirs.has(this.uri);
  }

  create({ intermediates = false } = {}) {
    if (!intermediates) {
      const parent = this.uri.slice(0, this.uri.lastIndexOf('/'));
      if (parent && !dirs.has(parent)) {
        throw new Error(`ENOENT: parent directory does not exist: ${parent}`);
      }
    }
    // Create every ancestor, as intermediates:true does.
    const segments = this.uri.split('/');
    for (let i = 3; i <= segments.length; i++) {
      dirs.add(segments.slice(0, i).join('/'));
    }
  }

  delete() {
    if (!dirs.has(this.uri)) throw new Error(`ENOENT: no such directory: ${this.uri}`);
    const prefix = `${this.uri}/`;
    for (const key of [...files.keys()]) {
      if (key === this.uri || key.startsWith(prefix)) files.delete(key);
    }
    for (const key of [...dirs]) {
      if (key === this.uri || key.startsWith(prefix)) dirs.delete(key);
    }
  }

  list() {
    const prefix = `${this.uri}/`;
    return [...files.keys()]
      .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .map((k) => new File(k));
  }
}

class File {
  constructor(...parts) {
    this.uri = join(...parts.map(uriOf).filter(Boolean));
  }

  get exists() {
    return files.has(this.uri);
  }

  /** Bytes, as the real one reports for a written file. */
  get size() {
    const content = files.get(this.uri);
    return content === undefined ? null : Buffer.byteLength(content, 'utf8');
  }

  get name() {
    return this.uri.slice(this.uri.lastIndexOf('/') + 1);
  }

  write(contents) {
    const parent = this.uri.slice(0, this.uri.lastIndexOf('/'));
    if (parent && !dirs.has(parent)) {
      throw new Error(`ENOENT: directory does not exist: ${parent}`);
    }
    files.set(this.uri, String(contents));
  }

  async text() {
    if (!files.has(this.uri)) throw new Error(`ENOENT: no such file: ${this.uri}`);
    return files.get(this.uri);
  }

  textSync() {
    if (!files.has(this.uri)) throw new Error(`ENOENT: no such file: ${this.uri}`);
    return files.get(this.uri);
  }

  async arrayBuffer() {
    if (!files.has(this.uri)) throw new Error(`ENOENT: no such file: ${this.uri}`);
    return Buffer.from(files.get(this.uri), 'utf8').buffer;
  }

  delete() {
    if (!files.has(this.uri)) throw new Error(`ENOENT: no such file: ${this.uri}`);
    files.delete(this.uri);
  }

  async move(destination) {
    if (!files.has(this.uri)) throw new Error(`ENOENT: no such file: ${this.uri}`);
    const target = uriOf(destination);
    files.set(target, files.get(this.uri));
    files.delete(this.uri);
    this.uri = target;
  }
}

const Paths = {
  get document() {
    return new Directory(DOCUMENTS);
  },
  get cache() {
    return new Directory('file:///cache');
  },
  /** Plenty of room by default; a test that cares sets it. */
  availableDiskSpace: 8 * 1024 * 1024 * 1024,
  totalDiskSpace: 64 * 1024 * 1024 * 1024,
};

/** test-only */
function __reset() {
  files.clear();
  dirs.clear();
  dirs.add(DOCUMENTS);
  dirs.add('file:///cache');
}

/** test-only: inspect what is actually on "disk" */
function __files() {
  return new Map(files);
}

export { Directory, File, Paths, __reset, __files };
