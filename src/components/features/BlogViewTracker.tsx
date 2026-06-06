'use client';
import { useEffect } from 'react';

export function BlogViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `bb-blog-v-${slug}`;
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (sessionStorage.getItem(key) === today) return;
      sessionStorage.setItem(key, today);
    } catch {}
    fetch(`/api/blog/${slug}/view`, { method: 'POST', keepalive: true }).catch(() => {});
  }, [slug]);
  return null;
}
