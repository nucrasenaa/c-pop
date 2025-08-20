import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { getHighScores, ScoreEntry } from '../storage';

export default function HomeScreen({ navigation }: { navigation: any }) {
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      const loadScores = async () => {
        const scores = await getHighScores();
        setHighScores(scores);
      };
      loadScores();
    }
  }, [isFocused]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>C POP</Text>
      <View style={styles.highScoreContainer}>
        <Text style={styles.highScoreTitle}>Top 5 Scores</Text>
        <FlatList
          data={highScores}
          keyExtractor={(item, index) => `${item.date}-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>#{index + 1}</Text>
              <Text style={styles.scoreText}>{item.score}</Text>
              <Text style={styles.scoreText}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.noScoresText}>No scores yet!</Text>}
        />
      </View>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('Game')}
      >
        <Text style={styles.buttonText}>Start Game</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 64,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 40,
  },
  highScoreContainer: {
    width: '90%',
    maxHeight: '40%',
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 20,
    marginBottom: 40,
  },
  highScoreTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  scoreText: {
    fontSize: 18,
    color: 'white',
  },
  noScoresText: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    backgroundColor: '#ffc107',
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
  },
});
