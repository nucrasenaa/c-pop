import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

const numRows = 8;
const numCols = 8;
// Colors based on LINE characters (Brown, Cony, Sally, etc.)
const colors = ["#A52A2A", "#FFC0CB", "#32CD32", "#FFD700", "#F5F5F5"];
const duration = 200;

const cellSize = Math.floor(Dimensions.get("window").width / numCols);

function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

type Block = {
  id: string;
  color: string;
  row: number;
  col: number;
};

export default function App() {
  const [board, setBoard] = useState<Block[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60);

  useEffect(() => {
    resetBoard();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prevTime) => {
        if (prevTime === 0) {
          clearInterval(timer);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const resetBoard = () => {
    const newBoard: Block[][] = [];
    for (let r = 0; r < numRows; r++) {
      const row: Block[] = [];
      for (let c = 0; c < numCols; c++) {
        row.push({ color: randomColor(), id: `${r}-${c}-${Math.random()}`, row: r, col: c });
      }
      newBoard.push(row);
    }
    setBoard(newBoard);
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
        if (brd[r][c].color === brd[r][c - 1].color) count++;
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
        if (brd[r][c].color === brd[r - 1][c].color) count++;
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
      newBoard[r][c] = { ...newBoard[r][c], color: "", id: `empty-${Math.random()}` };
    });
    for (let c = 0; c < numCols; c++) {
      let empty = 0;
      for (let r = numRows - 1; r >= 0; r--) {
        if (newBoard[r][c].color === "") empty++;
        else if (empty > 0) {
          newBoard[r + empty][c] = { ...newBoard[r][c], row: r + empty };
          newBoard[r][c] = { ...newBoard[r][c], color: "", id: `empty-${Math.random()}` };
        }
      }
      for (let r = 0; r < empty; r++) {
        newBoard[r][c] = { color: randomColor(), id: `new-${Math.random()}`, row: r, col: c };
      }
    }
    return newBoard;
  };

  const handlePress = (r: number, c: number) => {
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
    let clearedBoard = newBoard;
    let nextMatches = matches;
    while (nextMatches.length > 0) {
      setScore((s) => s + nextMatches.length * 10); // Add score
      clearedBoard = clearAndDrop(clearedBoard, nextMatches);
      nextMatches = findMatches(clearedBoard);
    }
    setBoard(clearedBoard);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.scoreText}>Score: {score}</Text>
      <View style={styles.boardContainer}>
        <View
          style={{
            width: cellSize * numCols,
            height: cellSize * numRows,
            position: "relative",
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
      </View>
      <Text style={styles.timerText}>Time: {timeRemaining}</Text>
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
        },
        styleAnim,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          backgroundColor: block.color || "black",
          borderRadius: cellSize / 2,
          borderWidth: selected ? 3 : 1,
          borderColor: selected ? "white" : "rgba(0,0,0,0.2)",
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#A0522D", // Sienna brown
    justifyContent: "center",
    alignItems: "center",
  },
  boardContainer: {
    padding: 10,
    backgroundColor: "#F0E68C", // Khaki yellow
    borderRadius: 10,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  }
});