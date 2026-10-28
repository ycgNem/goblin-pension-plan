import type { ItemId } from '../data/items';

/** One line per material the Rat Union kept. */
export interface Fee {
  item: ItemId;
  name: string;
  qty: number;
}

export interface Receipt {
  title: string;
  lines: string[];
  fee: readonly Fee[];
}

/** The Rat Union's receipt, shown when you wake up at home after a defeat. */
export function retrievalReceipt(fee: readonly Fee[]): Receipt {
  const lines = ['Recovered: one (1) goblin, unconscious.', 'Fee: half of common materials carried.'];
  if (fee.length === 0) lines.push('Fee: nothing worth halving. The union is disappointed.');
  lines.push('"Pleasure doing business."');
  return { title: 'RETRIEVAL RECEIPT, LOCAL 12', lines, fee };
}
