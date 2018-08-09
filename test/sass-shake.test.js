const sassShake = require('../src/sass-shake.js');
const path = require('path');

const runSassShake = (unused, root) => async function () {
  const resolvedUnused = unused
        .map((file) => path.resolve(process.cwd(), root, file))
        .sort();

  const result = await sassShake.shake({
    path: root,
    silent: false,
  });

  expect(result.sort()).toEqual(resolvedUnused);
};

describe('sass-shake', () => {

  it('Lists only unused scss files', runSassShake([
      'basic/_unused_too.scss',
      'unused/_unused_partial.scss',
  ], './test/scss'));

  it('Lists only unused sass files', runSassShake([
    'basic/_unused_too.sass',
    'unused/_unused_partial.sass',
  ], './test/sass'));

});
