import { app, nativeImage } from 'electron'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const logoPath = fileURLToPath(new URL('../resources/icon.png', import.meta.url))
const iconPath = fileURLToPath(new URL('../resources/icon.ico', import.meta.url))
const installerDir = new URL('./installer/', import.meta.url)

function makeIcon(logo) {
  const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]
  const images = sizes.map(size => logo.resize({ width: size, height: size, quality: 'best' }).toPNG())
  const fileHeader = Buffer.alloc(6 + 16 * images.length)
  fileHeader.writeUInt16LE(1, 2)
  fileHeader.writeUInt16LE(images.length, 4)
  let offset = fileHeader.length

  images.forEach((image, index) => {
    const entry = 6 + 16 * index
    fileHeader[entry] = fileHeader[entry + 1] = sizes[index] % 256
    fileHeader.writeUInt16LE(1, entry + 4)
    fileHeader.writeUInt16LE(32, entry + 6)
    fileHeader.writeUInt32LE(image.length, entry + 8)
    fileHeader.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })

  return Buffer.concat([fileHeader, ...images])
}

function makeWixBitmap(logo, { width, height, size, left, top, sidebar = 0 }) {
  const pixels = logo.resize({ width: size, height: size, quality: 'best' }).toBitmap()
  const stride = Math.ceil(width * 3 / 4) * 4
  const bitmap = Buffer.alloc(54 + stride * height)
  bitmap.write('BM')
  bitmap.writeUInt32LE(bitmap.length, 2)
  bitmap.writeUInt32LE(54, 10)
  bitmap.writeUInt32LE(40, 14)
  bitmap.writeInt32LE(width, 18)
  bitmap.writeInt32LE(height, 22)
  bitmap.writeUInt16LE(1, 26)
  bitmap.writeUInt16LE(24, 28)
  bitmap.writeUInt32LE(stride * height, 34)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const target = 54 + (height - y - 1) * stride + x * 3
      const background = x < sidebar ? [246, 243, 241] : [255, 255, 255]
      if (x < left || x >= left + size || y < top || y >= top + size) {
        bitmap.set(background, target)
        continue
      }
      const source = ((y - top) * size + x - left) * 4
      // Electron returns premultiplied BGRA. Composite it onto the opaque installer surface.
      const remaining = 1 - pixels[source + 3] / 255
      for (let channel = 0; channel < 3; channel++) {
        bitmap[target + channel] = Math.min(255, Math.round(pixels[source + channel] + background[channel] * remaining))
      }
    }
  }
  return bitmap
}

app.whenReady().then(() => {
  const logo = nativeImage.createFromPath(logoPath)
  if (logo.isEmpty()) throw new Error('Unable to load resources/icon.png')

  fs.mkdirSync(installerDir, { recursive: true })
  fs.writeFileSync(iconPath, makeIcon(logo))
  fs.writeFileSync(new URL('msi-banner.bmp', installerDir), makeWixBitmap(logo, {
    width: 493, height: 58, size: 48, left: 437, top: 5
  }))
  fs.writeFileSync(new URL('msi-dialog.bmp', installerDir), makeWixBitmap(logo, {
    width: 493, height: 312, size: 96, left: 34, top: 108, sidebar: 164
  }))
  app.exit(0)
}).catch(error => {
  console.error(error)
  app.exit(1)
})
