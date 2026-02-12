/**
 * Token estimator utility
 * Provides rough estimation of token count for text
 */

/**
 * Estimate token count for text
 * Uses simple heuristic: chars/4 (approximate for GPT tokens)
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Basic estimation: ~1 token per 4 characters
  // This is a rough approximation and can be replaced with tiktoken for accuracy
  const estimate = Math.ceil(text.length / 4);

  return estimate;
}

/**
 * Estimate tokens for multiple texts (e.g., messages in conversation)
 * @param {Array<string>} texts - Array of text strings
 * @returns {number} Total estimated token count
 */
function estimateTokensForConversation(texts) {
  if (!Array.isArray(texts)) {
    return 0;
  }

  return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

module.exports = {
  estimateTokens,
  estimateTokensForConversation
};
