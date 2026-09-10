/**
 * Teaches Node's test runner the `@/` path alias.
 *
 * The app imports as `@/lib/format`, which Metro and TypeScript both understand
 * and plain Node does not. Rather than contort the app's imports to suit the test
 * runner — a bundler-shaped alias is the right thing in app source — the runner
 * learns the alias here.
 *
 * It also swaps AsyncStorage for an in-memory stub, because the real package is
 * a native module that cannot load outside a React Native runtime. The stub is
 * the only substitution made — the module under test is always the real one.
 *
 * No dependency. Registered by tests/register.mjs, which the `npm test` script
 * loads with --import so the hook is installed before any test module resolves.
 */
import { statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(fileURLToPath(new URL('../src/', import.meta.url)));

/** The same order a bundler tries: exact file, then extensions, then a directory index. */
const CANDIDATES = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js'];

const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

/** Native modules with no Node implementation, mapped to a test stub. */
const STUBS = {
  '@react-native-async-storage/async-storage': '../tests/stubs/async-storage.mjs',
  // Native, and its published source is TypeScript inside node_modules, which
  // Node's type stripping refuses outright. The stub matches the real semantics
  // rather than a kinder version of them.
  'expo-file-system': '../tests/stubs/expo-file-system.mjs',
};

/** Try each extension a bundler would, and hand back the first real file. */
function firstExisting(base) {
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  const stub = STUBS[specifier];
  if (stub) return next(new URL(stub, import.meta.url).href, context);

  if (specifier.startsWith('@/')) {
    const base = path.join(SRC, specifier.slice(2));
    const found = firstExisting(base);
    if (found) return next(pathToFileURL(found).href, context);
    throw new Error(
      `[alias-hook] could not resolve "${specifier}" under ${SRC}. ` +
        `Tried: ${CANDIDATES.map((s) => path.basename(base) + s).join(', ')}`,
    );
  }

  // A RELATIVE import with no extension. Metro resolves `./recording-store`
  // happily; Node ESM does not, so a module importing its own sibling the
  // ordinary way would be untestable. Applying the same extension search here
  // keeps the test runner honest about what the bundler actually accepts,
  // instead of forcing app code into an import style chosen to suit the tests.
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    if (!path.extname(specifier) && context.parentURL?.startsWith('file:')) {
      const from = path.dirname(fileURLToPath(context.parentURL));
      const found = firstExisting(path.resolve(from, specifier));
      if (found) return next(pathToFileURL(found).href, context);
    }
  }

  return next(specifier, context);
}
