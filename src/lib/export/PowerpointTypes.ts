export interface PowerPointWriteOptions {
  fileName: string
  compression?: boolean
  insertAfterSlide?: number
  targetFile?: File
  targetFileHandle?: PowerPointFileHandle
  writeMode?: 'copy' | 'overwrite'
}

export interface PowerPointFileHandle {
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{
    write: (data: Blob | Uint8Array) => Promise<void>
    close: () => Promise<void>
  }>
}
