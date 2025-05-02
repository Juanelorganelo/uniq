import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'
import { formatElapsedTime, Line, readLines, shortId } from './utils.js'

const makeStore = async (capacity: number) => {
    let buffer = new Set()
    const fileName = `${shortId()}.nlines.txt`

    if (!fs.existsSync(fileName)) {
        await fs.promises.writeFile(fileName, '')
    }

    // I haven't checked what this transpiles to
    // but depending on that I may use this in production
    return {
        [Symbol.dispose]() {
            if (fs.existsSync(fileName)) {
                fs.unlinkSync(fileName)
            }
        },
        async add(value: string) {
            buffer.add(value)
    
            if (buffer.size > capacity) {
                await this.flush()
            }
        },
        async has(value: string) {
            const rl = readline.createInterface(fs.createReadStream(fileName))
            return new Promise((resolve) => {
                rl.on('line', line => {
                    if (line === value) {
                        resolve(true)
                    }
                })
                rl.on('close', () => {
                    resolve(buffer.has(value))
                })
            })
        },
        async flush() {
            const lines = Array.from(buffer.values()).join('\n')
            await fs.promises.appendFile(fileName, `\n${lines}`)
            buffer = new Set()
        },
    }
}

async function* uniq(file: string, lineSet: Awaited<ReturnType<typeof makeStore>>): AsyncIterableIterator<Line> {
    for await (const line of readLines(file)) {
        const isDuped = await lineSet.has(line)
        if (!isDuped) yield line
        await lineSet.add(line)
    }
}

const main = async () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url))
    const testDir = path.join(dirname, 'test-files')
    const testFile = path.join(testDir, 'all-unique.csv')
    using lines = await makeStore(10)

    const start = performance.now()
    for await (const line of uniq(testFile, lines)) {
        console.log(line)
    }
    const end = performance.now()
    const elapsedTime = end - start


    console.log('Entire process took', formatElapsedTime(elapsedTime))
}
main();