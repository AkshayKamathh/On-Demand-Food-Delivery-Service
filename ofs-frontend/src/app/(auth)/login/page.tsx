import LoginForm from "@/components/auth/LoginForm";


export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
      <div className="bg-white/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm rounded-2xl px-8 py-10 w-full max-w-sm shadow-xl shadow-black/10 dark:shadow-black/30">
        <LoginForm />
      </div>
    </main>
  );
}