import { pipeline } from 'stream'
import findit from 'findit2'
import { spawn } from 'child_process'
import tmp from './tmp'

// returns a stream that extracts specific files to a temp folder
export default async (inStream, matcher) => {
  const tmpZip = tmp('.zip')
  const tmpFolder = tmp()

  await new Promise((resolve, reject) => {
    pipeline(
      inStream,
      tmpZip.write(),
      (err) => {
        if (err) return reject(err)
        resolve()
      })
  })
  await tmpFolder.mkdir()
  await new Promise((resolve, reject) => {
    const ps = spawn('unzip', [ '-d', tmpFolder.path, tmpZip.path ])
    ps.once('exit', (code) => {
      if (code >= 3) return reject(new Error(`Unzip error: Exit code ${code}`))
      resolve()
    })
  })
  await tmpZip.destroy()
  const files = await new Promise((resolve, reject) => {
    const matches = []
    const finder = findit(tmpFolder.path)
    finder.on('file', (f) => {
      if (f.match(/__MACOSX/)) return // mac meta files
      if (matcher(f)) matches.push(f)
    })
    finder.once('error', reject)
    finder.once('end', () => {
      resolve(matches)
    })
  })
  return {
    files,
    done: () => {
      tmpFolder.destroy().catch(() => null)
    }
  }
}