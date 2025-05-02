import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { EOL, tmpdir } from "node:os";
import { formatElapsedTime, shortId } from "./utils.js";
import { fileURLToPath } from "node:url";

const CHUNK_SIZE = 5000;

type Ordering = 1 | -1 | 0;

function createMinHeap<T>(compare: (left: T, right: T) => Ordering) {
  const heap: T[] = [];

  const push = (value: T) => {
    const elem = heap.pop();
    if (elem) {
      if (elem < value) {
        heap.push(value);
      } else {
        const index = heap.findIndex((x) => compare(x, value) === 1);
        heap.splice(index, 0, value);
      }
    } else {
      heap.push(value);
    }
  };

  const pop = () => {
    return heap.shift();
  };

  return {
    pop,
    push,
    get size() {
      return heap.length;
    },
  };
}

async function uniq<S extends { write: fs.WriteStream["write"] }>(
  file: string,
  writeStream: S
) {
  const rs = fs.createReadStream(file);
  const lines = readline.createInterface(rs);
  const chunk = new Set<string>();
  const files = [];

  for await (const line of lines) {
    chunk.add(line);

    if (chunk.size >= CHUNK_SIZE) {
      files.push(await writeChunk(chunk));
      chunk.clear();
    }
  }

  if (chunk.size > 0) {
    files.push(await writeChunk(chunk));
  }

  interface FileLine {
    line: string;
    fileIndex: number;
  }

  const heap = createMinHeap<FileLine>((left, right) => {
    if (left.line === right.line) {
      return 0;
    } else if (left.line < right.line) {
      return -1;
    } else {
      return 1;
    }
  });

  const readers = files.map((file) =>
    readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    })
  );

  for (let i = 0; i < files.length; i++) {
    const file = readers[i];
    const line = await getNextLine(file);
    if (line) {
      heap.push({ line, fileIndex: i });
    }
  }

  // Because everything is sorted we just need to compare
  // to previous line, since it can only be less than or equal to nextLine.
  // This allows us to not allocate set, which dramatically improves speed.
  let lastUniqueLine = null;
  while (heap.size > 0) {
    const { line, fileIndex } = heap.pop()!;
    const file = readers[fileIndex];

    // This ensure's deduplication
    if (line !== lastUniqueLine) {
      writeStream.write(line + EOL);
      lastUniqueLine = line;
    }

    const nextLine = await getNextLine(file);
    if (nextLine) {
      heap.push({ line: nextLine, fileIndex });
    }
  }

  // Flush the output stream and close readers
  // output.end()
  for (const reader of readers) {
    reader.close();
  }
}

async function getNextLine(rl: readline.Interface) {
  const iter = rl[Symbol.asyncIterator]();

  try {
    const { done, value } = await iter.next();
    return done ? null : value;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function writeChunk(chunk: Set<string>) {
  const values = Array.from(chunk).sort();
  const tmpFile = path.join(tmpdir(), `dedupe-chunk-${shortId()}.txt`);
  await fs.promises.writeFile(tmpFile, "\n" + values.join("\n"), "utf-8");
  return tmpFile;
}

function usage() {
  return [
    "external-sort.ts <input_file> [output_file]",
    "deduplicates the input file using k-ways merging",
  ].join("\n");
}

const main = async () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const testDir = path.join(dirname, "test-files");

  const [, , inputFile, outputFile] = process.argv;
  if (!inputFile) {
    console.error("Missing input file\n")
    console.error(usage())
    process.exit(1)
  }

  const testFile = path.join(testDir, inputFile);

  const start = performance.now();

  if (outputFile && !fs.existsSync(outputFile)) {
    await fs.promises.open(outputFile, 'w')
  }

  await uniq(
    testFile,
    outputFile ? fs.createWriteStream(outputFile) : process.stdout
  );
  const end = performance.now();
  const elapsedTime = end - start;
  console.log("Entire process took %s", formatElapsedTime(elapsedTime));
};
main();
