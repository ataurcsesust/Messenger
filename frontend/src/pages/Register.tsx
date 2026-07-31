import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, username, password, fullName);
      navigate("/");
    } catch (err: any) {
      const detail = err?.response?.data?.details;
      const msg = Array.isArray(detail) ? detail[0]?.msg : err?.response?.data?.message;
      setError(msg || "Could not create your account. Please check your details.");
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
          <h1 className="text-xl font-semibold text-base-900 dark:text-base-50">Create your account</h1>
          <p className="text-sm text-base-500 dark:text-base-400 mt-1">Takes less than a minute</p>
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
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
              placeholder="Alice Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Username</label>
            <input
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
              placeholder="alice"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-700 dark:text-base-300 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-base-300 dark:border-base-700 bg-white dark:bg-base-800 px-3 py-2 text-base-900 dark:text-base-50 focus:outline-none focus:ring-2 focus:ring-bubble-sent"
              placeholder="At least 8 characters, 1 letter + 1 number"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-bubble-sent dark:bg-bubble-sent-dark text-white font-medium py-2.5 flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-base-500 dark:text-base-400 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-bubble-sent dark:text-bubble-sent-dark font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
