import type { CategoryKind } from './categories'

export type TransactionKind = CategoryKind

export interface Payee {
  id: string
  name: string
  createdAt: string
}

export interface TransactionLine {
  id: string
  amountMinor: number
  categoryId: string | null
}

export interface Transaction {
  id: string
  accountId: string
  kind: TransactionKind
  date: string
  totalMinor: number
  payeeId: string | null
  payeeName: string | null
  note: string
  createdAt: string
  updatedAt: string
  line: TransactionLine
}

export interface CreateTransactionInput {
  accountId: string
  kind: TransactionKind
  date: string
  totalMinor: number
  payeeName: string | null
  categoryId: string | null
  note: string
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string
}

export interface TransactionIdInput {
  id: string
}
