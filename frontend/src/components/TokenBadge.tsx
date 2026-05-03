import { useAuth } from '../features/auth/AuthContext';

export default function TokenBadge() {
  const { tokens, refreshTokens } = useAuth();
  if (!tokens) return null;
  const low = (tokens.tokensRemaining ?? 0) <= 5;
  return (
    <button
      className={`badge ${low ? 'amber' : 'orange'}`}
      style={{ cursor: 'pointer' }}
      onClick={() => void refreshTokens()}
      title="Click to refresh balance"
    >
      <span>⛁</span>
      <span>{tokens.tokensRemaining} / {tokens.tokensTotal} tokens</span>
    </button>
  );
}
