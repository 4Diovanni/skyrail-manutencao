/** Comprime a foto no aparelho para caber no plano gratuito (~200 KB, lado maior até 1280 px). */
export async function comprimirFoto(file: Blob, ladoMax = 1280, alvoBytes = 220_000): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  let q = 0.8
  let blob: Blob | null = null
  while (q >= 0.4) {
    blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', q))
    if (blob && blob.size <= alvoBytes) break
    q -= 0.1
  }
  if (!blob) throw new Error('Não foi possível processar a foto.')
  return blob
}
