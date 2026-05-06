"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ManagerNavbar from "@/components/manager/ManagerNavbar";

type Inquiry = {
  id: number;
  user_id: string;
  sender_email: string;
  sender_username: string | null;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const PAGE_SIZE = 10;

function senderLabel(inquiry: Inquiry) {
  return inquiry.sender_username ?? inquiry.sender_email;
}

export default function ManagerInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openInquiry, setOpenInquiry] = useState<Inquiry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

  async function loadInquiries() {
    try {
      setLoading(true);
      setError("");
      const { data, error: fetchError } = await supabase
        .from("contact_inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw new Error(fetchError.message);
      setInquiries(data ?? []);
      setPage(1);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInquiries(); }, []);

  const totalPages = Math.max(1, Math.ceil(inquiries.length / PAGE_SIZE));
  const pagedInquiries = inquiries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const pageIds = pagedInquiries.map((i) => i.id);
    const allPageSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function openModal(inquiry: Inquiry) {
    setOpenInquiry(inquiry);
    if (!inquiry.is_read) {
      await supabase
        .from("contact_inquiries")
        .update({ is_read: true })
        .eq("id", inquiry.id);
      setInquiries((prev) =>
        prev.map((i) => (i.id === inquiry.id ? { ...i, is_read: true } : i))
      );
    }
  }

  function clampPage(remaining: number, currentPage: number) {
    const newTotal = Math.max(1, Math.ceil(remaining / PAGE_SIZE));
    setPage((p) => Math.min(p, newTotal));
  }

  async function deleteSelected() {
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      const { error: delError } = await supabase
        .from("contact_inquiries")
        .delete()
        .in("id", ids);
      if (delError) throw new Error(delError.message);
      setInquiries((prev) => {
        const next = prev.filter((i) => !selected.has(i.id));
        clampPage(next.length, page);
        return next;
      });
      setSelected(new Set());
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete inquiries");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSingle(id: number) {
    try {
      const { error: delError } = await supabase
        .from("contact_inquiries")
        .delete()
        .eq("id", id);
      if (delError) throw new Error(delError.message);
      setInquiries((prev) => {
        const next = prev.filter((i) => i.id !== id);
        clampPage(next.length, page);
        return next;
      });
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setOpenInquiry(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete inquiry");
    }
  }

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 p-6">
        <div className="mx-auto w-full max-w-4xl">
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/10 dark:shadow-black/30">

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Inquiries
                </h1>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                  Customer messages and support requests
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selected.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    disabled={deleting}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium text-sm disabled:opacity-50 transition-colors"
                  >
                    {deleting ? "Deleting..." : `Delete selected (${selected.size})`}
                  </button>
                )}
                <button
                  onClick={loadInquiries}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-white/60 dark:hover:bg-zinc-900/30 transition-colors text-sm"
                >
                  Refresh
                </button>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

            {/* Inquiry list */}
            <div className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden">
              {/* List header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50/60 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-700/50">
                <input
                  type="checkbox"
                  checked={pagedInquiries.length > 0 && pagedInquiries.every((i) => selected.has(i.id))}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">
                  {inquiries.length} {inquiries.length === 1 ? "message" : "messages"}
                </span>
              </div>

              {loading && (
                <div className="px-4 py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                  Loading inquiries…
                </div>
              )}

              {!loading && inquiries.length === 0 && (
                <div className="px-4 py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                  No inquiries yet.
                </div>
              )}

              {!loading && pagedInquiries.map((inquiry, idx) => (
                <div
                  key={inquiry.id}
                  onClick={() => openModal(inquiry)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30 ${
                    idx !== 0 ? "border-t border-zinc-200 dark:border-zinc-700/50" : ""
                  } ${inquiry.is_read ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(inquiry.id)}
                    onChange={() => toggleSelect(inquiry.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded accent-emerald-600 flex-shrink-0"
                  />
                  <span className={`w-36 flex-shrink-0 text-sm truncate text-zinc-700 dark:text-zinc-200 ${!inquiry.is_read ? "font-semibold" : "font-normal"}`}>
                    {senderLabel(inquiry)}
                  </span>
                  <span className={`flex-1 text-sm truncate text-zinc-900 dark:text-zinc-100 ${!inquiry.is_read ? "font-semibold" : "font-normal"}`}>
                    {inquiry.subject}
                  </span>
                  <span className="flex-shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(inquiry.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>

            {!loading && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {inquiries.filter((i) => !i.is_read).length} unread of {inquiries.length} total
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-100/60 dark:hover:bg-zinc-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-100/60 dark:hover:bg-zinc-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {openInquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setOpenInquiry(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-6 border border-zinc-200 dark:border-zinc-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 break-words">
              {openInquiry.subject}
            </h2>

            <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
              <p>
                <span className="font-medium">From:</span>{" "}
                {openInquiry.sender_username
                  ? `${openInquiry.sender_username} <${openInquiry.sender_email}>`
                  : openInquiry.sender_email}
              </p>
              <p>
                <span className="font-medium">Sent:</span>{" "}
                {new Date(openInquiry.created_at).toLocaleString()}
              </p>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-700/50 text-sm text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words min-h-[80px]">
              {openInquiry.message}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setOpenInquiry(null)}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/30 text-sm font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => deleteSingle(openInquiry.id)}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
