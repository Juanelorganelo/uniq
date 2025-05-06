import { createMinHeap } from "./external-sort";

function compareNumber(a: number, b: number) {
  if (a < b) return -1;
  else if (a > b) return 1;
  else return 0;
};

/**
 * Min heap is not optimizaed but test is impl agnostic (as it should)
 * This guards against regressions when optimizing
 */
describe("createMinHeap", () => {
  test("constructs without errors", () => {
    expect(() => createMinHeap<number>(compareNumber)).not.toThrow();
  });

  test("always pops the minimum node", () => {
    const heap = createMinHeap<number>(compareNumber);

    const numbers = [3, 6, 1, -2, 0];
    for (const number of numbers) {
      heap.push(number);
    }

    expect(heap.pop()).toBe(-2);
    expect(heap.pop()).toBe(0);
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(6);
  });
});
