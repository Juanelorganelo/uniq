import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { EOL, tmpdir } from 'os'
import { Writable } from 'stream'
import { getScriptName, parseArgv } from './cli'
import { formatElapsedTime, Line, readLines, shortId } from './utils'

const makeStore = async (capacity: number) => {
    let buffer = new Set()
    const fileName = path.join(tmpdir(), `${shortId()}-store.txt`)

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

const main = async (argv: string[]) => {
    const { inputFile, outputFile } = parseArgv(argv, getScriptName(__filename))
    using lines = await makeStore(10)

    const output: Writable = outputFile ? fs.createWriteStream(outputFile) : process.stdout;

    const start = performance.now()
    for await (const line of uniq(inputFile, lines)) {
        output.write(line + EOL)
    }
    const end = performance.now()
    const elapsedTime = end - start
    console.log('Entire process took', formatElapsedTime(elapsedTime))
}
main(process.argv.slice(2));