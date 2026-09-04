import { app, BrowserWindow, nativeImage } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.whenReady().then(async () => {
  try {
    const svgPath = path.resolve(__dirname, '../resources/icon.svg')
    const outPngPath = path.resolve(__dirname, '../resources/icon.png')
    const outIcoPath = path.resolve(__dirname, '../resources/icon.ico')

    const svgContent = fs.readFileSync(svgPath, 'utf-8')
    const base64Svg = Buffer.from(svgContent).toString('base64')
    const dataUri = `data:image/svg+xml;base64,${base64Svg}`

    // Create hidden window to render ultra-sharp anti-aliased SVG at multiple resolutions
    const win = new BrowserWindow({
      width: 512,
      height: 512,
      show: false,
      transparent: true,
      webPreferences: {
        offscreen: true,
      },
    })

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: transparent; width: 512px; height: 512px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
          img { width: 512px; height: 512px; display: block; image-rendering: auto; }
        </style>
      </head>
      <body>
        <img src="${dataUri}" />
      </body>
      </html>
    `

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    // Wait for rendering
    await new Promise((resolve) => setTimeout(resolve, 600))

    const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
    const masterPngBuffer = image.toPNG()
    fs.writeFileSync(outPngPath, masterPngBuffer)
    console.log(`[Icon Generator] Master icon.png (512x512) written to: ${outPngPath}`)

    // Generate multi-size images for Windows ICO (covers 100%, 125%, 150%, 175%, 200% display scaling)
    const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
    const pngBuffers = []

    for (const size of sizes) {
      const resized = image.resize({ width: size, height: size, quality: 'best' })
      pngBuffers.push({
        size,
        buffer: resized.toPNG(),
      })
    }

    // Assemble Windows ICO format with multiple PNG frames
    // ICO Header: 2 bytes reserved (0), 2 bytes type (1 for ico), 2 bytes count
    const numImages = pngBuffers.length
    const headerSize = 6
    const dirEntrySize = 16
    let offset = headerSize + dirEntrySize * numImages

    const header = Buffer.alloc(6)
    header.writeUInt16LE(0, 0) // Reserved
    header.writeUInt16LE(1, 2) // Type 1 = ICO
    header.writeUInt16LE(numImages, 4) // Number of images

    const dirEntries = []
    const dataBlocks = []

    for (const item of pngBuffers) {
      const entry = Buffer.alloc(16)
      const w = item.size >= 256 ? 0 : item.size
      const h = item.size >= 256 ? 0 : item.size
      entry.writeUInt8(w, 0) // Width
      entry.writeUInt8(h, 1) // Height
      entry.writeUInt8(0, 2) // Color palette
      entry.writeUInt8(0, 3) // Reserved
      entry.writeUInt16LE(1, 4) // Color planes
      entry.writeUInt16LE(32, 6) // Bits per pixel
      entry.writeUInt32LE(item.buffer.length, 8) // Image size in bytes
      entry.writeUInt32LE(offset, 12) // File offset

      dirEntries.push(entry)
      dataBlocks.push(item.buffer)
      offset += item.buffer.length
    }

    const icoBuffer = Buffer.concat([header, ...dirEntries, ...dataBlocks])
    fs.writeFileSync(outIcoPath, icoBuffer)
    console.log(`[Icon Generator] Multi-resolution icon.ico (${sizes.join(', ')}) written to: ${outIcoPath}`)

    // Copy to dist-app as well if dist-app exists
    const distAppResources = path.resolve(__dirname, '../dist-app/resources')
    const distAppAppResources = path.resolve(__dirname, '../dist-app/resources/app/resources')
    if (fs.existsSync(distAppResources)) {
      fs.copyFileSync(outPngPath, path.join(distAppResources, 'icon.png'))
      fs.copyFileSync(outIcoPath, path.join(distAppResources, 'icon.ico'))
    }
    if (fs.existsSync(distAppAppResources)) {
      fs.copyFileSync(outPngPath, path.join(distAppAppResources, 'icon.png'))
      fs.copyFileSync(outIcoPath, path.join(distAppAppResources, 'icon.ico'))
    }

    console.log('[Icon Generator] All icons generated and synchronized successfully!')
    win.destroy()
    app.quit()
  } catch (err) {
    console.error('[Icon Generator] Error:', err)
    app.exit(1)
  }
})
