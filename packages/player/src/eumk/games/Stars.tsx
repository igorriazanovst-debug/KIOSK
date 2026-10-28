import React from 'react';

export function starsForShare(share: number): 0 | 1 | 2 | 3 {
  if (share >= 0.9) return 3;
  if (share >= 0.7) return 2;
  if (share >= 0.4) return 1;
  return 0;
}

export default function Stars({ count }: { count: number }) {
  return <span className="eumk-stars" role="img" aria-label={`Звёзд: ${count} из 3`}>{'★'.repeat(count)}{'☆'.repeat(3 - count)}</span>;
}
