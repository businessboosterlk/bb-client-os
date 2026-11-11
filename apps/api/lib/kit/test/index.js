/* Lets `node --test kit/test/` run on Node 22, which reads a folder argument as a module and loads its index.js.
   Each test file still runs on its own with `node --test kit/test/<name>.test.js`. */
import './headers.test.js';
import './shield.test.js';
import './validate.test.js';
import './handle.test.js';
import './audit.test.js';
import './upload.test.js';
