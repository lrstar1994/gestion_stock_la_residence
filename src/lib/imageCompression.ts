const MAX_IMAGE_SIZE = 1600
const JPEG_QUALITY = 0.72

export async function compressReceiptFile(file: File) {
  if (!file.type.startsWith('image/')) {
    return file
  }

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(image, 0, 0, width, height)
  const blob = await canvasToBlob(canvas)
  URL.revokeObjectURL(image.src)

  if (!blob || blob.size >= file.size) {
    return file
  }

  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = URL.createObjectURL(file)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
}
