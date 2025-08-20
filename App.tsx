import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from "react-native-reanimated";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";

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
  status: "idle" | "clearing";
};

export default function App() {
  const [board, setBoard] = useState<Block[][]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [lineFlashes, setLineFlashes] = useState<{ key: number; type: "row" | "col"; index: number }[]>([]);

  useEffect(() => {
    resetBoard();
  }, []);

  const resetBoard = () => {
    const newBoard: Block[][] = [];
    for (let r = 0; r < numRows; r++) {
      const row: Block[] = [];
      for (let c = 0; c < numCols; c++) {
        row.push({
          color: randomColor(),
          id: getNextId(),
          row: r,
          col: c,
          specialType: null,
          status: "idle",
        });
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

  const markBlocksForClearing = (
    brd: Block[][],
    blocksToClear: Set<string>,
    specialBlockToCreate: { pos: string; type: "line_clear" | "color_bomb" } | null
  ) => {
    const newBoard = brd.map((row) => row.map((block) => ({ ...block })));
    if (specialBlockToCreate) {
      const [r, c] = specialBlockToCreate.pos.split(",").map(Number);
      newBoard[r][c].specialType = specialBlockToCreate.type;
      if (specialBlockToCreate.type === "color_bomb") {
        newBoard[r][c].color = "white";
      }
    }

    blocksToClear.forEach((pos) => {
      if (specialBlockToCreate && specialBlockToCreate.pos === pos) {
        return;
      }
      const [r, c] = pos.split(",").map(Number);
      newBoard[r][c].status = "clearing";
    });

    return newBoard;
  };

  const handleDropAndRefill = (brd: Block[][]) => {
    const newBoard = brd.map((row) => row.map((block) => ({ ...block })));

    // 1. Turn clearing blocks into empty blocks
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (newBoard[r][c].status === "clearing") {
          newBoard[r][c].color = "";
          newBoard[r][c].status = "idle";
          newBoard[r][c].specialType = null;
        }
      }
    }

    // 2. Gravity and refill
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
      for (let r = writeRow; r >= 0; r--) {
        newBoard[r][c] = {
          id: getNextId(),
          color: randomColor(),
          row: r,
          col: c,
          specialType: null,
          status: "idle",
        };
      }
    }
    return newBoard;
  };

  const handleSwap = (r1: number, c1: number, r2: number, c2: number) => {
    if (r2 < 0 || r2 >= numRows || c2 < 0 || c2 >= numCols) {
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
        const boardWithClearing = markBlocksForClearing(boardToProcess, matchesToProcess, null);
        setBoard(boardWithClearing);

        setTimeout(() => {
          const boardAfterDrop = handleDropAndRefill(boardWithClearing);
          const nextMatches = findMatches(boardAfterDrop);
          if (nextMatches.size > 0) {
            currentCombo++;
            setCombo(currentCombo);
            processBomb(boardAfterDrop, nextMatches);
          } else {
            setBoard(boardAfterDrop);
          }
        }, duration);
      };

      processBomb(board, blocksToClear);
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
    let flashKey = 0;

    const processMatches = (
      boardToProcess: Block[][],
      matchesToProcess: Set<string>,
      isInitial: boolean
    ) => {
      let specialBlockInfo: { pos: string; type: "line_clear" | "color_bomb" } | null = null;
      if (isInitial) {
        if (matchesToProcess.size === 4) {
          specialBlockInfo = { pos: `${r2},${c2}`, type: "line_clear" };
        } else if (matchesToProcess.size >= 5) {
          specialBlockInfo = { pos: `${r2},${c2}`, type: "color_bomb" };
        }
      }

      let blocksToClear = new Set(matchesToProcess);
      const flashesToCreate: { key: number; type: "row" | "col"; index: number }[] = [];

      matchesToProcess.forEach((matchPos) => {
        const [mr, mc] = matchPos.split(",").map(Number);
        const block = boardToProcess[mr][mc];
        if (block.specialType === "line_clear") {
          flashesToCreate.push({ key: flashKey++, type: "row", index: mr });
          flashesToCreate.push({ key: flashKey++, type: "col", index: mc });
          for (let i = 0; i < numCols; i++) blocksToClear.add(`${mr},${i}`);
          for (let i = 0; i < numRows; i++) blocksToClear.add(`${i},${mc}`);
        }
      });

      const continueAfterPop = (boardAfterDrop: Block[][]) => {
        const nextMatches = findMatches(boardAfterDrop);
        if (nextMatches.size > 0) {
          currentCombo++;
          setCombo(currentCombo);
          processMatches(boardAfterDrop, nextMatches, false);
        } else {
          setBoard(boardAfterDrop);
        }
      };

      const continueAfterFlash = () => {
        setLineFlashes([]);
        setScore((prev) => prev + blocksToClear.size * 10 * currentCombo);
        const boardWithClearing = markBlocksForClearing(boardToProcess, blocksToClear, specialBlockInfo);
        setBoard(boardWithClearing);
        setTimeout(() => continueAfterPop(handleDropAndRefill(boardWithClearing)), duration);
      };

      if (flashesToCreate.length > 0) {
        setLineFlashes(flashesToCreate);
        setTimeout(continueAfterFlash, 150);
      } else {
        continueAfterFlash();
      }
    };

    processMatches(swappedBoard, initialMatches, true);
  };

  const panGesture = Gesture.Pan().onEnd((event) => {
    const { translationX, translationY, absoluteX, absoluteY } = event;
    // This needs adjustment, the event coords are absolute, not relative to the board
    // For now, assuming the board is centered and taking up most of the screen
    // A more robust solution would use measurements.
    const startC = Math.floor((absoluteX - (Dimensions.get("window").width - numCols * cellSize) / 2) / cellSize);
    const startR = Math.floor((absoluteY - (Dimensions.get("window").height - numRows * cellSize) / 2) / cellSize);


    const absX = Math.abs(translationX);
    const absY = Math.abs(translationY);

    if (absX < 20 && absY < 20) return; // Not a swipe

    let endR = startR;
    let endC = startC;

    if (absX > absY) {
      endC = translationX > 0 ? startC + 1 : startC - 1;
    } else {
      endR = translationY > 0 ? startR + 1 : startR - 1;
    }
    handleSwap(startR, startC, endR, endC);
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
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
              <BlockView key={block.id} block={block} />
            ))}
            {lineFlashes.map((flash) => (
              <Flash key={flash.key} type={flash.type} index={flash.index} />
            ))}
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function BlockView({ block }: { block: Block }) {
  const x = useSharedValue(block.col * cellSize);
  const y = useSharedValue(block.row * cellSize);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    x.value = withTiming(block.col * cellSize, { duration });
    y.value = withTiming(block.row * cellSize, { duration });
  }, [block.row, block.col]);

  useEffect(() => {
    if (block.status === "clearing") {
      scale.value = withTiming(0, { duration });
      opacity.value = withTiming(0, { duration });
    }
  }, [block.status]);

  const styleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    opacity: opacity.value,
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
          zIndex: 0,
        },
        styleAnim,
      ]}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: block.color || "black",
          borderRadius: 6,
          borderWidth: isLineClear || isColorBomb ? 3 : 0,
          borderColor: isLineClear ? "white" : isColorBomb ? "#ffc107" : "white",
          transform: [{ rotate: isLineClear ? "45deg" : "0deg" }],
        }}
      />
      {isColorBomb && <View style={styles.colorBombCore} />}
    </Animated.View>
  );
}

const Flash = ({ type, index }: { type: "row" | "col"; index: number }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0.7);
  const flashDuration = 150;

  useEffect(() => {
    scale.value = withTiming(1, { duration: flashDuration });
    opacity.value = withDelay(flashDuration * 0.5, withTiming(0, { duration: flashDuration * 0.5 }));
  }, []);

  const style = useAnimatedStyle(() => {
    const positionStyle =
      type === "row"
        ? { top: index * cellSize, left: 0, right: 0, height: cellSize }
        : { left: index * cellSize, top: 0, bottom: 0, width: cellSize };
    return {
      position: "absolute",
      backgroundColor: "white",
      opacity: opacity.value,
      ...positionStyle,
      transform: [type === "row" ? { scaleX: scale.value } : { scaleY: scale.value }],
    };
  });

  return <Animated.View style={style} />;
};

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