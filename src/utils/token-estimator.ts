/**
 * Token estimator utility
 * Provides rough estimation of token count for text
 */

/**
 * Estimate token count for text
 * Uses simple heuristic: chars/4 (approximate for GPT tokens)
 */
function estimateTokens(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for multiple texts (e.g., messages in conversation)
 */
function estimateTokensForConversation(texts: string[]): number {
  if (!Array.isArray(texts)) {
    return 0;
  }

  return texts.reduce((total, text) => total + estimateTokens(text), 0);
}

export { estimateTokens, estimateTokensForConversation };
