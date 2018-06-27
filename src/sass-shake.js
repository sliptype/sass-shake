const fs = require('fs');
const recursive = require('recursive-readdir');
const path = require('path');
const table = require('table').table;

const validExtensions = ['.scss', '.sass'];

const possibleFilenames = (filename, extension) => [
  filename,
  `${filename}${extension}`,
  `_${filename}${extension}`
  
];

const unique = (array) => array.sort().filter((el, i, arr) => arr.indexOf(el) === i);

const findEntryPoints = (directoryPath, extension) => fs.readdirSync(directoryPath)
  .filter((filename) => filename.includes(extension));

const detectDominantExtension = (directoryPath) => {
  let dominantExtension;
  let dominantExtensionEntryCount = 0;

  for (let extension of validExtensions) {
    const count = findEntryPoints(directoryPath, extension).length;
    if (count > dominantExtensionEntryCount) {
      dominantExtension = extension;
      dominantExtensionEntryCount = count;
    }
  }

  return dominantExtension;
};


const checkIfExcluded = (file, exclusions) => {
  for (let exclusion of exclusions) {
    const exclusionRegex = new RegExp(exclusion.slice(1, exclusion.length - 1));

    if (exclusionRegex.test(file)) {
      return true;
    }
  }

  return false;
};

const traverseSassImportTree = async function (directory, filename, sassFilesImported, extension, shouldLog) {
  const importList = sassFilesImported || [];

  let filePath = path.join(directory, filename);

  try {
    let contents = fs.readFileSync(filePath).toString();

    importList.push(path.normalize(filePath));


    let importRegex = (extension === '.scss')
      ? new RegExp('@import\\s+((?:,?\\s*["\'].*["\']\\s*)*)[\\s;]', 'gm') // scss syntax
      : new RegExp('^@import\\s+(\\S+)', 'gm'); // sass syntax

    let match = importRegex.exec(contents);

    while (match !== null) {

      let importPathsString = match[1];
      let importPaths = importPathsString.split(',').map(p => p.replace(/[\s"']/g, ''));

      for (let importPath of importPaths) {

        let pathPartsRegex = new RegExp('(.*)\/([^\/]*)$');
        let pathParts = importPath.match(pathPartsRegex);
        let possibleImportFilenames = possibleFilenames(importPath, extension);
        let importDirectory = directory;

        if (pathParts) {
          importDirectory = path.join(directory, pathParts[1]);
          possibleImportFilenames = possibleFilenames(pathParts[2], extension);
        }

        for (let guessedFilename of possibleImportFilenames) {
          await traverseSassImportTree(importDirectory, guessedFilename, importList, extension, shouldLog);
        }
      }

      match = importRegex.exec(contents);
    }
  } catch (e) {
    if (shouldLog) {
      if (e.code === 'ENOENT') {
        console.warn(`Attempted file not found: ${filePath}`);
      } else {
        console.log(e);
      }
    }
  }

  return importList;
};

const findUnusedFiles = async function (directory, filesInSassTree, exclusions, extension) {
  let unusedFiles = [];
  let filesInDirectory = await recursive(directory);

  filesInDirectory.forEach((file) => {
    if (!checkIfExcluded(file, exclusions) && file.includes(extension) && !filesInSassTree.includes(file)) {
      unusedFiles.push(file);
    }
  });

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

const sassShake = async function (options) {
  let {
    path: rootPath,
    entryPoints,
    exclude,
    verbose: shouldLog,
    deleteFiles: shouldDeleteFiles,
    hideTable: shouldHideTable
  } = options;

  // Detect dominant extension
  const detectedFileExtension = detectDominantExtension(rootPath);

  // Entry points
  if (!entryPoints) {
    entryPoints = findEntryPoints(rootPath, detectedFileExtension);
  }

  if (entryPoints.length) {

    displayEntryPoints(entryPoints);

    // Used Sass Files
    let filesInSassTree = [];

    for (let entryPoint of entryPoints) {
      filesInSassTree = [...filesInSassTree, ...(await traverseSassImportTree(rootPath, entryPoint, null, detectedFileExtension, shouldLog))];
    }

    filesInSassTree = unique(filesInSassTree);
    console.log(`Found ${filesInSassTree.length} files in Sass tree\n`);


    // Deletion candidates
    let deletionCandidates = await findUnusedFiles(rootPath, filesInSassTree, exclude, detectedFileExtension);

    if (!shouldHideTable) {
      displayFiles(deletionCandidates);
    }

    console.log(`Found ${deletionCandidates.length} unused files in directory tree ${rootPath}`);

    // Deletion
    if (shouldDeleteFiles) {
      deleteFiles(deletionCandidates);
    }

  } else {
    console.log('No entrypoints found (to explicitly specify them, use the --entryPoints flag)');
  }
};

module.exports = sassShake;
