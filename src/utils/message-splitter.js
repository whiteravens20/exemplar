/**
 * Intelligent message splitter for Discord (2000 char limit)
 * Splits messages while preserving formatting and code blocks
 */

const DISCORD_MAX_LENGTH = 2000;
const SAFE_LENGTH = 1500; // Conservative limit for safety

/**
 * Split a long message into Discord-safe chunks
 * @param {string} text - The text to split
 * @param {number} maxLength - Maximum length per chunk (default: 1950)
 * @returns {string[]} - Array of message chunks
 */
function splitMessage(text, maxLength = SAFE_LENGTH) {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const chunks = [];

  // Check if message contains code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;
  const hasCodeBlocks = codeBlockRegex.test(text);

  if (hasCodeBlocks) {
    // Split preserving entire code blocks
    chunks.push(...splitWithCodeBlocks(text, maxLength));
  } else {
    // Split by paragraphs, then lines, then words
    chunks.push(...splitByParagraphs(text, maxLength));
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Split text while preserving code blocks
 */
function splitWithCodeBlocks(text, maxLength) {
  const chunks = [];
  const parts = [];
  let lastIndex = 0;

  // Extract code blocks and text between them
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // Add code block
    parts.push({
      type: 'code',
      content: match[0]
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  // Combine parts into chunks
  let currentChunk = '';

  for (const part of parts) {
    if (part.type === 'code') {
      // Code block - try to keep it whole
      if (part.content.length > maxLength) {
        // Code block itself is too long - split it carefully
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        chunks.push(...splitLargeCodeBlock(part.content, maxLength));
      } else if (currentChunk.length + part.content.length > maxLength) {
        // Adding code block would exceed limit
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = part.content;
      } else {
        currentChunk += part.content;
      }
    } else {
      // Regular text - split by paragraphs
      const textChunks = splitByParagraphs(part.content, maxLength - currentChunk.length);
      
      for (let i = 0; i < textChunks.length; i++) {
        if (i === 0 && currentChunk.length + textChunks[i].length <= maxLength) {
          currentChunk += textChunks[i];
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          currentChunk = textChunks[i];
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Split large code block by lines
 */
function splitLargeCodeBlock(codeBlock, maxLength) {
  const chunks = [];
  const lines = codeBlock.split('\n');
  
  // Extract opening ```language
  const firstLine = lines[0];
  const language = firstLine.replace('```', '');
  
  let currentChunk = '```' + language + '\n';
  
  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i] + '\n';
    
    if (currentChunk.length + line.length + 4 > maxLength) { // +4 for closing ```
      currentChunk += '```';
      chunks.push(currentChunk);
      currentChunk = '```' + language + '\n' + line;
    } else {
      currentChunk += line;
    }
  }
  
  currentChunk += '```';
  chunks.push(currentChunk);
  
  return chunks;
}

/**
 * Split text by paragraphs
 */
function splitByParagraphs(text, maxLength) {
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      // Paragraph itself is too long
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...splitByLines(paragraph, maxLength));
    } else if (currentChunk.length + paragraph.length + 2 > maxLength) {
      // Adding paragraph would exceed limit
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph + '\n\n';
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split text by lines
 */
function splitByLines(text, maxLength) {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (line.length > maxLength) {
      // Line itself is too long
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...splitByWords(line, maxLength));
    } else if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split text by words (last resort)
 */
function splitByWords(text, maxLength) {
  const chunks = [];
  const words = text.split(' ');
  let currentChunk = '';

  for (const word of words) {
    if (word.length > maxLength) {
      // Single word too long - split by characters
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...splitByCharacters(word, maxLength));
    } else if (currentChunk.length + word.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = word + ' ';
    } else {
      currentChunk += word + ' ';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split by characters (absolute last resort)
 */
function splitByCharacters(text, maxLength) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.substring(i, i + maxLength));
  }
  return chunks;
}

module.exports = {
  splitMessage,
  DISCORD_MAX_LENGTH,
  SAFE_LENGTH
};
