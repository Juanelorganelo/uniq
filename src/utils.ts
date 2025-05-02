import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline";

const alphabet =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

const defaultByteLength = 10;

export function shortId(byteLength = defaultByteLength): string {
  const id = [];
  // Alphabet is ASCII only so all chars are 1 byte
  for (let i = 0; i < byteLength; i++) {
    const idx = crypto.randomInt(alphabet.length);
    id.push(alphabet[idx]);
  }
  return id.join("");
}

export function invariant(
  condition: unknown,
  message: string | (() => string)
): asserts condition {
  if (!condition) {
    throw new Error(typeof message === "function" ? message() : message);
  }
}

// This is just for the nicety of having the same symbol for the type and the namespace that holds the functions that operate on said type
// I likely would't do this in prod since it's not tree-shaking friendly and I it may not be as familiar to some developers.
export type Line = string & { readonly _: unique symbol };
export namespace Line {
  // Brand a string to separete lines of text (i.e. a non-blank string ending or beginning with a newline) from normal string
  export function make(value: string): Line {
    return value as Line;
  }
}

export function readLines(file: string) {
  return readline.createInterface(fs.createReadStream(file)) as AsyncIterable<Line>
}

export function createLineStream(file: string) {
    return readline.createInterface(fs.createReadStream(file))
}

export function byteLength(string: string): number {
  return new TextEncoder().encode(string).byteLength;
}

export function formatElapsedTime(elapsedTime: number) {
  if (elapsedTime < 1000) {
    return `${elapsedTime} milliseconds`;
  }
  if (elapsedTime < 1000 * 60) {
    return `${elapsedTime / 1000} seconds`;
  }
  return `${elapsedTime / 1000 / 60} minutes`;
}
