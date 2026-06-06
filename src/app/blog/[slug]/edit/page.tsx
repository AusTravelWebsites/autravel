import type { Metadata } from 'next';
import { BlogEditor } from '@/components/features/BlogEditor';

export const metadata: Metadata = {
  title: 'Edit blog post',
  robots: { index: false, follow: false },
};

export default async function EditBlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogEditor slug={slug} />;
}
