import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORES_KEY = 'C_POP_HIGH_SCORES';

export type ScoreEntry = {
  score: number;
  date: number; // Store as timestamp
};

export const getHighScores = async (): Promise<ScoreEntry[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(HIGH_SCORES_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Failed to load high scores.", e);
    return [];
  }
};

export const saveHighScores = async (scores: ScoreEntry[]): Promise<void> => {
  try {
    // Sort scores descending and take top 5
    const sortedScores = scores.sort((a, b) => b.score - a.score).slice(0, 5);
    const jsonValue = JSON.stringify(sortedScores);
    await AsyncStorage.setItem(HIGH_SCORES_KEY, jsonValue);
  } catch (e) {
    console.error("Failed to save high scores.", e);
  }
};
