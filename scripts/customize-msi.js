import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const assetDir = fileURLToPath(new URL('./installer/', import.meta.url))

function xmlAttribute(value) {
  return value.replace(/[&<"]/g, char => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;' })[char])
}

export default async function customizeMsi(projectFile) {
  const source = await fs.readFile(projectFile, 'utf8')
  const ui = '<UIRef Id="WixUI_InstallDir"/>'
  const programFiles = /<Directory Id="ProgramFiles(?:64)?Folder">/
  if (!source.includes(ui) || !programFiles.test(source)) {
    throw new Error('The electron-builder MSI template has changed')
  }

  const banner = xmlAttribute(path.join(assetDir, 'msi-banner.bmp'))
  const dialog = xmlAttribute(path.join(assetDir, 'msi-dialog.bmp'))
  const updated = source
    .replace(ui, [
      `<WixVariable Id="WixUIBannerBmp" Value="${banner}"/>`,
      `<WixVariable Id="WixUIDialogBmp" Value="${dialog}"/>`,
      '<Property Id="APPLICATIONFOLDER" Secure="yes"/>',
      '<SetDirectory Id="MDPREVIEWROOT" Value="[WindowsVolume]Apps\\" Sequence="both">NOT Installed AND NOT MDPREVIEWROOT</SetDirectory>',
      ui
    ].join('\n      '))
    .replace(programFiles, '<Directory Id="MDPREVIEWROOT" Name="Apps">')
  await fs.writeFile(projectFile, updated, 'utf8')
}
