"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ManagerNavbar from "@/components/manager/ManagerNavbar";
import {
  Shield, LogOut, Pencil, Check, X, Camera, Loader2,
  Search, UserCheck, UserCog,
} from "lucide-react";
import Link from "next/link";

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
};

type SearchResult = {
  id: string;
  email: string;
  username: string | null;
  role: string;
};

export default function ManagerAccountPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Username edit state
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role management state
  const [emailQuery, setEmailQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) { router.replace("/"); return; }

        const user = authData.user;
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("username, avatar_url, role")
          .eq("id", user.id)
          .single();

        if (profileError) console.error(profileError);
        if (profileData?.role !== "manager") { router.replace("/"); return; }

        if (!cancelled) {
          const p: Profile = {
            id: user.id,
            email: user.email ?? null,
            username: profileData?.username ?? null,
            avatar_url: profileData?.avatar_url ?? null,
            role: profileData?.role ?? "manager",
          };
          setProfile(p);
          setUsernameInput(p.username ?? "");
        }
      } catch (err) {
        console.error("Failed to load manager profile:", err);
        if (!cancelled) router.replace("/");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [router]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Username 
  const startEditingUsername = () => {
    setUsernameInput(profile?.username ?? "");
    setUsernameError(null);
    setUsernameSuccess(false);
    setEditingUsername(true);
  };

  const cancelEditingUsername = () => {
    setEditingUsername(false);
    setUsernameError(null);
  };

  const saveUsername = async () => {
    if (!profile) return;
    const trimmed = usernameInput.trim();
    if (!trimmed) { setUsernameError("Username cannot be empty."); return; }
    if (trimmed === profile.username) { setEditingUsername(false); return; }

    setUsernameLoading(true);
    setUsernameError(null);

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    setUsernameLoading(false);

    if (error) {
      setUsernameError(error.message ?? "Failed to save username.");
    } else {
      setProfile((p) => p ? { ...p, username: trimmed } : p);
      setEditingUsername(false);
      setUsernameSuccess(true);
      setTimeout(() => setUsernameSuccess(false), 3000);
    }
  };

  // Avatar 
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) { setAvatarError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Image must be under 5 MB."); return; }

    setAvatarUploading(true);
    setAvatarError(null);

    const ext = file.name.split(".").pop();
    const filePath = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setAvatarError(uploadError.message ?? "Upload failed.");
      setAvatarUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      setAvatarError("Could not retrieve image URL.");
      setAvatarUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    setAvatarUploading(false);

    if (updateError) {
      setAvatarError(updateError.message ?? "Failed to save avatar.");
    } else {
      setProfile((p) => p ? { ...p, avatar_url: publicUrl } : p);
    }

    e.target.value = "";
  };

  //Role management 
  const handleEmailSearch = (value: string) => {
    setEmailQuery(value);
    setSelectedUser(null);
    setRoleSuccess(null);
    setRoleError(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data, error } = await supabase.rpc("search_profiles_by_email", {
          search_email: value.trim(),
        });
        if (error) throw error;
        setSearchResults((data as SearchResult[]) ?? []);
        setShowDropdown(true);
      } catch (err: any) {
        console.error(err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
  };

  const handleSelectUser = (user: SearchResult) => {
    setSelectedUser(user);
    setEmailQuery(user.email);
    setShowDropdown(false);
    setRoleSuccess(null);
    setRoleError(null);
  };

  const handleRoleUpdate = async (newRole: "user" | "manager") => {
    if (!selectedUser) return;
    setRoleUpdating(true);
    setRoleSuccess(null);
    setRoleError(null);

    try {
      const { error } = await supabase.rpc("set_user_role", {
        target_user_id: selectedUser.id,
        new_role: newRole,
      });
      if (error) throw error;

      const label = newRole === "manager" ? "Manager" : "User";
      setRoleSuccess(`${selectedUser.email} is now a ${label}.`);
      setSelectedUser((u) => u ? { ...u, role: newRole } : u);
      setSearchResults((prev) =>
        prev.map((r) => r.id === selectedUser.id ? { ...r, role: newRole } : r)
      );
    } catch (err: any) {
      setRoleError(err?.message ?? "Failed to update role.");
    } finally {
      setRoleUpdating(false);
    }
  };

  const clearRoleSearch = () => {
    setEmailQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    setShowDropdown(false);
    setRoleSuccess(null);
    setRoleError(null);
  };

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  // Render 
  if (loading) {
    return (
      <>
        <ManagerNavbar />
        <main className="min-h-screen bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 flex items-center justify-center">
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">Loading account…</p>
        </main>
      </>
    );
  }

  if (!profile) return null;

  const initials = (profile.username ?? profile.email ?? "M")[0].toUpperCase();

  return (
    <>
      <ManagerNavbar />
      <main className="min-h-screen animate-fade-slide-up delay-200 pt-10 bg-gradient-to-b from-amber-100 via-emerald-100 to-amber-100 dark:from-zinc-950 dark:via-emerald-800 dark:to-zinc-950 text-zinc-900 dark:text-violet-50 p-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">

          {/* ── Main profile card ── */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/30">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-8 w-8 text-emerald-600" />
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Manager Account</h1>
            </div>

            <p className="mb-8 text-zinc-600 dark:text-zinc-300">
              Manage your profile information and account settings.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Account Details */}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Account Details</h2>
                <div className="space-y-5">
                  {/* Username */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">Username</span>
                    {editingUsername ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveUsername();
                            if (e.key === "Escape") cancelEditingUsername();
                          }}
                          className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                          disabled={usernameLoading}
                        />
                        <button onClick={saveUsername} disabled={usernameLoading} className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50" title="Save">
                          {usernameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={cancelEditingUsername} disabled={usernameLoading} className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 transition-colors" title="Cancel">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                          {profile.username || <span className="text-zinc-400 italic text-base">No username set</span>}
                        </span>
                        <button onClick={startEditingUsername} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-emerald-600 transition-colors" title="Edit username">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {usernameSuccess && <span className="text-xs text-emerald-500 font-medium">Saved!</span>}
                      </div>
                    )}
                    {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">Email</span>
                    <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{profile.email}</span>
                  </div>

                  {/* Role badge */}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">Role</span>
                    <span className="inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs border border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/20 font-medium">
                      <Shield className="h-3 w-3" /> Manager
                    </span>
                  </div>
                </div>
              </section>

              {/* Profile Picture  */}
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700/50 bg-white/60 dark:bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Profile Picture</h2>
                <div className="text-center mb-6">
                  <div className="relative inline-block mb-3">
                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-2xl font-bold text-white">
                      {profile.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                    <button onClick={handleAvatarClick} disabled={avatarUploading} className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors disabled:opacity-60" title="Change profile picture">
                      {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <button onClick={handleAvatarClick} disabled={avatarUploading} className="text-sm text-emerald-600 hover:text-emerald-500 font-medium transition-colors disabled:opacity-50">
                    {avatarUploading ? "Uploading…" : "Upload new photo"}
                  </button>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">JPG, PNG, GIF — max 5 MB</p>
                  {avatarError && <p className="text-xs text-red-500 mt-2">{avatarError}</p>}
                </div>
                <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/30 transition-all">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </section>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/manager/dashboard" className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all">
                Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Role Management card  */}
          <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/30">
            <div className="flex items-center gap-3 mb-2">
              <UserCog className="h-7 w-7 text-emerald-600" />
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Role Management</h2>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
              Search for a user by email address to promote or demote their role.
            </p>

            {/* Search */}
            <div className="relative" ref={searchRef}>
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by email address…"
                  value={emailQuery}
                  onChange={(e) => handleEmailSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-shadow"
                />
                <div className="absolute right-3 flex items-center gap-1">
                  {searchLoading && <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />}
                  {emailQuery && !searchLoading && (
                    <button onClick={clearRoleSearch} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg shadow-black/10 dark:shadow-black/30 overflow-hidden">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors text-left border-b border-zinc-100 dark:border-zinc-700/50 last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.email}</span>
                        {user.username && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">@{user.username}</span>
                        )}
                      </div>
                      <RoleBadge role={user.role} />
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {showDropdown && !searchLoading && emailQuery.trim() && searchResults.length === 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg px-4 py-3">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No users found matching that email.</p>
                </div>
              )}
            </div>

            {/* Selected user panel */}
            {selectedUser && (
              <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-zinc-50/60 dark:bg-zinc-900/30 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5 uppercase tracking-wide font-medium">Selected user</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedUser.email}</p>
                    {selectedUser.username && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">@{selectedUser.username}</p>
                    )}
                    <div className="mt-2">
                      <RoleBadge role={selectedUser.role} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[160px]">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wide">Change role to</p>
                    <button
                      onClick={() => handleRoleUpdate("manager")}
                      disabled={roleUpdating || selectedUser.role === "manager"}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      {roleUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                      Make Manager
                    </button>
                    <button
                      onClick={() => handleRoleUpdate("user")}
                      disabled={roleUpdating || selectedUser.role === "user"}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {roleUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                      Set as User
                    </button>
                  </div>
                </div>

                {roleSuccess && (
                  <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">✓ {roleSuccess}</p>
                )}
                {roleError && (
                  <p className="mt-3 text-sm text-red-500">{roleError}</p>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isManager = role === "manager";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      isManager
        ? "border-emerald-300/80 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/20"
        : "border-zinc-300/80 dark:border-zinc-600/40 text-zinc-600 dark:text-zinc-400 bg-zinc-50/60 dark:bg-zinc-800/40"
    }`}>
      {isManager ? <Shield className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
      {isManager ? "Manager" : "User"}
    </span>
  );
}