const program = require('commander');
const sassShake = require('./src/sass-shake.js');

const list = (val) => val.split(',');

program
  .version('1.0.0')
  .option('-e, --exclude <exclusions>', 'An array of regexp pattern strings that are matched against files to exclude them from the unused files list', list)
  .option('-p, --path <path>', 'Path to shake, current working directory by default')
  .option('-d, --delete', 'Delete the unused files')
  .parse(process.argv);


sassShake(program.path || process.cwd(), program.exclude, program.delete);
