import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

const numRows = 8;
const numCols = 8;
const emojis = ["🐻", "🐨", "🐰", "🐼", "🐷"];
const duration = 200;

const emojiColors: { [key: string]: string } = {
  "🐻": "#8B4513", // SaddleBrown
  "🐨": "#B0C4DE", // LightSteelBlue
  "🐰": "#E0E0E0", // Light Grey
  "🐼": "#90EE90", // LightGreen
  "🐷": "#FFB6C1", // LightPink
};

const cellSize = Math.floor(Dimensions.get("window").width / numCols);

function randomEmoji() {
  return emojis[Math.floor(Math.random() * emojis.length)];
}

type SpecialType = "none" | "bomb" | "rainbow";

type Block = {
  id: string;
  emoji: string;
  row: number;
  col: number;
  special: SpecialType;
};

type Match = {
  coords: [number, number][];
  length: number;
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
        row.push({ emoji: randomEmoji(), id: `${r}-${c}-${Math.random()}`, row: r, col: c, special: "none" });
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

  const findMatches = (brd: Block[][]): Match[] => {
    const allMatches: Match[] = [];
    const visited = Array(numRows)
      .fill(null)
      .map(() => Array(numCols).fill(false));

    // Horizontal matches
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (visited[r][c] || !brd[r][c].emoji) continue;
        const currentEmoji = brd[r][c].emoji;
        let matchLength = 1;
        while (c + matchLength < numCols && brd[r][c + matchLength].emoji === currentEmoji) {
          matchLength++;
        }
        if (matchLength >= 3) {
          const coords: [number, number][] = [];
          for (let i = 0; i < matchLength; i++) {
            coords.push([r, c + i]);
            visited[r][c + i] = true;
          }
          allMatches.push({ coords, length: matchLength });
          c += matchLength - 1;
        }
      }
    }

    // Vertical matches
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows; r++) {
        if (visited[r][c] || !brd[r][c].emoji) continue;
        const currentEmoji = brd[r][c].emoji;
        let matchLength = 1;
        while (r + matchLength < numRows && brd[r + matchLength][c].emoji === currentEmoji) {
          matchLength++;
        }
        if (matchLength >= 3) {
          const coords: [number, number][] = [];
          for (let i = 0; i < matchLength; i++) {
            // Avoid double-counting by checking visited again
            if (!visited[r + i][c]) {
              coords.push([r + i, c]);
            }
          }
          // Only add if it forms a new match (for T-shapes)
          if (coords.length >= 3) {
             allMatches.push({ coords, length: coords.length });
          }
           // Mark all as visited regardless
          for (let i = 0; i < matchLength; i++) {
            visited[r + i][c] = true;
          }
          r += matchLength - 1;
        }
      }
    }

    return allMatches;
  };

  const clearAndDrop = (
    brd: Block[][],
    matches: [number, number][],
    specialToCreate?: { pos: [number, number]; type: SpecialType }
  ) => {
    const newBoard = brd.map((row) => [...row]);
    const specialPosStr = specialToCreate ? `${specialToCreate.pos[0]},${specialToCreate.pos[1]}` : "";

    matches.forEach(([r, c]) => {
      if (`${r},${c}` === specialPosStr) return;
      newBoard[r][c] = { ...newBoard[r][c], emoji: "", special: "none", id: `empty-${Math.random()}` };
    });

    if (specialToCreate) {
      const [r, c] = specialToCreate.pos;
      newBoard[r][c] = { ...newBoard[r][c], special: specialToCreate.type };
    }

    for (let c = 0; c < numCols; c++) {
      let empty = 0;
      for (let r = numRows - 1; r >= 0; r--) {
        if (newBoard[r][c].emoji === "") empty++;
        else if (empty > 0) {
          newBoard[r + empty][c] = { ...newBoard[r][c], row: r + empty };
          newBoard[r][c] = { ...newBoard[r][c], emoji: "", special: "none", id: `empty-${Math.random()}` };
        }
      }
      for (let r = 0; r < empty; r++) {
        newBoard[r][c] = { emoji: randomEmoji(), id: `new-${Math.random()}`, row: r, col: c, special: "none" };
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

    const block1 = newBoard[r1][c1];
    const block2 = newBoard[r2][c2];
    const specialActivationCoords = new Set<string>();

    const checkAndTriggerSpecials = (r: number, c: number, otherBlock: Block) => {
      const block = newBoard[r][c];
      if (block.special === "bomb") {
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            const aR = r + i;
            const aC = c + j;
            if (aR >= 0 && aR < numRows && aC >= 0 && aC < numCols) {
              specialActivationCoords.add(`${aR},${aC}`);
            }
          }
        }
      } else if (block.special === "rainbow") {
        const targetEmoji = otherBlock.emoji;
        if (targetEmoji) {
           specialActivationCoords.add(`${r},${c}`); // Clear the rainbow block itself
          for (let ro = 0; ro < numRows; ro++) {
            for (let co = 0; co < numCols; co++) {
              if (newBoard[ro][co].emoji === targetEmoji) {
                specialActivationCoords.add(`${ro},${co}`);
              }
            }
          }
        }
      }
    };
    checkAndTriggerSpecials(r1, c1, block2);
    checkAndTriggerSpecials(r2, c2, block1);

    const matches = findMatches(newBoard);

    // A move is valid if it creates a match OR activates a special block.
    if (matches.length === 0 && specialActivationCoords.size === 0) {
      // Swap-back with delay to allow animation
      setTimeout(() => {
        const backBoard = swap(r1, c1, r2, c2);
        setBoard(backBoard);
      }, duration);
      return;
    }

    setBoard(newBoard);

    // --- Game Logic Loop ---
    let boardAfterMove = newBoard;
    let totalScoreToAdd = 0;
    let firstMatches = matches;
    let keepProcessing = true;
    let isFirstLoop = true;

    while (keepProcessing) {
      let specialToCreate: { pos: [number, number]; type: SpecialType } | undefined = undefined;

      if (isFirstLoop) {
        const match5 = firstMatches.find((m) => m.length >= 5);
        const match4 = firstMatches.find((m) => m.length === 4);

        if (match5 && match5.coords.some(([r, c]) => r === r2 && c === c2)) {
          specialToCreate = { pos: [r2, c2], type: "rainbow" };
        } else if (match4 && match4.coords.some(([r, c]) => r === r2 && c === c2)) {
          specialToCreate = { pos: [r2, c2], type: "bomb" };
        }
      }

      const coordsToClearSet = new Set<string>();
      specialActivationCoords.forEach((coord) => coordsToClearSet.add(coord));
      firstMatches.forEach((match) => {
        match.coords.forEach(([r, c]) => coordsToClearSet.add(`${r},${c}`));
      });

      if (coordsToClearSet.size === 0) {
        keepProcessing = false;
        continue;
      }

      const coordsToClear: [number, number][] = Array.from(coordsToClearSet).map((s) => {
        const [r, c] = s.split(",").map(Number);
        return [r, c];
      });

      totalScoreToAdd += coordsToClear.length * 10;
      boardAfterMove = clearAndDrop(boardAfterMove, coordsToClear, specialToCreate);

      firstMatches = findMatches(boardAfterMove);
      isFirstLoop = false;
    }

    setScore((s) => s + totalScoreToAdd);
    setBoard(boardAfterMove);
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

  const backgroundColor = emojiColors[block.emoji] || "transparent";

  const specialIndicator = () => {
    if (block.special === "bomb") {
      return <Text style={styles.specialIndicator}>💣</Text>;
    }
    if (block.special === "rainbow") {
      return <Text style={styles.specialIndicator}>🌈</Text>;
    }
    return null;
  };

  return (
    <Animated.View
      style={[
        styles.block,
        styleAnim,
        {
          zIndex: selected ? 1 : 0,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          {
            backgroundColor,
            transform: [{ scale: pressed ? 0.9 : 1 }],
            borderWidth: selected ? 3 : 0,
            borderColor: "black",
          },
        ]}
      >
        <Text style={{ fontSize: cellSize * 0.5 }}>{block.emoji}</Text>
        {specialIndicator()}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  specialIndicator: {
    position: "absolute",
    fontSize: cellSize * 0.3,
    top: 0,
    right: 0,
  },
  block: {
    width: cellSize,
    height: cellSize,
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  pressable: {
    width: cellSize * 0.8,
    height: cellSize * 0.8,
    borderRadius: cellSize * 0.4,
    justifyContent: "center",
    alignItems: "center",
  },
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