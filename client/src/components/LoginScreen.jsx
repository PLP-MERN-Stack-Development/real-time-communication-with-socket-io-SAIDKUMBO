import { useState } from 'react';
import { useChat } from '../context/ChatContext.jsx';

const usernameSuggestions = ['Skywalker', 'Nebula', 'Photon', 'Quasar'];

const pickSuggestion = () =>
  usernameSuggestions[Math.floor(Math.random() * usernameSuggestions.length)];

const LoginScreen = () => {
  const { actions, state } = useChat();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await actions.connect(username || pickSuggestion());
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Real-Time Chat</h1>
        <p className="subtitle">Join the conversation with a unique handle.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="username">Display name</label>
          <input
            id="username"
            type="text"
            placeholder="Enter a username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={24}
            disabled={state.isConnecting}
          />
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" disabled={state.isConnecting}>
            {state.isConnecting ? 'Joining…' : 'Start chatting'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
