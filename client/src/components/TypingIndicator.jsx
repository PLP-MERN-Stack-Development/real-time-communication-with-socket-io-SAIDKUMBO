const TypingIndicator = ({ names }) => {
  if (!names?.length) {
    return null;
  }

  const display = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? ` +${names.length - 3}` : '';

  return <div className="typing-indicator">{`${display}${more} typing…`}</div>;
};

export default TypingIndicator;
