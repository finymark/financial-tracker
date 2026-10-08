export interface Payee {
  id: string
  name: string
  createdAt: string
}

export interface PayeeAlias {
  id: string
  payeeId: string
  name: string
  createdAt: string
}

export interface PayeeSuggestion extends Payee {
  usageCount: number
  lastUsedDate: string
}

export interface PayeeSuggestionInput {
  query: string
  limit?: number
}

export interface PayeeIdInput {
  id: string
}

export interface PayeeAliasIdInput {
  id: string
}

export interface PayeeAliasesInput {
  payeeId: string
}

export interface AddPayeeAliasInput extends PayeeAliasesInput {
  name: string
}

export interface MergePayeesInput {
  sourcePayeeId: string
  survivorPayeeId: string
}
