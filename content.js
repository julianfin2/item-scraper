(() => {
  // Simple extraction of visible text
  const text = document.body.innerText;
  const url = window.location.href;
  const title = document.title;

  // Basic cleanup: remove excessive whitespace
  const cleanText = text.replace(/\s\s+/g, ' ').substring(0, 10000); // Limit to 10k chars for token savings

  return {
    text: cleanText,
    url,
    title
  };
})();
