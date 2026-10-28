import type { PostDTO } from '../../../shared/types';

export function PostThumb({ post }: { post: Pick<PostDTO, 'media_url' | 'image_source'> }) {
  if (post.media_url) return <img src={post.media_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />;
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orbit-primary/10 text-[10px] font-bold uppercase text-orbit-primary">
      {post.image_source === 'auto' ? 'Auto' : 'Text'}
    </div>
  );
}
