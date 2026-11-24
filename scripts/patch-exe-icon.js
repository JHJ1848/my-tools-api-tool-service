import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as ResEdit from 'resedit'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function patchExeIcon() {
  const exePath = path.resolve(__dirname, '../dist-app/win-unpacked/MDPreviewTool.exe')
  const icoPath = path.resolve(__dirname, '../resources/icon.ico')

  console.log(`[PatchExeIcon] Reading exe from: ${exePath}`)
  const exeBuffer = fs.readFileSync(exePath)
  const exe = ResEdit.NtExecutable.from(exeBuffer)
  const res = ResEdit.NtExecutableResource.from(exe)

  console.log(`[PatchExeIcon] Reading ico from: ${icoPath}`)
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))

  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    1, // Icon Group ID
    1033, // Language (en-US / Neutral)
    iconFile.icons.map((item) => item.data)
  )

  res.outputResource(exe)
  const patchedExeBuffer = Buffer.from(exe.generate())
  fs.writeFileSync(exePath, patchedExeBuffer)
  console.log(`[PatchExeIcon] Successfully updated embedded Windows PE Icon in: ${exePath}`)
}

patchExeIcon().catch((err) => {
  console.error('[PatchExeIcon] Error:', err)
  process.exitCode = 1
})
