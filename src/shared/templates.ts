import type { TransactionKind } from './transactions'

export interface CreateTemplateInput {
  name: string
  kind?: TransactionKind | null
  accountId?: string | null
  totalMinor?: number | null
  payeeName?: string | null
  categoryId?: string | null
  tagNames?: string[]
  note?: string | null
}

export interface TransactionTemplate {
  id: string
  name: string
  kind: TransactionKind | null
  accountId: string | null
  totalMinor: number | null
  payeeName: string | null
  categoryId: string | null
  tagNames: string[]
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateTemplateInput extends CreateTemplateInput {
  id: string
}

export interface TemplateIdInput {
  id: string
}

export interface SaveTransactionAsTemplateInput {
  transactionId: string
  name: string
}
