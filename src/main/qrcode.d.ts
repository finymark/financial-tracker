declare module 'qrcode' {
  interface ToDataUrlOptions {
    type: 'image/png'
    errorCorrectionLevel: 'M'
    margin: number
    width: number
  }

  export function toDataURL(
    text: string,
    options: ToDataUrlOptions,
  ): Promise<string>
}
