import React, { useMemo, useState } from 'react';
import { Play, BookOpen, X, ArrowRight, ExternalLink } from 'lucide-react';
import { EditorialCategory, EditorialPost } from '../types';
import { FALLBACK_VEHICLE_IMAGE } from '../assets/visuals';
import Reveal from './Reveal';

interface EditorialContentSectionProps {
  posts: EditorialPost[];
  onTalkToConsultant: () => void;
}

const CATEGORIES: ('All' | EditorialCategory)[] = [
  'All',
  'Inspection Guide',
  'Buyer Strategy',
  'Vehicle Walkaround',
  'Market Brief',
];

export default function EditorialContentSection({
  posts,
  onTalkToConsultant,
}: EditorialContentSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | EditorialCategory>('All');
  const [activePost, setActivePost] = useState<EditorialPost | null>(null);

  const visiblePosts = useMemo(() => {
    const published = posts
      .filter((p) => p.isPublished !== false)
      .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99));

    if (selectedCategory === 'All') return published;
    return published.filter((p) => p.category === selectedCategory);
  }, [posts, selectedCategory]);

  if (posts.filter((p) => p.isPublished !== false).length === 0) {
    return null;
  }

  return (
    <section
      id="editorial_content_section"
      className="py-16 sm:py-22 bg-white text-slate-950 border-b border-slate-200"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header & Interactive Filter Controls */}
        <Reveal>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-slate-200">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-amber-700">
                Automotive Insights & Walkarounds
              </p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
                Buyer Intelligence & Field Guides
              </h2>
              <p className="text-slate-600 text-sm sm:text-base font-light">
                Practical inspection protocols, ownership cost breakdowns, and curated vehicle advisories prepared for serious buyers in Nigeria.
              </p>
            </div>

            {/* Interactive Segmented Filter Tabs */}
            <div
              className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit"
              role="tablist"
              aria-label="Filter automotive articles by category"
            >
              {CATEGORIES.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Editorial Grid */}
        {visiblePosts.length === 0 ? (
          <div className="mt-10 p-10 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              No insights currently listed under <strong className="text-slate-900">{selectedCategory}</strong>. Select another category above.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {visiblePosts.map((post, idx) => (
              <Reveal key={post.id} delay={Math.min(idx * 0.06, 0.2)}>
                <article
                  onClick={() => setActivePost(post)}
                  className="h-full flex flex-col justify-between bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200 hover:border-amber-400 transition-all duration-200 overflow-hidden cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div>
                    {/* Visual Header */}
                    <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                      <img
                        src={post.imageUrl || FALLBACK_VEHICLE_IMAGE}
                        alt={post.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = FALLBACK_VEHICLE_IMAGE;
                        }}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />
                      {post.videoUrl && (
                        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/85 text-amber-300 text-[11px] font-mono font-semibold border border-white/10">
                          <Play size={11} />
                          <span>Video Available</span>
                        </span>
                      )}
                    </div>

                    {/* Clean Unboxed Metadata + Copy */}
                    <div className="p-6 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                        <span className="text-amber-700 font-semibold">{post.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{post.readTime}</span>
                      </div>

                      <h3 className="font-display text-lg font-bold text-slate-950 leading-snug group-hover:text-amber-700 transition-colors">
                        {post.title}
                      </h3>

                      <p className="text-slate-600 text-xs sm:text-sm font-light leading-relaxed line-clamp-3">
                        {post.summary}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 pb-5 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-900 group-hover:text-amber-700">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen size={14} className="text-amber-600" />
                      <span>Read Full Guide</span>
                    </span>
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {/* Article Reader Modal */}
      {activePost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editorial-modal-title"
          onClick={() => setActivePost(null)}
        >
          <div
            className="bg-white text-slate-950 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
              <img
                src={activePost.imageUrl || FALLBACK_VEHICLE_IMAGE}
                alt={activePost.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_VEHICLE_IMAGE;
                }}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setActivePost(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close article"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <span className="text-amber-700 font-semibold">{activePost.category}</span>
                <span aria-hidden="true">·</span>
                <span>{activePost.readTime}</span>
                {activePost.publishedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{activePost.publishedAt}</span>
                  </>
                )}
              </div>

              <h3
                id="editorial-modal-title"
                className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950 leading-tight"
              >
                {activePost.title}
              </h3>

              <div className="space-y-4 text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                {activePost.body}
              </div>

              {activePost.videoUrl && (
                <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-800">
                    Walkaround or video commentary attached for this guide.
                  </span>
                  <a
                    href={activePost.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-950 text-white text-xs font-bold hover:bg-amber-500 hover:text-slate-950 transition-colors shrink-0"
                  >
                    <Play size={13} />
                    <span>Watch Video</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Need specific guidance on a car you found?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActivePost(null);
                    onTalkToConsultant();
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer"
                >
                  <span>Talk to a Consultant</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
