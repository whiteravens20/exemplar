/**
 * Custom Response Templates
 * 
 * Użyj tych templates'ów do personalizacji odpowiedzi bota
 */

const templates = {
  // Responses for mentions
  mention: {
    default: 'Hi! I\'m an AI Assistant. Send me a DM to chat with me.',
    friendly: '👋 Hey there! I\'m an AI Assistant. Slide into my DMs to chat!',
    formal: 'Good day. I am an AI Assistant. Please send me a direct message to initiate conversation.',
    emoji: '🤖 Ping! I\'m here. Send me a DM! 💬'
  },

  // Responses for access denied
  restricted: {
    default: 'You don\'t have permission to use this feature. Please contact the admins.',
    friendly: '👀 Sorry! You don\'t have access yet. Ask the mods to unlock this for you!',
    polite: 'I appreciate your interest, but you don\'t currently have permission to use this feature. Please contact a server administrator.',
    emoji: '🔒 Access denied! Contact admins to unlock this feature.'
  },

  // Error responses
  error: {
    processing: '❌ Error processing your message. Please try again later.',
    n8nDown: '⚠️ The backend is currently unavailable. Please try again in a moment.',
    timeout: '⏱️ Request timed out. Your message took too long to process.',
    generic: '💥 Something went wrong! Try again or contact support.'
  },

  // Success responses
  success: {
    processed: '✅ Message processed successfully!',
    received: '📩 Message received and processed!',
    completed: '🎉 Done!'
  }
};

/**
 * Get a template response
 * @param {string} category - e.g., 'mention', 'restricted', 'error'
 * @param {string} type - e.g., 'default', 'friendly', 'formal'
 * @returns {string} Response text
 */
function getTemplate(category, type = 'default') {
  if (!templates[category]) {
    console.warn(`Unknown template category: ${category}`);
    return templates.error.generic;
  }
  
  if (!templates[category][type]) {
    console.warn(`Unknown template type ${type} for category ${category}`);
    return templates[category].default;
  }
  
  return templates[category][type];
}

module.exports = {
  templates,
  getTemplate
};
