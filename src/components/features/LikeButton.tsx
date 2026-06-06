'use client';
import { useState } from 'react';

interface Props {
  entryId: string;
  initialCount: number;
  initialLiked?: boolean;
}

export default function LikeButton({ entryId, initialCount, initialLiked = false }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    setLiked(l => !l);
    setCount(c => liked ? c - 1 : c + 1);
    try {
      const res = await fetch('/api/journal-entries/' + entryId + '/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) {
        const d = await res.json();
        setLiked(d.liked);
        setCount(d.count);
      } else if (res.status === 401) {
        setLiked(liked);
        setCount(initialCount);
        window.location.href = '/login';
      }
    } catch {
      setLiked(liked);
      setCount(initialCount);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={toggle} disabled={loading}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 5, padding: '4px 8px', borderRadius: 6,
        color: liked ? '#f43f5e' : '#4a6585', fontSize: 13, fontWeight: 500,
        transition: 'color 0.15s', opacity: loading ? 0.7 : 1 }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{liked ? '' : ''}</span>
      <span>{count}</span>
    </button>
  );
}
