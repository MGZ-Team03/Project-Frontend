import { DIFFICULTY_LEVELS } from '../../data/conversation/difficultyLevels';

/**
 * Build system prompt for sentence generation
 * @param {string} difficulty - 하/중/상
 * @returns {string} System prompt for Claude API
 */
export function buildSentencePrompt(difficulty) {
  const level = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS['중'];

  const difficultyGuidance = {
    하: {
      words: '5-7 words',
      vocabulary: 'basic vocabulary (greetings, daily life, simple actions)',
      examples: 'Example topics: greetings, weather, food, daily routines'
    },
    중: {
      words: '8-12 words',
      vocabulary: 'everyday vocabulary (describing situations, asking questions)',
      examples: 'Example topics: travel, shopping, hobbies, making plans'
    },
    상: {
      words: '13-18 words',
      vocabulary: 'advanced vocabulary (idioms, complex grammar, specific topics)',
      examples: 'Example topics: opinions, explanations, hypotheticals, professional contexts'
    }
  };

  const guidance = difficultyGuidance[difficulty];

  return `You are an English pronunciation teacher. Generate a practice sentence for a Korean student learning English pronunciation.

DIFFICULTY: ${level.label}
- Word count: ${guidance.words}
- Vocabulary level: ${guidance.vocabulary}
- ${guidance.examples}

REQUIREMENTS:
- Generate exactly ONE sentence
- The sentence should be natural and conversational
- Use vocabulary appropriate for this difficulty level
- Make it useful for real-world communication
- Focus on clear pronunciation practice
- Vary sentence structures (statements, questions, exclamations)

AVOID:
- Tongue twisters or overly complex phonetics
- Rare or archaic words
- Multiple sentences or questions in one response
- Overly formal or literary language
- Basic greetings: "Hello", "Hi", "Good morning", "Goodbye"
- Simple thanks: "Thank you", "Thanks a lot"  
- Basic apologies: "I'm sorry", "Excuse me", "Sorry"
- Yes/No only: "Yes", "No", "Okay", "Sure"
- Single words or filler: "Please", "Really?", "Nice"
- Textbook clichés: "My name is...", "How are you?", "I am fine"
- Numbers/alphabet practice: "One, two, three",

Respond with ONLY the sentence, nothing else. No quotation marks, no explanations.`;
}

/**
 * Build system prompt for sentence generation with TOPIC(scenario)
 *
 * @param {Object} scenario - scenario metadata from data/conversation/scenarios.js
 * @param {string} difficulty - 하/중/상
 * @returns {string} System prompt
 */
export function buildTopicSentencePrompt(scenario, difficulty) {
  const level = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS['중'];

  const topicTitle = scenario?.title || 'General';
  const topicDesc = scenario?.description || '';
  const topicNotes = scenario?.contextNotes || '';

  return `You are an English pronunciation teacher. Generate a practice sentence for a Korean student learning English pronunciation.

TOPIC:
- Title: ${topicTitle}
- Description: ${topicDesc}
${topicNotes ? `- Notes: ${topicNotes}` : ''}

DIFFICULTY: ${level.label}

REQUIREMENTS:
- Generate exactly ONE sentence
- The sentence must fit the TOPIC context (sounds natural in that situation)
- The sentence should be natural and conversational
- Make it useful for real-world communication
- Focus on clear pronunciation practice
- Avoid being too short or too long for the difficulty

AVOID:
- Tongue twisters or overly complex phonetics
- Rare or archaic words
- Multiple sentences in one response
- Textbook clichés like: "My name is...", "How are you?", "I am fine"

Respond with ONLY the sentence, nothing else. No quotation marks, no explanations.`;
}

/**
 * Build system prompt for BATCH sentence generation
 * @param {string} difficulty - 하/중/상
 * @param {number} count - Number of sentences to generate
 * @returns {string} System prompt for Claude API
 */
export function buildBatchSentencePrompt(difficulty, count = 10) {
  const level = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS['중'];
  
  const difficultyGuidance = {
    하: {
      words: '5-7 words',
      vocabulary: 'basic vocabulary (greetings, daily life, simple actions)',
      examples: 'Example topics: greetings, weather, food, daily routines'
    },
    중: {
      words: '8-12 words',
      vocabulary: 'everyday vocabulary (describing situations, asking questions)',
      examples: 'Example topics: travel, shopping, hobbies, making plans'
    },
    상: {
      words: '13-18 words',
      vocabulary: 'advanced vocabulary (idioms, complex grammar, specific topics)',
      examples: 'Example topics: opinions, explanations, hypotheticals, professional contexts'
    }
  };

  const guidance = difficultyGuidance[difficulty];

  return `You are an English pronunciation teacher. Generate ${count} practice sentences for a Korean student learning English pronunciation.

DIFFICULTY: ${level.label}
- Word count per sentence: ${guidance.words}
- Vocabulary level: ${guidance.vocabulary}
- ${guidance.examples}

REQUIREMENTS:
- Generate exactly ${count} sentences
- The sentences should be natural and conversational
- Use vocabulary appropriate for this difficulty level
- Make it useful for real-world communication
- Focus on clear pronunciation practice
- Vary sentence structures (statements, questions, exclamations)
- Format the output as a JSON array of strings: ["sentence 1", "sentence 2", ...]

AVOID:
- Tongue twisters or overly complex phonetics
- Rare or archaic words
- Overly formal or literary language
- Duplicate sentences
- Basic greetings: "Hello", "Hi", "Good morning", "Goodbye"
- Simple thanks: "Thank you", "Thanks a lot"  
- Basic apologies: "I'm sorry", "Excuse me", "Sorry"
- Yes/No only: "Yes", "No", "Okay", "Sure"
- Single words or filler: "Please", "Really?", "Nice"
- Textbook clichés: "My name is...", "How are you?", "I am fine"
- Numbers/alphabet practice: "One, two, three"

Respond with ONLY the JSON array, nothing else.`;
}

/**
 * Build system prompt for BATCH sentence generation with TOPIC(scenario)
 *
 * @param {Object} scenario - scenario metadata from data/conversation/scenarios.js
 * @param {string} difficulty - 하/중/상
 * @param {number} count - number of sentences
 * @returns {string} System prompt
 */
export function buildTopicBatchSentencePrompt(scenario, difficulty, count = 10) {
  const level = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS['중'];

  const topicTitle = scenario?.title || 'General';
  const topicDesc = scenario?.description || '';
  const topicNotes = scenario?.contextNotes || '';

  return `You are an English pronunciation teacher. Generate ${count} practice sentences for a Korean student learning English pronunciation.

TOPIC:
- Title: ${topicTitle}
- Description: ${topicDesc}
${topicNotes ? `- Notes: ${topicNotes}` : ''}

DIFFICULTY: ${level.label}

REQUIREMENTS:
- Generate exactly ${count} sentences
- Every sentence must fit the TOPIC context (sounds natural in that situation)
- The sentences should be natural and conversational
- Make them useful for real-world communication
- Focus on clear pronunciation practice
- Vary sentence structures (statements, questions, exclamations)
- Format the output as a JSON array of strings: ["sentence 1", "sentence 2", ...]

AVOID:
- Tongue twisters or overly complex phonetics
- Rare or archaic words
- Overly formal or literary language
- Duplicate sentences
- Textbook clichés like: "My name is...", "How are you?", "I am fine"

Respond with ONLY the JSON array, nothing else.`;
}
