/**
 * Intelligent message splitter for Discord (2000 char limit)
 * Splits messages while preserving formatting and code blocks
 */

const DISCORD_MAX_LENGTH = 2000;
const SAFE_LENGTH = 1900; // Conservative limit for safety

/**
 * Split a long message into Discord-safe chunks
 * @param {string} text - The text to split
 * @param {number} maxLength - Maximum length per chunk (default: 1900)
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
    // Split by paragraphs, then lines
    chunks.push(...splitByParagraphs(text, maxLength));
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Split text while preserving code blocks intact
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

  // Combine parts into chunks, preserving code blocks
  let currentChunk = '';

  for (const part of parts) {
    if (part.type === 'code') {
      // Code block - try to keep it whole
      if (part.content.length > maxLength) {
        // Code block itself is too long - split it by lines
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        chunks.push(...splitLargeCodeBlock(part.content, maxLength));
      } else if (currentChunk.length + part.content.length > maxLength) {
        // Adding code block would exceed limit - flush current chunk
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = part.content + '\n';
      } else {
        currentChunk += part.content + '\n';
      }
    } else {
      // Regular text - split by paragraphs/lines if needed
      const availableSpace = maxLength - currentChunk.length;
      
      if (part.content.length <= availableSpace) {
        // Text fits in current chunk
        currentChunk += part.content;
      } else {
        // Text doesn't fit - need to split
        const textChunks = splitByParagraphs(part.content, maxLength);
        
        // Try to fit first text chunk with current chunk
        if (textChunks.length > 0) {
          if (currentChunk.length + textChunks[0].length <= maxLength) {
            currentChunk += textChunks[0];
            
            // Push current chunk and add remaining text chunks
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            
            for (let i = 1; i < textChunks.length; i++) {
              chunks.push(textChunks[i]);
            }
            
            currentChunk = '';
          } else {
            // First text chunk doesn't fit - flush current chunk
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            
            // Add all text chunks
            for (const textChunk of textChunks) {
              chunks.push(textChunk);
            }
            
            currentChunk = '';
          }
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split large code block by lines - keeps code formatting intact
 */
function splitLargeCodeBlock(codeBlock, maxLength) {
  const chunks = [];
  const lines = codeBlock.split('\n');
  
  // Extract opening ```language
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  const language = firstLine.replace('```', '').trim();
  
  let currentChunk = '```' + language + '\n';
  const codeBlockOverhead = ('```' + language + '\n```').length;
  
  // Process lines between opening and closing ```
  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    const lineWithNewline = line + '\n';
    
    // Check if adding this line would exceed limit (including closing ```)
    if (currentChunk.length + lineWithNewline.length + 4 > maxLength) {
      // Close current chunk
      currentChunk += '```';
      chunks.push(currentChunk);
      
      // Start new chunk
      currentChunk = '```' + language + '\n' + lineWithNewline;
    } else {
      currentChunk += lineWithNewline;
    }
  }
  
  // Close final chunk
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
      // Paragraph itself is too long - split by lines
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
 * Split text by lines - never splits words, only between lines or at word boundaries
 */
function splitByLines(text, maxLength) {
  const chunks = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    // If single line is too long, try to split at word boundaries
    if (line.length > maxLength) {
      // Flush current chunk first
      if (currentChunk) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = '';
      }
      
      // Split this long line at word boundaries
      chunks.push(...splitLongLine(line, maxLength));
    } else if (currentChunk.length + line.length + 1 > maxLength) {
      // Adding this line would exceed limit - flush current chunk
      if (currentChunk) {
        chunks.push(currentChunk.trimEnd());
      }
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trimEnd());
  }

  return chunks;
}

/**
 * Split a long line at word boundaries (never in the middle of a word)
 */
function splitLongLine(line, maxLength) {
  const chunks = [];
  const words = line.split(' ');
  let currentChunk = '';

  for (const word of words) {
    // If adding this word would exceed limit
    if (currentChunk.length + word.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = '';
      }
      
      // If single word is longer than maxLength, we must split it
      if (word.length > maxLength) {
        chunks.push(...splitLongWord(word, maxLength));
      } else {
        currentChunk = word + ' ';
      }
    } else {
      currentChunk += word + ' ';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trimEnd());
  }

  return chunks;
}

/**
 * Split a very long word (only as last resort)
 * Adds continuation indicator to show word was split
 */
function splitLongWord(word, maxLength) {
  const chunks = [];
  const continuationMarker = '...';
  const splitLength = maxLength - continuationMarker.length;
  
  for (let i = 0; i < word.length; i += splitLength) {
    const chunk = word.substring(i, i + splitLength);
    if (i + splitLength < word.length) {
      chunks.push(chunk + continuationMarker);
    } else {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

module.exports = {
  splitMessage,
  DISCORD_MAX_LENGTH,
  SAFE_LENGTH
};
