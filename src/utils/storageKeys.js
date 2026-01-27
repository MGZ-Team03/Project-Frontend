/**
 * Generate user-specific localStorage key for daily stats
 * @param {string} userEmail - User's email address
 * @returns {string} localStorage key
 */
export const getStorageKey = (userEmail) => {
  if (!userEmail) {
    return 'speaktracker_daily_stats_guest';
  }
  // Sanitize email for localStorage key (remove special characters)
  const sanitized = userEmail.replace(/[^a-zA-Z0-9@._-]/g, '_');
  return `speaktracker_daily_stats_${sanitized}`;
};

/**
 * Migrate old static storage key to user-specific key
 * This is called once per user to migrate existing data
 * @param {string} userEmail - User's email address
 */
export const migrateOldStatsKey = (userEmail) => {
  const OLD_KEY = 'speaktracker_daily_stats';
  const oldData = localStorage.getItem(OLD_KEY);

  if (oldData && userEmail) {
    const newKey = getStorageKey(userEmail);
    // Only migrate if new key doesn't exist (prevent overwriting)
    if (!localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldData);
      console.log(`✓ Migrated old stats to ${newKey}`);
    }
    // Remove old key after successful migration
    localStorage.removeItem(OLD_KEY);
  }
};
