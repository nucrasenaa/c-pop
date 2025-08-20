import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

const numRows = 8;
const numCols = 8;
const emojis = ["🐻", "🐨", "🐰", "🐼", "🐷"];
const duration = 200;

const cellSize = Math.floor(Dimensions.get("window").width / numCols);

function randomEmoji() {
  return emojis[Math.floor(Math.random() * emojis.length)];
}

type Block = {
  id: string;
  emoji: string;
  row: number;
  col: number;
};

export default function App() {
  const [board, setBoard] = useState<Block[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    resetBoard();
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setGameOver(true);
    }
  }, [timeLeft]);

  const resetBoard = () => {
    const newBoard: Block[][] = [];
    for (let r = 0; r < numRows; r++) {
      const row: Block[] = [];
      for (let c = 0; c < numCols; c++) {
        row.push({ emoji: randomEmoji(), id: `${r}-${c}-${Math.random()}`, row: r, col: c });
      }
      newBoard.push(row);
    }
    setBoard(newBoard);
    setScore(0);
  };

  const restartGame = () => {
    setTimeLeft(60);
    setGameOver(false);
    resetBoard();
  };

  const swap = (r1: number, c1: number, r2: number, c2: number) => {
    const newBoard = board.map((row) => [...row]);
    const tmp = newBoard[r1][c1];
    newBoard[r1][c1] = { ...newBoard[r2][c2], row: r1, col: c1 };
    newBoard[r2][c2] = { ...tmp, row: r2, col: c2 };
    return newBoard;
  };

  const findMatches = (brd: Block[][]) => {
    const matches: [number, number][] = [];
    // Horizontal
    for (let r = 0; r < numRows; r++) {
      let count = 1;
      for (let c = 1; c < numCols; c++) {
        if (brd[r][c].emoji === brd[r][c - 1].emoji) count++;
        else {
          if (count >= 3) for (let k = 0; k < count; k++) matches.push([r, c - 1 - k]);
          count = 1;
        }
      }
      if (count >= 3) for (let k = 0; k < count; k++) matches.push([r, numCols - 1 - k]);
    }
    // Vertical
    for (let c = 0; c < numCols; c++) {
      let count = 1;
      for (let r = 1; r < numRows; r++) {
        if (brd[r][c].emoji === brd[r - 1][c].emoji) count++;
        else {
          if (count >= 3) for (let k = 0; k < count; k++) matches.push([r - 1 - k, c]);
          count = 1;
        }
      }
      if (count >= 3) for (let k = 0; k < count; k++) matches.push([numRows - 1 - k, c]);
    }
    return matches;
  };

  const clearAndDrop = (brd: Block[][], matches: [number, number][]) => {
    const newBoard = brd.map((row) => [...row]);
    matches.forEach(([r, c]) => {
      newBoard[r][c] = { ...newBoard[r][c], emoji: "", id: `empty-${Math.random()}` };
    });
    for (let c = 0; c < numCols; c++) {
      let empty = 0;
      for (let r = numRows - 1; r >= 0; r--) {
        if (newBoard[r][c].emoji === "") empty++;
        else if (empty > 0) {
          newBoard[r + empty][c] = { ...newBoard[r][c], row: r + empty };
          newBoard[r][c] = { ...newBoard[r][c], emoji: "", id: `empty-${Math.random()}` };
        }
      }
      for (let r = 0; r < empty; r++) {
        newBoard[r][c] = { emoji: randomEmoji(), id: `new-${Math.random()}`, row: r, col: c };
      }
    }
    return newBoard;
  };

  const handlePress = (r: number, c: number) => {
    if (gameOver) return;
    if (!selected) {
      setSelected([r, c]);
      return;
    }
    const [r1, c1] = selected;
    const [r2, c2] = [r, c];
    setSelected(null);

    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

    // Swap + animate
    let newBoard = swap(r1, c1, r2, c2);
    setBoard(newBoard);

    const matches = findMatches(newBoard);
    if (matches.length === 0) {
      // Swap-back with delay to allow animation
      setTimeout(() => {
        const backBoard = swap(r1, c1, r2, c2);
        setBoard(backBoard);
      }, duration);
      return;
    }

    // Clear & drop while matches exist
    let totalMatches = 0;
    let clearedBoard = newBoard;
    let nextMatches = matches;
    while (nextMatches.length > 0) {
      totalMatches += nextMatches.length;
      clearedBoard = clearAndDrop(clearedBoard, nextMatches);
      nextMatches = findMatches(clearedBoard);
    }
    setScore((s) => s + totalMatches * 10);
    setBoard(clearedBoard);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.timer}>Time: {timeLeft}</Text>
        <Text style={styles.score}>Score: {score}</Text>
      </View>
      {gameOver ? (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverText}>Game Over</Text>
          <Text style={styles.finalScore}>Final Score: {score}</Text>
          <Pressable style={styles.playAgainButton} onPress={restartGame}>
            <Text style={styles.playAgainButtonText}>Play Again</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            width: cellSize * numCols,
            height: cellSize * numRows,
            position: "relative",
            backgroundColor: "#f0f0f0",
            borderRadius: 8,
          }}
        >
          {board.flat().map((block) => (
            <BlockView
              key={block.id}
              block={block}
              selected={selected && selected[0] === block.row && selected[1] === block.col}
              onPress={() => handlePress(block.row, block.col)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function BlockView({ block, selected, onPress }: { block: Block; selected: boolean; onPress: () => void }) {
  const x = useSharedValue(block.col * cellSize);
  const y = useSharedValue(block.row * cellSize);

  useEffect(() => {
    x.value = withTiming(block.col * cellSize, { duration });
    y.value = withTiming(block.row * cellSize, { duration });
  }, [block.row, block.col]);

  const styleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: cellSize,
          height: cellSize,
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: selected ? 1 : 0,
          justifyContent: "center",
          alignItems: "center",
        },
        styleAnim,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: block.emoji ? "rgba(255, 255, 255, 0.5)" : "transparent",
          borderRadius: 6,
          borderWidth: selected ? 3 : 0,
          borderColor: "black",
        }}
      >
        <Text style={{ fontSize: cellSize * 0.6 }}>{block.emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#87CEEB", // Light Sky Blue
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 20,
  },
  timer: {
    fontSize: 24,
    fontWeight: "bold",
    color: "black",
  },
  score: {
    fontSize: 24,
    fontWeight: "bold",
    color: "black",
  },
  gameOverContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 20,
    borderRadius: 10,
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
  },
  finalScore: {
    fontSize: 32,
    color: "white",
    marginVertical: 20,
  },
  playAgainButton: {
    backgroundColor: "#4CAF50", // Green
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  playAgainButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
});