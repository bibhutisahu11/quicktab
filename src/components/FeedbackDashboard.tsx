"use client";

import { useEffect, useState } from "react";

interface FeedbackItem {
  id: string;
  rating: number;
  experience: string | null;
  improvement: string | null;
  customerName: string | null;
  phone: string | null;
  orderId: string | null;
  createdAt: string;
}

interface FeedbackStats {
  feedbacks: FeedbackItem[];
  total: number;
  avgRating: number;
  dist: { rating: number; count: number }[];
}

const EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "😊", 5: "🤩" };
const LABELS: Record<number, string> = { 1: "Poor", 2: "Bad", 3: "Okay", 4: "Good", 5: "Excellent" };
const COLORS: Record<number, string> = {
  1: "text-red-500 bg-red-50 border-red-100",
  2: "text-orange-500 bg-orange-50 border-orange-100",
  3: "text-yellow-600 bg-yellow-50 border-yellow-100",
  4: "text-green-600 bg-green-50 border-green-100",
  5: "text-emerald-600 bg-emerald-50 border-emerald-100",
};

export default function FeedbackDashboard() {
  const [data, setData] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [minRating, setMinRating] = useState(1);

  async function load(rating = minRating) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/feedback?limit=100&minRating=${rating}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilter(r: number) {
    setMinRating(r);
    load(r);
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-4xl animate-pulse">💬</div>
      </div>
    );
  }

  const avg = data?.avgRating ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-black text-amber-600">{total}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Total Reviews</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-black text-amber-600">
            {avg > 0 ? avg.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Avg Rating</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-3xl">
            {avg >= 4.5 ? "🤩" : avg >= 3.5 ? "😊" : avg >= 2.5 ? "😐" : avg > 0 ? "😕" : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Overall Mood</p>
        </div>
      </div>

      {/* ── Rating distribution bar ── */}
      {data && total > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-700 text-sm mb-4">Rating Breakdown</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((r) => {
              const cnt = data.dist.find((d) => d.rating === r)?.count ?? 0;
              const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
              return (
                <div key={r} className="flex items-center gap-3">
                  <span className="text-lg w-6">{EMOJI[r]}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-8 text-right">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Filter:</span>
        {[1, 2, 3, 4, 5].map((r) => (
          <button key={r} onClick={() => handleFilter(r)}
            className={`text-sm px-3 py-1 rounded-full border font-semibold transition-all ${
              minRating === r
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
            }`}>
            {EMOJI[r]}+ {r}★
          </button>
        ))}
        {minRating > 1 && (
          <button onClick={() => handleFilter(1)} className="text-xs text-slate-400 underline ml-1">
            Clear
          </button>
        )}
      </div>

      {/* ── Feedback list ── */}
      {!data?.feedbacks.length ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">💬</div>
          <p className="font-semibold">No feedback yet</p>
          <p className="text-sm mt-1">Feedback appears here once customers submit it after their order is done.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.feedbacks.map((fb) => (
            <div key={fb.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${COLORS[fb.rating]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{EMOJI[fb.rating]}</span>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {fb.customerName ?? "Anonymous"}
                      {fb.phone && <span className="font-normal text-slate-500 text-xs ml-2">{fb.phone}</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(fb.createdAt).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {fb.orderId && (
                        <span className="ml-2 font-mono">#{fb.orderId.slice(-8).toUpperCase()}</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${COLORS[fb.rating]}`}>
                  {LABELS[fb.rating]}
                </span>
              </div>

              {fb.experience && (
                <div className="mt-3 bg-white/70 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">Experience</p>
                  <p className="text-sm text-slate-700">&ldquo;{fb.experience}&rdquo;</p>
                </div>
              )}
              {fb.improvement && (
                <div className="mt-2 bg-white/70 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">Suggested Improvement</p>
                  <p className="text-sm text-slate-700">&ldquo;{fb.improvement}&rdquo;</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
