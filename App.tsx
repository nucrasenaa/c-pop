import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, Text } from "react-native";
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
  specialType: "line_clear" | "color_bomb" | null;
};

export default function App() {
  const [board, setBoard] = useState<Block[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);

  useEffect(() => {
    resetBoard();
  }, []);

  const resetBoard = () => {
    const newBoard: Block[][] = [];
    for (let r = 0; r < numRows; r++) {
      const row: Block[] = [];
      for (let c = 0; c < numCols; c++) {
        row.push({ color: randomColor(), id: getNextId(), row: r, col: c, specialType: null });
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

  const clearAndDrop = (
    brd: Block[][],
    matches: Set<string>,
    specialBlockToCreate: { pos: string; type: "line_clear" | "color_bomb" } | null
  ) => {
    const newBoard = brd.map((row) => row.map((block) => ({ ...block })));

    if (specialBlockToCreate) {
      const [r, c] = specialBlockToCreate.pos.split(",").map(Number);
      newBoard[r][c].specialType = specialBlockToCreate.type;
      // Make the color bomb visually distinct by making it colorless
      if (specialBlockToCreate.type === "color_bomb") {
        newBoard[r][c].color = "white";
      }
    }

    matches.forEach((match) => {
      if (specialBlockToCreate && specialBlockToCreate.pos === match) {
        return; // Don't clear the block that is becoming special
      }
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
          specialType: null,
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
    const r2 = r,
      c2 = c;
    setSelected(null);

    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) {
      return;
    }

    const block1 = board[r1][c1];
    const block2 = board[r2][c2];

    // --- Color Bomb Activation Logic ---
    let colorToClear: string | null = null;
    if (block1.specialType === "color_bomb" && block1.color) colorToClear = block2.color;
    if (block2.specialType === "color_bomb" && block2.color) colorToClear = block1.color;

    if (colorToClear) {
      const bombPosition = block1.specialType === "color_bomb" ? `${r1},${c1}` : `${r2},${c2}`;
      const blocksToClear = new Set<string>([bombPosition]);
      board.flat().forEach((block) => {
        if (block.color === colorToClear) {
          blocksToClear.add(`${block.row},${block.col}`);
        }
      });

      let currentCombo = 1;
      setCombo(currentCombo);

      const processBomb = (boardToProcess: Block[][], matchesToProcess: Set<string>) => {
        setScore((prev) => prev + matchesToProcess.size * 10 * currentCombo);
        const nextBoard = clearAndDrop(boardToProcess, matchesToProcess, null);
        setBoard(nextBoard);
        const nextMatches = findMatches(nextBoard);
        if (nextMatches.size > 0) {
          currentCombo++;
          setCombo(currentCombo);
          setTimeout(() => processBomb(nextBoard, nextMatches), duration * 2);
        }
      };

      setTimeout(() => processBomb(board, blocksToClear), duration);
      return;
    }
    // --- End of Color Bomb Logic ---

    const swappedBoard = swap(r1, c1, r2, c2);
    const initialMatches = findMatches(swappedBoard);

    if (initialMatches.size === 0) {
      setBoard(swappedBoard);
      setTimeout(() => setBoard(board), duration);
      return;
    }

    setBoard(swappedBoard);

    let currentCombo = 1;
    setCombo(currentCombo);

    let specialBlockInfo: { pos: string; type: "line_clear" | "color_bomb" } | null = null;
    if (initialMatches.size === 4) {
      specialBlockInfo = { pos: `${r2},${c2}`, type: "line_clear" };
    } else if (initialMatches.size >= 5) {
      specialBlockInfo = { pos: `${r2},${c2}`, type: "color_bomb" };
    }

    const processMatches = (
      boardToProcess: Block[][],
      matchesToProcess: Set<string>,
      isInitial: boolean
    ) => {
      // --- Line Clear Activation Logic ---
      let blocksToClear = new Set(matchesToProcess);
      matchesToProcess.forEach((matchPos) => {
        const [mr, mc] = matchPos.split(",").map(Number);
        const block = boardToProcess[mr][mc];
        if (block.specialType === "line_clear") {
          for (let i = 0; i < numCols; i++) blocksToClear.add(`${mr},${i}`);
          for (let i = 0; i < numRows; i++) blocksToClear.add(`${i},${mc}`);
        }
      });
      // --- End of Line Clear Logic ---

      setScore((prev) => prev + blocksToClear.size * 10 * currentCombo);

      const special = isInitial ? specialBlockInfo : null;
      const nextBoard = clearAndDrop(boardToProcess, blocksToClear, special);
      setBoard(nextBoard);

      const nextMatches = findMatches(nextBoard);

      if (nextMatches.size > 0) {
        currentCombo++;
        setCombo(currentCombo);
        setTimeout(() => processMatches(nextBoard, nextMatches, false), duration * 2);
      }
    };

    setTimeout(() => processMatches(swappedBoard, initialMatches, true), duration);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.scoreText}>Score: {score}</Text>
      {combo > 1 && <Text style={styles.comboText}>Combo x{combo}!</Text>}
      <View
        style={{
          width: cellSize * numCols,
          height: cellSize * numRows,
          position: "relative",
          marginTop: 20,
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

  const isLineClear = block.specialType === "line_clear";
  const isColorBomb = block.specialType === "color_bomb";

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
          borderWidth: selected ? 3 : isLineClear || isColorBomb ? 3 : 0,
          borderColor: isLineClear ? "white" : isColorBomb ? "#ffc107" : "white",
          transform: [{ rotate: isLineClear ? "45deg" : "0deg" }],
        }}
      />
      {isColorBomb && <View style={styles.colorBombCore} />}
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
  scoreText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  comboText: {
    color: "#ffc107",
    fontSize: 28,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  colorBombCore: {
    position: "absolute",
    top: "40%",
    left: "40%",
    width: "20%",
    height: "20%",
    backgroundColor: "white",
    borderRadius: 10,
  },
});