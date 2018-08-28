const fs = require('fs');
const path = require('path');
const recursive = require('recursive-readdir');
const sass = require('node-sass');
const table = require('table').table;
const util = require('util');

const validExtensions = ['.scss', '.sass'];

/**
 * Remove duplicate values from an array
 * @param { Array } array
 */
const unique = (array) => Array.from(new Set(array));

/**
 * Determine if a file has a valid extension
 * @param { String } file
 * @returns { Boolean } does the file have a valid extension
 */
const isSassFile = (file) => validExtensions
  .some((extension) => file.includes(extension));

/**
 * Transform a directory into a list of sass entry points
 * @param { String } directory
 * @returns { Array } list of entry points
 */
const findEntryPoints = (directory) =>
  fs
  .readdirSync(directory)
  .filter(isSassFile)
  .map((entryPoint) => path.join(directory, entryPoint));

/**
 * Gather a list of dependencies from a single sass tree
 * @param { String } file
 * @returns { Array } dependencies
 */
async function getDependencies(includePaths, file) {
  const result = await util.promisify(sass.render)({ includePaths, file });
  return result.stats.includedFiles;
};

/**
 * Transform a list of entry points into a list of all dependencies
 * @param { Array } entryPoints
 * @returns { Array } dependencies
 */
async function reduceEntryPointsToDependencies(includePaths, entryPoints) {
  return await entryPoints.reduce(async function (allDeps, entry) {
    const resolvedDeps = await allDeps.then();
    const newDeps = await getDependencies(includePaths, entry);
    return Promise.resolve([
      ...resolvedDeps,
      ...newDeps
    ]);
  }, Promise.resolve([]));
}

/**
 * Determine if a file is excluded via regex
 * @param { String } file
 * @param { Array } exclusions
 * @returns { Boolean } is the file excluded
 */
const isExcluded = (file, exclusions) =>
  exclusions.some((exclusion) => {
    const exclusionRegex = new RegExp(exclusion.slice(1, exclusion.length - 1));
    return exclusionRegex.test(file);
  });

/**
 * Determine if a file is unused by sass
 * @param { String } file
 * @param { Array } filesInSassTree
 * @param { Array } exclusions
 * @returns { Boolean } is the file unused
 */
const isUnused = (file, filesInSassTree, exclusions) => {
  file = file.split('\\').join('/');
	
  return isSassFile(file)
  && !isExcluded(file, exclusions)
  && !filesInSassTree.includes(file);
}

/**
 * Compare directory contents with a list of files that are in use
 * @param { String } directory
 * @param { Array } filesInSassTree
 * @param { Array } exclusions
 * @returns { Array } files that are unused
 */
const findUnusedFiles = async function (directory, filesInSassTree, exclusions) {
  const filesInDirectory = (await recursive(directory));

  const unusedFiles = filesInDirectory
    .filter((file) => isUnused(file, filesInSassTree, exclusions));

  return unusedFiles;
};

/**
 * Delete an array of files
 * @param { Array } files
 * @returns { Number } number of files deleted
 */
const deleteFiles = (files) => files.map(fs.unlinkSync).length;

/**
 * Log a list of sass entry points
 * @param { Array } entryPoints
 */
const displayEntryPoints = (entryPoints) => {
  console.log('\nTraversing entry points:\n');
  entryPoints.forEach((entryPoint) => console.log(`    ${entryPoint}`));
  console.log('\n');
};

/**
 * Log a pretty table of files
 * @param { Array } files
 */
const displayFiles = (files) => {
  if (!files.length) {
    return;
  }

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

  const fileData = files.map((file) => {
    const stats = fs.statSync(file);
    const fileSize = stats.size / 1000;
    return [file, fileSize];
  });

  const totalFileSize = fileData.reduce((total, [,size]) => total + size, 0);

  const tableData = [['File', 'Size (kb)']]
        .concat(fileData, [['Total file size', totalFileSize.toFixed(2)]]);

  const output = table(tableData, tableConfig);
  console.log(output);
};


/**
 * Shake a sass directory given options (see README)
 * @param { Object } options
 * @returns { Array } unused files
 */
const shake = async function (options) {

  // Get absolute path for directory to shake
  const root = path.resolve(process.cwd(), options.path || '.');

  const {
    entryPoints = findEntryPoints(root),
    exclude = [],
    silent = false,
    hideTable = false,
    delete: shouldDeleteFiles = false,
  } = options;

  if (entryPoints.length) {

    silent || displayEntryPoints(entryPoints);

    const filesInSassTree = await reduceEntryPointsToDependencies([root], entryPoints);
		const uniqueFilesInSassTree = unique(filesInSassTree);
    silent || console.log(`Found ${uniqueFilesInSassTree.length} files in Sass tree\n`);

    const deletionCandidates = await findUnusedFiles(root, uniqueFilesInSassTree, exclude);
    silent || hideTable || displayFiles(deletionCandidates);
    silent || console.log(`Found ${deletionCandidates.length} unused files in directory tree ${root}`);

    shouldDeleteFiles && console.log(`Deleted ${deleteFiles(deletionCandidates)} unused files in directory`);
    return deletionCandidates;
  } else {
    silent || console.log('No entrypoints found (to explicitly specify them, use the --entryPoints flag)');
  }
};

module.exports = {
  shake
};

