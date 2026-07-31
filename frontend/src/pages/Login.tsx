import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Invalid email/username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-50 dark:bg-base-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-bubble-sent dark:bg-bubble-sent-dark flex items-center justify-center mb-3">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-base-900 dark:text-base-50">Welcome back</h1>
          <p className="text-sm text-base-500 dark:text-base-400 mt-1">Sign in to keep the conversation going</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/70 dark:bg-base-900/60 backdrop-blur-xl border border-base-200/60 dark:border-base-700/60 rounded-2xl p-6 shadow-sm space-y-4"
        >
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">
              Email or username
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-bubble-sent dark:bg-bubble-sent-dark text-white font-medium py-2.5 flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="text-center text-sm text-base-500 dark:text-base-400 mt-5">
          New here?{" "}
          <Link to="/register" className="text-bubble-sent dark:text-bubble-sent-dark font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
