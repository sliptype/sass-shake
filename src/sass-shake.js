const fs = require('fs');
const util = require('util');
const recursive = require('recursive-readdir');
const path = require('path');
const readFile = util.promisify(fs.readFile);
const table = require('table').table;

const sassFile = (filename) => `${filename}.scss`;

const sassPartial = (filename) => `_${sassFile(filename)}`;

const possibleFilenames = (filename) => [filename, sassFile(filename), sassPartial(filename)];

const traverseSassImportTree = async function (directory, filename, importList) {
  importList = importList || [];

  try {
    let filePath = path.join(directory, filename);
    let contents = (await readFile(filePath)).toString();

    importList.push(path.normalize(filePath));

    // let importRegex = new RegExp("@import [\"'](.*)[\"']", 'g');
    // let importRegex = new RegExp('@import[ \\s]*(["\'](.*)["\'][ \\s]*,?)*', 'gm');
    let importRegex = new RegExp('@import[ \\s]*((\'[^\']*\')[^\']*)*', 'gm');
    let match = importRegex.exec(contents);

    while (match !== null) {

      let importPath = match[2];
      // ../../../gruntbuild/node_modules/rocketbelt/rocketbelt/tools/tools

      let pathPartsRegex = new RegExp('(.*)\/([^\/]*)$');
      let pathParts = importPath.match(pathPartsRegex);
      let possibleImportFilenames = possibleFilenames(importPath);
      let importDirectory = directory;

      if (pathParts) {
        importDirectory = path.join(directory, pathParts[1]);
        possibleImportFilenames = possibleFilenames(pathParts[2]);
      }

      for (let filename of possibleImportFilenames) {
        await traverseSassImportTree(importDirectory, filename, importList);
      }

      match = importRegex.exec(contents);
    }
  } catch (e) {
    // TODO: optional logging
  }

  return importList;
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

const findUnusedFiles = async function (directory, filesInSassTree, exclusions) {
  let unusedFiles = [];
  let filesInDirectory = await recursive(directory);

  filesInDirectory.forEach((file) => {
    if (!checkIfExcluded(file, exclusions) && file.includes('.scss') && !filesInSassTree.includes(file)) {
      unusedFiles.push(file);
    }
  });

  return unusedFiles;
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

const sassShake = async function (directory, exclusions, shouldDelete) {
  const entryPoints = fs.readdirSync(directory)
    .filter((filename) => filename.includes('.scss'));

  let filesInSassTree = [];

  for (let entryPoint of entryPoints) {
    filesInSassTree = [...filesInSassTree, ...(await traverseSassImportTree(directory, entryPoint))];
  }
  console.log(`Found ${filesInSassTree.length} files in Sass tree`);

  let deletionCandidates = await findUnusedFiles(directory, filesInSassTree, exclusions);
  displayFiles(deletionCandidates);

  console.log(`Found ${deletionCandidates.length} unused files in directory tree ${directory}`);

  if (shouldDelete) {
    deleteFiles(deletionCandidates);
  }
};

module.exports = sassShake;
