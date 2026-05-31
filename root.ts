import { bootStation } from './ENGINES/boot.js';

const { snapshot } = bootStation();
console.log(JSON.stringify(snapshot, null, 2));
