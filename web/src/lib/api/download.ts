import type { PowerPointDownload } from './templateApi'

export interface WritablePowerPointFileHandle {
  createWritable: () => Promise<{
    close: () => Promise<void>
    write: (data: Uint8Array) => Promise<void>
  }>
  getFile: () => Promise<File>
}

export function downloadPowerPoint({ bytes, fileName }: PowerPointDownload) {
  const blob = new Blob([Uint8Array.from(bytes).buffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.hidden = true
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function writePowerPoint(
  download: PowerPointDownload,
  handle: WritablePowerPointFileHandle,
) {
  const writable = await handle.createWritable()
  try {
    await writable.write(download.bytes)
  } finally {
    await writable.close()
  }
}
