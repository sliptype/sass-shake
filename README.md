# sass-shake
A command line utility to remove unused sass files


## Description
The amount of `.scss` files in a large project can get out of hand. Unimported files sitting in the repo confuse developers. 

`sass-shake` traverses the Sass import tree and deletes any `.scss` files in a given directory that are not included in the tree. This is a different approach from something like [uncss](https://github.com/uncss/uncss) which finds dead code in the compiled css by rendering the page.

## Installation

```npm install -g sass-shake```

## Usage 

```
Usage: sass-shake [options]

  Options:

    -V, --version                    output the version number
    -p, --path <path>                Path to shake, current working directory by default
    -f, --entryPoints <entryPoints>  Sass entry point files
    -e, --exclude <exclusions>       An array of regexp pattern strings that are matched against files to exclude them from the unused files list
    -v, --verbose                    Show all errors
    -d, --deleteFiles                Delete the unused files
    -t, --hideTable                  Hide the unused files table
    -h, --help                       output usage information
```

By default, all top-level `.scss` files are considered entrypoints, but they can also be specified via the options.

