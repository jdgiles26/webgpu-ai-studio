import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative text-center max-w-md">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
            🎉
          </div>
          <h1 className="text-3xl font-bold text-green-400 mb-3">Registration Successful!</h1>
          <p className="text-dark-400 mb-2">
            Welcome to WebGPU AI Studio, <strong className="text-dark-200">{name}</strong>!
          </p>
          <div className="glass-panel p-6 my-6 text-left">
            <h3 className="font-semibold mb-3">📧 What happens next?</h3>
            <ol className="space-y-2 text-sm text-dark-400">
              <li className="flex gap-2">
                <span className="text-brand-400">1.</span>
                An email notification has been sent to the admin for review
              </li>
              <li className="flex gap-2">
                <span className="text-brand-400">2.</span>
                Once approved, you'll receive a confirmation email
              </li>
              <li className="flex gap-2">
                <span className="text-brand-400">3.</span>
                Log in and access all 18 AI tools — free forever
              </li>
            </ol>
          </div>
          <Link to="/login" className="btn-primary inline-block">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-xl shadow-brand-500/20">
            🦞
          </div>
          <h1 className="text-3xl font-bold gradient-text">Join AI Studio</h1>
          <p className="text-dark-400 mt-2">Create your free account — all AI runs locally</p>
        </div>

        <div className="glass-panel p-8">
          <h2 className="text-xl font-semibold mb-6">Create Account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Repeat your password"
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-dark-400">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-3 text-xs text-dark-500">
            <span>🔒</span>
            <span>Privacy-first: All AI inference runs locally on your GPU</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-dark-500">
            <span>🆓</span>
            <span>Completely free and open source</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-dark-500">
            <span>📧</span>
            <span>Admin approval required for access</span>
          </div>
        </div>
      </div>
    </div>
  );
}
