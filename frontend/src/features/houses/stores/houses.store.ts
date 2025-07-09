import { writable } from 'svelte/store';
import type { House } from '../../../shared/types/house.types';

interface HousesState {
  houses: House[];
  loading: boolean;
  error: string | null;
  filters: any;
  search: string;
}

const initialState: HousesState = {
  houses: [],
  loading: false,
  error: null,
  filters: {},
  search: '',
};

export const housesStore = writable<HousesState>(initialState); 