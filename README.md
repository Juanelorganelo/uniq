# Uniq
This is a fully-fleged version of an interview exercise I made for Vanta.
The exercise consist of recreating the default functionality of the Linux command `uniq`, with the caveat that this utility should work even on unsorted files.

This was done with the interview requirements:
- No external libs
- No LLMs

I've also added some fairly large files to test performance on both algorithms

## Running
For the brute force version `pnpm run:naive` and for the external sorting version do `pnpm run:external-sort`

## Algorithms
- Brute force
- External sort (originally with Lose Tree but changed to use a min heap)
  Key is to dump chunks into separate files so we can load them concurrently and merge them with k-ways (previous version couldn't handle that since you need to keep the file sorted which is more difficult for a single file since you have to compare what you're adding with what's already stored) this is IMO the differentiator.

  The use of a MinHeap for sorting is clever, though any data structures with a similar invariant would do (such as a Loser Tree)
> NOTE: The MinHeap is unoptimized. Still the algorithm is muuuuuuuch faster

## References
- https://opendsa-server.cs.vt.edu/ODSA/Books/CS3/html/ExternalSort.html
- https://www.youtube.com/watch?v=97kdv5rGa8U&t=589s
- https://en.wikipedia.org/wiki/External_sorting
