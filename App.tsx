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
  specialType?: 'bomb' | 'color_bomb';
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

  const swap = (brd: Block[][], r1: number, c1: number, r2: number, c2: number) => {
    const newBoard = brd.map((row) => [...row]);
    const tmp = newBoard[r1][c1];
    newBoard[r1][c1] = { ...newBoard[r2][c2], row: r1, col: c1 };
    newBoard[r2][c2] = { ...tmp, row: r2, col: c2 };
    return newBoard;
  };

  const findLines = (brd: Block[][]): [number, number][][] => {
    const lines: [number, number][][] = [];
    // Find horizontal lines
    for (let r = 0; r < numRows; r++) {
      let c = 0;
      while (c < numCols) {
        const color = brd[r][c]?.color;
        if (!color) {
          c++;
          continue;
        }
        let matchLength = 1;
        while (c + matchLength < numCols && brd[r][c + matchLength]?.color === color) {
          matchLength++;
        }
        if (matchLength >= 3) {
          const line: [number, number][] = [];
          for (let i = 0; i < matchLength; i++) {
            line.push([r, c + i]);
          }
          lines.push(line);
        }
        c += matchLength;
      }
    }
    // Find vertical lines
    for (let c = 0; c < numCols; c++) {
      let r = 0;
      while (r < numRows) {
        const color = brd[r][c]?.color;
        if (!color) {
          r++;
          continue;
        }
        let matchLength = 1;
        while (r + matchLength < numRows && brd[r + matchLength][c]?.color === color) {
          matchLength++;
        }
        if (matchLength >= 3) {
          const line: [number, number][] = [];
          for (let i = 0; i < matchLength; i++) {
            line.push([r + i, c]);
          }
          lines.push(line);
        }
        r += matchLength;
      }
    }
    return lines;
  };

  const clearAndDrop = (
    brd: Block[][],
    blocksToClear: Set<string>,
    specialBlock?: { pos: [number, number]; type: 'bomb' | 'color_bomb' }
  ) => {
    let newBoard = brd.map((row) => [...row]);
    let bombCreated = false;

    // Create special block if any
    if (specialBlock) {
      const [r, c] = specialBlock.pos;
      newBoard[r][c] = { ...newBoard[r][c], specialType: specialBlock.type, id: `bomb-${Math.random()}` };
      bombCreated = true;
    }

    // Clear matched blocks
    blocksToClear.forEach((key) => {
      const [r, c] = key.split(',').map(Number);
      if (specialBlock && r === specialBlock.pos[0] && c === specialBlock.pos[1] && bombCreated) {
        // Don't clear the block where the bomb was just placed
      } else {
        newBoard[r][c] = { ...newBoard[r][c], color: "", id: `empty-${Math.random()}` };
      }
    });

    // Gravity
    for (let c = 0; c < numCols; c++) {
      let emptyCount = 0;
      for (let r = numRows - 1; r >= 0; r--) {
        if (newBoard[r][c].color === "") {
          emptyCount++;
        } else if (emptyCount > 0) {
          newBoard[r + emptyCount][c] = { ...newBoard[r][c], row: r + emptyCount };
          newBoard[r][c] = { ...newBoard[r][c], color: "", id: `empty-${Math.random()}` };
        }
      }
      // Refill
      for (let r = 0; r < emptyCount; r++) {
        newBoard[r][c] = { color: randomColor(), id: `new-${Math.random()}`, row: r, col: c };
      }
    }

    return newBoard;
  };

  const getNeighbors = (r: number, c: number): [number, number][] => {
    const neighbors: [number, number][] = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
                neighbors.push([nr, nc]);
            }
        }
    }
    return neighbors;
  };

  const handlePress = (r: number, c: number) => {
    if (timeRemaining === 0) return; // Game over
    if (!selected) {
      setSelected([r, c]);
      return;
    }
    const [r1, c1] = selected;
    const [r2, c2] = [r, c];
    setSelected(null);

    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

    const swappedBoard = swap(board, r1, c1, r2, c2);
    let boardToProcess = swappedBoard;

    const processCascades = (initialBoard: Block[][]) => {
      let boardState = initialBoard;
      const loop = () => {
        const lines = findLines(boardState);
        if (lines.length === 0) {
          setBoard(boardState);
          return;
        }

        const blocksToClear = new Set<string>();
        lines.forEach(line => line.forEach(([lr, lc]) => blocksToClear.add(`${lr},${lc}`)));

        setScore(s => s + blocksToClear.size * 10);
        const nextBoard = clearAndDrop(boardState, blocksToClear);

        setTimeout(() => {
          boardState = nextBoard;
          setBoard(nextBoard);
          loop();
        }, duration);
      };
      loop();
    };

    const block1 = board[r1][c1];
    const block2 = board[r2][c2];
    const specialBlock = block1.specialType ? block1 : (block2.specialType ? block2 : null);
    const otherBlock = block1.specialType ? block2 : block1;

    if (specialBlock) {
      // Special Block Activation
      const blocksToClear = new Set<string>();
      blocksToClear.add(`${specialBlock.row},${specialBlock.col}`);

      if (specialBlock.specialType === 'bomb') {
        const neighbors = getNeighbors(specialBlock.row, specialBlock.col);
        neighbors.forEach(([nr, nc]) => blocksToClear.add(`${nr},${nc}`));
      } else if (specialBlock.specialType === 'color_bomb') {
        board.flat().forEach(b => {
          if (b.color === otherBlock.color) {
            blocksToClear.add(`${b.row},${b.col}`);
          }
        });
      }

      setBoard(swappedBoard); // show the swap first
      setTimeout(() => {
        setScore(s => s + blocksToClear.size * 10);
        const nextBoard = clearAndDrop(swappedBoard, blocksToClear);
        processCascades(nextBoard);
      }, duration);

    } else {
      // Normal Match
      const lines = findLines(swappedBoard);
      if (lines.length === 0) {
        setBoard(swappedBoard);
        setTimeout(() => setBoard(board), duration); // Swap back
        return;
      }

      let specialBlockToCreate: { pos: [number, number]; type: 'bomb' | 'color_bomb' } | undefined;
      const blocksToClear = new Set<string>();
      for (const line of lines) {
        const wasPartOfSwap = line.some(([lr, lc]) => (lr === r1 && lc === c1) || (lr === r2 && lc === c2));
        if (wasPartOfSwap) {
          const pos = line.find(([lr,lc]) => lr === r2 && lc === c2) ? [r2, c2] : [r1, c1];
          if (line.length >= 5) specialBlockToCreate = { pos, type: 'color_bomb' };
          else if (line.length === 4) specialBlockToCreate = { pos, type: 'bomb' };
        }
        line.forEach(([lr, lc]) => blocksToClear.add(`${lr},${lc}`));
      }

      setBoard(swappedBoard); // show the swap
      setTimeout(() => {
        setScore(s => s + blocksToClear.size * 10);
        const nextBoard = clearAndDrop(swappedBoard, blocksToClear, specialBlockToCreate);
        processCascades(nextBoard);
      }, duration);
    }
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
          backgroundColor: block.specialType === 'color_bomb' ? 'black' : (block.color || "black"),
          borderRadius: cellSize / 2,
          borderWidth: block.specialType === 'bomb' ? 4 : (selected ? 3 : 1),
          borderColor: block.specialType ? 'white' : (selected ? "white" : "rgba(0,0,0,0.2)"),
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