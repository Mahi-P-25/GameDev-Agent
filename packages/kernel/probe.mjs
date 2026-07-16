import { Kernel } from './src/index.ts';
const k = new Kernel({ logSinks: [] });
const t = setTimeout(() => { console.log('TIMEOUT/HANG'); process.exit(1); }, 8000);
await k.boot();
console.log('state after boot', k.state);
await k.shutdown();
console.log('state after shutdown', k.state);
clearTimeout(t);
process.exit(0);
