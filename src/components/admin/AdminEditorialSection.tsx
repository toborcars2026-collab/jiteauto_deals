import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import { EditorialCategory, EditorialPost } from '../../types';
import {
  getEditorialPosts,
  fetchEditorialPosts,
  saveEditorialPostsToFirestore,
  DEFAULT_EDITORIAL_POSTS,
} from '../../utils';

const CATEGORIES: EditorialCategory[] = [
  'Inspection Guide',
  'Buyer Strategy',
  'Vehicle Walkaround',
  'Market Brief',
];

export default function AdminEditorialSection() {
  const [posts, setPosts] = useState<EditorialPost[]>(() => getEditorialPosts());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchEditorialPosts().then((loaded) => {
      if (loaded && loaded.length > 0) {
        setPosts(loaded);
      }
    });
  }, []);

  const handleFieldChange = (id: string, field: keyof EditorialPost, value: any) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === id ? { ...post, [field]: value } : post))
    );
    if (saveSuccess) setSaveSuccess(false);
    if (saveError) setSaveError(null);
  };

  const handleAddPost = () => {
    const newPost: EditorialPost = {
      id: `guide-${Date.now()}`,
      title: 'New Buyer Insight or Vehicle Walkaround',
      category: 'Buyer Strategy',
      summary: 'Concise summary of the insight or inspection finding for Nigerian vehicle buyers.',
      body: 'Write the full practical breakdown, walkaround notes, or inspection advice here.',
      readTime: '3 min guide',
      imageUrl: '',
      videoUrl: '',
      publishedAt: new Date().toISOString().split('T')[0],
      isPublished: true,
      featuredOrder: posts.length + 1,
    };
    setPosts((prev) => [newPost, ...prev]);
    setSaveSuccess(false);
  };

  const handleDeletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setSaveSuccess(false);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= posts.length) return;
    setPosts((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((item, idx) => ({ ...item, featuredOrder: idx + 1 }));
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const saved = await saveEditorialPostsToFirestore(posts);
      setPosts(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save editorial insights to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setPosts(DEFAULT_EDITORIAL_POSTS);
    setSaveSuccess(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            <BookOpen className="text-amber-500" size={22} />
            <span>Automotive Insights & Editorial Guides</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Publish buyer education guides, inspection checklists, comparisons, and walkaround videos displayed on the homepage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleAddPost}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Insight</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
          <span>Editorial content saved to Firestore and live on your website.</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={17} className="text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post, index) => (
          <div
            key={post.id}
            className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleFieldChange(post.id, 'isPublished', !post.isPublished)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    post.isPublished
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {post.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{post.isPublished ? 'Published' : 'Draft Hidden'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMove(index, -1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                  aria-label="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={index === posts.length - 1}
                  onClick={() => handleMove(index, 1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                  aria-label="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePost(post.id)}
                  className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                  aria-label="Delete guide"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Headline / Title
                </label>
                <input
                  type="text"
                  value={post.title}
                  onChange={(e) => handleFieldChange(post.id, 'title', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Category
                </label>
                <select
                  value={post.category}
                  onChange={(e) => handleFieldChange(post.id, 'category', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Read / Watch Length
                </label>
                <input
                  type="text"
                  value={post.readTime}
                  onChange={(e) => handleFieldChange(post.id, 'readTime', e.target.value)}
                  placeholder="e.g. 4 min guide"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Cover Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={post.imageUrl || ''}
                  onChange={(e) => handleFieldChange(post.id, 'imageUrl', e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Walkaround Video URL (Optional)
                </label>
                <input
                  type="url"
                  value={post.videoUrl || ''}
                  onChange={(e) => handleFieldChange(post.id, 'videoUrl', e.target.value)}
                  placeholder="https://youtube.com/... or https://instagram.com/..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Card Summary
              </label>
              <input
                type="text"
                value={post.summary}
                onChange={(e) => handleFieldChange(post.id, 'summary', e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Full Article Body
              </label>
              <textarea
                rows={4}
                value={post.body}
                onChange={(e) => handleFieldChange(post.id, 'body', e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 leading-relaxed"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer transition-all"
        >
          {isSaving ? (
            <RefreshCw size={16} className="animate-spin text-amber-400" />
          ) : (
            <Save size={16} className="text-amber-400" />
          )}
          <span>{isSaving ? 'Publishing...' : 'Save Editorial Content to Firestore'}</span>
        </button>
      </div>
    </div>
  );
}
