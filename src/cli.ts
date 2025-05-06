import fs from "node:fs";
import path from "node:path";

interface Cli {
  inputFile: string;
  outputFile?: string;
}

export interface PrintErrorOptions {
  // Will use error.stack if available
  // withStack: false is captured by passing an empty object
  withStack?: true;
}

const Colors = {
  red: "\u001b[31m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
  reset: "\u001b[0m",
} as const;
type Colors = typeof Colors;

/**
 * This signature allows us to inspect the output
 * right here in our IDE, without running the program!
 */
function colorize<T extends string, K extends keyof Colors>(
  text: T,
  color: K
): `${Colors[K]}${T}${Colors["reset"]}` {
  return `${Colors[color]}${text}${Colors.reset}`;
}

export function printErrorMessage(
  message: string,
  scriptName: ScriptName
): never {
  console.log(`${colorize(scriptName + ": " + message, "red")}`);
  usage(scriptName);
}

function info(message: string) {
  return console.log(colorize(message, "cyan"));
}

const parseInputFile = (inputFile: string, scriptName: ScriptName) => {
  if (!fs.existsSync(inputFile)) {
    printErrorMessage(
      `The input file argument must be a valid path to a file. File ${inputFile}, does not exist`,
      scriptName
    );
  }
  return inputFile;
};

const parseOutputFile = (
  outputFile: string,
  flagName: string,
  scriptName: ScriptName
) => {
  if (!outputFile) {
    printErrorMessage(`The value of ${flagName} must not be empty`, scriptName);
  }
  return outputFile;
};

function usage(scriptName: ScriptName): never {
  [
    `${scriptName}: Usage:`,
    `${scriptName}: ./${scriptName} [--output-file <output-file>] <input-file>`,
    `${scriptName}: Reads a file and dedupes it's content line by line`,
  ].forEach((line) => info(line));
  process.exit(1);
}

/**
 * Values of this type can only be created with getScriptName
 */
export type ScriptName = string & { readonly _: unique symbol };

export function getScriptName(__filename: string): ScriptName {
  return path.basename(__filename) as ScriptName;
}

export const parseArgv = (argv: string[], scriptName: ScriptName): Cli => {
  const cli: Partial<Cli> = {};

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        // Since usage has return type never break triggers a warning
        // when allowUnreachableCode: false is true so we omit it
        usage(scriptName);
      case "-o":
      case "--output-file":
        cli.outputFile = parseOutputFile(argv[++i], arg, scriptName);
        i++;
        break;
      // Positional arguments
      default: {
        if (cli.inputFile) {
          printErrorMessage(`unexpected positional parameter ${arg}`, scriptName)
        }
        if (arg.startsWith('-')) {
          printErrorMessage(`unknown option ${arg}`, scriptName)
        }
        cli.inputFile = parseInputFile(arg, scriptName);
        i++;
      }
    }
  }

  if (!cli.inputFile) {
    printErrorMessage(`Input file is required`, scriptName);
  }

  return cli as Cli;
};
