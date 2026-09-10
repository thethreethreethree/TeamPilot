// Loaded via `node --import` so the resolve hook is installed before any test
// module is loaded. See alias-hook.mjs for why the alias needs teaching.
import { register } from 'node:module';
register('./alias-hook.mjs', import.meta.url);
