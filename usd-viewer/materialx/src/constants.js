// Keep the runtime version tied to package.json. The import attribute is
// required by browsers and Node.js for JSON modules; bundlers also understand
// this shape.
import pkg from '../package.json' with { type: 'json' };
export const VERSION = pkg.version;
