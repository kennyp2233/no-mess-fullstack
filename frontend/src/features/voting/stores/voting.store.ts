import { writable } from 'svelte/store';
import type { Voting } from '../../../shared/types/voting.types';

interface VotingState {
  votings: Voting[];
  currentVoting: Voting | null;
  loading: boolean;
  error: string | null;
  results: any;
  quorum: number;
}

const initialState: VotingState = {
  votings: [],
  currentVoting: null,
  loading: false,
  error: null,
  results: null,
  quorum: 0,
};

export const votingStore = writable<VotingState>(initialState); 