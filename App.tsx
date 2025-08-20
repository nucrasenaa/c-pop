import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

const numRows = 8;
const numCols = 8;
const colors = ["red", "blue", "green", "yellow", "purple"];
const duration = 200;

const cellSize = Math.floor(Dimensions.get("window").width / numCols);

let nextId = 0;
const getNextId = () => (nextId++).toString();

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

  useEffect(() => {
    resetBoard();
  }, []);

  const resetBoard = () => {
    const newBoard: Block[][] = [];
    for (let r = 0; r < numRows; r++) {
      const row: Block[] = [];
      for (let c = 0; c < numCols; c++) {
        row.push({ color: randomColor(), id: getNextId(), row: r, col: c });
      }
      newBoard.push(row);
    }
    setBoard(newBoard);
  };

  const swap = (r1: number, c1: number, r2: number, c2: number) => {
    const newBoard = board.map((row) => row.map((block) => ({ ...block })));
    const tmp = newBoard[r1][c1];
    newBoard[r1][c1] = { ...newBoard[r2][c2], row: r1, col: c1 };
    newBoard[r2][c2] = { ...tmp, row: r2, col: c2 };
    return newBoard;
  };

  const findMatches = (brd: Block[][]): Set<string> => {
    const matches = new Set<string>();
    // Find horizontal matches of 3 or more
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols - 2; ) {
        const color = brd[r][c].color;
        if (color && brd[r][c + 1].color === color && brd[r][c + 2].color === color) {
          let k = c + 3;
          while (k < numCols && brd[r][k].color === color) {
            k++;
          }
          for (let i = 0; i < k - c; i++) {
            matches.add(`${r},${c + i}`);
          }
          c = k;
        } else {
          c++;
        }
      }
    }
    // Find vertical matches of 3 or more
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < numRows - 2; ) {
        const color = brd[r][c].color;
        if (color && brd[r + 1][c].color === color && brd[r + 2][c].color === color) {
          let k = r + 3;
          while (k < numRows && brd[k][c].color === color) {
            k++;
          }
          for (let i = 0; i < k - r; i++) {
            matches.add(`${r + i},${c}`);
          }
          r = k;
        } else {
          r++;
        }
      }
    }
    return matches;
  };

  const clearAndDrop = (brd: Block[][], matches: Set<string>) => {
    const newBoard = brd.map((row) => row.map((block) => ({ ...block })));

    matches.forEach((match) => {
      const [r, c] = match.split(",").map(Number);
      newBoard[r][c].color = ""; // Mark as empty
    });

    // Gravity: drop blocks down
    for (let c = 0; c < numCols; c++) {
      let writeRow = numRows - 1;
      for (let readRow = numRows - 1; readRow >= 0; readRow--) {
        if (newBoard[readRow][c].color !== "") {
          if (writeRow !== readRow) {
            newBoard[writeRow][c] = { ...newBoard[readRow][c], row: writeRow };
          }
          writeRow--;
        }
      }
      // Fill empty spaces at the top
      for (let r = writeRow; r >= 0; r--) {
        newBoard[r][c] = {
          id: getNextId(),
          color: randomColor(),
          row: r,
          col: c,
        };
      }
    }
    return newBoard;
  };

  const handlePress = (r: number, c: number) => {
    if (selected === null) {
      setSelected([r, c]);
      return;
    }

    const [r1, c1] = selected;
    setSelected(null);

    // Check for adjacent selection
    if (Math.abs(r1 - r) + Math.abs(c1 - c) !== 1) {
      return;
    }

    const swappedBoard = swap(r1, c1, r, c);
    const initialMatches = findMatches(swappedBoard);

    if (initialMatches.size === 0) {
      // No match, animate swap and swap back
      setBoard(swappedBoard);
      setTimeout(() => setBoard(board), duration);
      return;
    }

    // Matches found, start clearing and dropping
    const processMatches = (currentBoard: Block[][]) => {
      const matches = findMatches(currentBoard);
      if (matches.size > 0) {
        const nextBoard = clearAndDrop(currentBoard, matches);
        setBoard(nextBoard);
        // Use timeout to allow animation and create a cascading effect
        setTimeout(() => processMatches(nextBoard), duration * 2);
      }
    };

    setBoard(swappedBoard);
    setTimeout(() => processMatches(swappedBoard), duration);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
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
          borderRadius: 6,
          borderWidth: selected ? 3 : 0,
          borderColor: "white",
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },
});