const sassShake = require('../src/sass-shake.js');
const path = require('path');

const unused = [
  'basic/_unused_too.scss',
  'unused/_unused_partial.scss',
];

describe('sass-shake', () => {

  it('Lists only unused scss files', async function () {

    const root = './test/scss';

    const resolvedUnused = unused
      .map((file) => path.resolve(process.cwd(), root, file));

    const result = await sassShake.shake({
      path: root
    });

    expect(result).toEqual(resolvedUnused);
  });
});
