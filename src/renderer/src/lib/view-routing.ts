export type RendererView = 'main' | 'quick-add'

export function rendererView(search: string): RendererView {
  return new URLSearchParams(search).get('view') === 'quick-add'
    ? 'quick-add'
    : 'main'
}
