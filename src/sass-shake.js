const fs = require('fs');
const recursive = require('recursive-readdir');
const path = require('path');
const table = require('table').table;
const util = require('util');
const sass = require('node-sass');

const validExtensions = ['.scss', '.sass'];

const findEntryPoints = (directory) =>
  fs
  .readdirSync(directory)
  .filter((filename) =>
    validExtensions
    .some((extension) => filename.includes(extension)))
  .map((entryPoint) => path.join(directory, entryPoint));


const checkIfExcluded = (file, exclusions) => exclusions.some((exclusion) => {
    const exclusionRegex = new RegExp(exclusion.slice(1, exclusion.length - 1));
    return exclusionRegex.test(file);
  });

const findUnusedFiles = async function (directory, filesInSassTree, exclusions) {

  const filesInDirectory = (await recursive(directory));

  const unusedFiles = filesInDirectory
    .filter((file) => !checkIfExcluded(file, exclusions) && !filesInSassTree.includes(file));

  return unusedFiles;
};

const displayEntryPoints = (entryPoints) => {
  console.log('\nTraversing entry points:\n');
  entryPoints.forEach((entryPoint) => console.log(`    ${entryPoint}`));
  console.log('\n');
};

const displayFiles = files => {
  const tableConfig = {
    columns: {
      0: {
        alignment: 'left',
        minWidth: 10
      },
      1: {
        alignment: 'right',
        minWidth: 10
      }
    }
  };

  let totalFileSize = 0;

  const fileData = files.map((file) => {
    let stats = fs.statSync(file);
    let fileSize = stats.size / 1000;
    totalFileSize += fileSize;
    return [file, fileSize];
  });

  let tableData = [['File', 'Size (kb)']];
  tableData = tableData.concat(fileData);

  tableData.push(['Total file size', totalFileSize.toFixed(2)]);

  const output = table(tableData, tableConfig);
  console.log(output);
};

const deleteFiles = files => {
  let deleteCounter = 0;
  for (let file of files) {
    fs.unlinkSync(file);
    deleteCounter++;
  }

  console.log(`Deleted ${deleteCounter} unused files in directory`);
};

/**
 * Returns an array of files included as dependencies in a sass tree
 * @param { String } file
 * @returns { Array }
 */
async function findIncludedFiles(file) {
  const result = await util.promisify(sass.render)({ file });
  return result.stats.includedFiles;
};

async function reduceEntryPointsToDependencies(entryPoints) {
  return await entryPoints.reduce(async function (files, entry) {
    const resolvedFiles = await files.then();
    const newEntries = await findIncludedFiles(entry);
    return Promise.resolve([
      ...resolvedFiles,
      ...newEntries
    ]);
  }, Promise.resolve([]));
}

const shake = async function (options) {

  // Get absolute path for directory to shake
  const root = path.resolve(process.cwd(), options.path || '.');

  const {
    entryPoints = findEntryPoints(root),
    exclude = [],
    verbose: shouldLog,
    deleteFiles: shouldDeleteFiles,
    hideTable: shouldHideTable
  } = options;

  if (entryPoints.length) {

    displayEntryPoints(entryPoints);

    // Used Sass Files
    const filesInSassTree = await reduceEntryPointsToDependencies(entryPoints);

    console.log(`Found ${filesInSassTree.length} files in Sass tree\n`);

    // Deletion candidates
    const deletionCandidates = await findUnusedFiles(root, filesInSassTree, exclude);

    if (!shouldHideTable) {
      displayFiles(deletionCandidates);
    }

    console.log(`Found ${deletionCandidates.length} unused files in directory tree ${root}`);

    // Deletion
    if (shouldDeleteFiles) {
      deleteFiles(deletionCandidates);
    }

    return deletionCandidates;

  } else {
    console.log('No entrypoints found (to explicitly specify them, use the --entryPoints flag)');
  }
};

module.exports = {
  shake
};

