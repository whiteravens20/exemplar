/**
 * Intelligent message splitter for Discord (2000 char limit)
 * Splits messages while preserving formatting and code blocks
 */

const DISCORD_MAX_LENGTH = 2000;
const SAFE_LENGTH = 1900;

/**
 * Split a long message into Discord-safe chunks
 */
function splitMessage(text: string, maxLength: number = SAFE_LENGTH): string[] {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];

  const codeBlockRegex = /```[\s\S]*?```/g;
  const hasCodeBlocks = codeBlockRegex.test(text);

  if (hasCodeBlocks) {
    chunks.push(...splitWithCodeBlocks(text, maxLength));
  } else {
    chunks.push(...splitByParagraphs(text, maxLength));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

interface TextPart {
  type: 'text' | 'code';
  content: string;
}

/**
 * Split text while preserving code blocks intact
 */
function splitWithCodeBlocks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const parts: TextPart[] = [];
  let lastIndex = 0;

  const codeBlockRegex = /```[\s\S]*?```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'code',
      content: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  let currentChunk = '';

  for (const part of parts) {
    if (part.type === 'code') {
      if (part.content.length > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        chunks.push(...splitLargeCodeBlock(part.content, maxLength));
      } else if (currentChunk.length + part.content.length > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = part.content + '\n';
      } else {
        currentChunk += part.content + '\n';
      }
    } else {
      const availableSpace = maxLength - currentChunk.length;

      if (part.content.length <= availableSpace) {
        currentChunk += part.content;
      } else {
        const textChunks = splitByParagraphs(part.content, maxLength);

        if (textChunks.length > 0) {
          if (currentChunk.length + textChunks[0].length <= maxLength) {
            currentChunk += textChunks[0];

            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }

            for (let i = 1; i < textChunks.length; i++) {
              chunks.push(textChunks[i]);
            }

            currentChunk = '';
          } else {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }

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
 * Split large code block by lines
 */
function splitLargeCodeBlock(codeBlock: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const lines = codeBlock.split('\n');

  const firstLine = lines[0];
  const language = firstLine.replace('```', '').trim();

  let currentChunk = '```' + language + '\n';

  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    const lineWithNewline = line + '\n';

    if (currentChunk.length + lineWithNewline.length + 4 > maxLength) {
      currentChunk += '```';
      chunks.push(currentChunk);
      currentChunk = '```' + language + '\n' + lineWithNewline;
    } else {
      currentChunk += lineWithNewline;
    }
  }

  currentChunk += '```';
  chunks.push(currentChunk);

  return chunks;
}

/**
 * Split text by paragraphs
 */
function splitByParagraphs(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      chunks.push(...splitByLines(paragraph, maxLength));
    } else if (currentChunk.length + paragraph.length + 2 > maxLength) {
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
function splitByLines(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (line.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = '';
      }
      chunks.push(...splitLongLine(line, maxLength));
    } else if (currentChunk.length + line.length + 1 > maxLength) {
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
 * Split a long line at word boundaries
 */
function splitLongLine(line: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const words = line.split(' ');
  let currentChunk = '';

  for (const word of words) {
    if (currentChunk.length + word.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = '';
      }

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
 * Split a very long word (last resort)
 */
function splitLongWord(word: string, maxLength: number): string[] {
  const chunks: string[] = [];
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

export { splitMessage, DISCORD_MAX_LENGTH, SAFE_LENGTH };
