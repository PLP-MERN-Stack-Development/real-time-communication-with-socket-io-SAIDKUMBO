import { ChatProvider, useChat } from './context/ChatContext.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import ChatLayout from './components/ChatLayout.jsx';
import ToastStack from './components/ToastStack.jsx';

const AppContent = () => {
  const { state, actions } = useChat();
  const { user } = state;

  if (!user) {
    return (
      <>
        <LoginScreen />
        <ToastStack />
      </>
    );
  }

  return (
    <>
      <ChatLayout />
      <ToastStack />
    </>
  );
};

const App = () => (
  <ChatProvider>
    <AppContent />
  </ChatProvider>
);

export default App;
