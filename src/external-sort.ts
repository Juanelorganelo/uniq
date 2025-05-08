import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { EOL, tmpdir } from "node:os";
import { Readable, Writable } from "node:stream";
import { formatElapsedTime, shortId } from "./utils";
import { debug, getScriptName, parseArgv } from "./cli";

const CHUNK_SIZE = 5000;

export type Ordering = 1 | -1 | 0;
export const createOrdering = (value: number): Ordering => {
  switch (value) {
    case 1:
    case 0:
    case -1:
      return value as Ordering;
    default:
      throw new Error(
        `Attempted to create an Ordering with invalid value ${value}`
      );
  }
};

// This is usually implemented with a binary tree but for simplicity
// I just did an array impl that maintains the heap invariant
export function createMinHeap<T>(compare: (left: T, right: T) => Ordering) {
  const heap: T[] = [];

  const push = (value: T) => {
    const elem = heap[heap.length - 1];

    if (!elem || compare(elem, value) === -1) {
      heap.push(value);
    } else {
      for (let i = 0; i < heap.length; i++) {
        const ordering = compare(heap[i], value);
        if (ordering === 1) {
          heap.splice(i, 0, value);
          return;
        }
      }

      // There wasn't a bigger element so we just add to the beginning.
      heap.unshift(value);
    }
  };

  const pop = () => heap.shift();

  return {
    pop,
    push,
    get size() {
      return heap.length;
    },
    print(toString: (value: T) => string) {
      return heap.map(toString).join('->');
    }
  };
}

interface FileLine {
  line: string;
  fileIndex: number;
}

type Compare = (left: string, right: string) => Ordering;
const defaultCompare: Compare = (left, right) => {
  if (left === right) {
    return 0;
  } else if (left < right) {
    return -1;
  } else {
    return 1;
  }
};

async function uniq<I extends Readable, O extends Writable>(
  input: I,
  output: O,
  compare: Compare = defaultCompare
) {
  const lines = readline.createInterface({ input });
  const chunk = new Set<string>();
  const files = [];

  for await (const line of lines) {
    chunk.add(line);

    if (chunk.size >= CHUNK_SIZE) {
      files.push(await writeChunk(chunk, compare));
      chunk.clear();
    }
  }

  // Writes the last (maybe incomplete) chunk to the file system.
  if (chunk.size > 0) {
    files.push(await writeChunk(chunk, compare));
  }

  const heap = createMinHeap<FileLine>((a, b) => compare(a.line, b.line));

  const readers = files.map((file) => readline.createInterface(fs.createReadStream(file)));
  const iterators = readers.map(reader => reader[Symbol.asyncIterator]())

  for (let i = 0; i < readers.length; i++) {
    const file = iterators[i];
    // We don't have empty chunks
    const line = await getNextLine(file);
    heap.push({ line: line!, fileIndex: i });
  }

  // Because everything is sorted we just need to compare
  // to previous line, since it can only be less than or equal to nextLine.
  // This allows us to not allocate set, which dramatically improves speed.
  let lastUniqueLine: string | null = null;
  while (heap.size > 0) {
    const { line, fileIndex } = heap.pop()!;

    // This ensure's deduplication
    if (lastUniqueLine == null || compare(line, lastUniqueLine) !== 0) {
      output.write(line + EOL); 
      lastUniqueLine = line;
    }

    const file = iterators[fileIndex];
    const nextLine = await getNextLine(file);

    if (nextLine) {
      heap.push({ line: nextLine, fileIndex });
    }
  }

  for (const reader of readers) {
    reader.close();
  }
}

async function getNextLine(iter: AsyncIterator<string>) {
  const { done, value } = await iter.next();
  return done ? null : value;
}

async function writeChunk(chunk: Set<string>, compare: Compare) {
  const values = Array.from(chunk).sort(compare);
  const tmpFile = path.join(tmpdir(), `chunk-${shortId()}.txt`);
  await fs.promises.writeFile(tmpFile, values.join(EOL) + EOL, "utf-8");
  return tmpFile;
}

// Naive parsing, uses record index instead of header name.
// Works well enough for now though.
const recordId = (record: string) => {
  const cells = record.split(",");
  const parsed = parseInt(cells[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const compareLines = (a: string, b: string) => {
  if (a < b) return -1;
  else if (a > b) return 1;
  else return 0;
};

const compareRecordIds = (a: string, b: string) => {
  const ida = recordId(a);
  const idb = recordId(b);

  if (!idb) return 1;
  if (!ida) return -1;

  const comparison = Math.min(1, Math.max(-1, ida - idb));
  return createOrdering(comparison);
};

const getCompare = (file: string) => {
  switch (path.extname(file)) {
    case ".csv":
      return compareRecordIds;
    default:
      return compareLines;
  }
};

export const main = async (argv: string[]) => {
  const { inputFile, outputFile } = parseArgv(argv, getScriptName(__filename));

  const inputStream = fs.createReadStream(inputFile, { encoding: "utf8" });
  const outputStream = outputFile
    ? fs.createWriteStream(outputFile, { encoding: "utf8" })
    : process.stdout;

  const start = performance.now();

  if (outputFile && !fs.existsSync(outputFile)) {
    await fs.promises.open(outputFile, "w");
  }

  await uniq(inputStream, outputStream, getCompare(inputFile));

  const end = performance.now();
  const elapsedTime = end - start;
  console.log("Entire process took %s", formatElapsedTime(elapsedTime));
};

if (require.main === module) {
  main(process.argv.slice(2));
}
