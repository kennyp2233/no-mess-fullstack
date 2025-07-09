import { writable } from 'svelte/store';
import type { Transaction } from '../../../shared/types/transaction.types';

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  filters: any;
  search: string;
}

const initialState: TransactionsState = {
  transactions: [],
  loading: false,
  error: null,
  filters: {},
  search: '',
};

export const transactionsStore = writable<TransactionsState>(initialState); 