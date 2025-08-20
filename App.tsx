import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Text, Modal, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

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
  specialType?: 'bomb' | 'color_bomb' | 'screen_clear';
};

export default function App() {
  const [board, setBoard] = useState<Block[][]>([]);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [destroyingBlocks, setDestroyingBlocks] = useState<Set<string>>(new Set());
  const [isGameOver, setIsGameOver] = useState(false);
  const [announcement, setAnnouncement] = useState<{ text: string, key: number } | null>(null);
  const [comboResetTimer, setComboResetTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    resetBoard();
  }, []);

  useEffect(() => {
    if (isGameOver) return;

    if (timeRemaining <= 0) {
      setIsGameOver(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, isGameOver]);

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

  const findMatches = (brd: Block[][]): [number, number][][] => {
    const matches: [number, number][][] = [];
    const visited: boolean[][] = Array(numRows).fill(false).map(() => Array(numCols).fill(false));

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (visited[r][c] || !brd[r][c]?.color) continue;

        const color = brd[r][c].color;
        const currentGroup: [number, number][] = [];
        const queue: [number, number][] = [[r, c]];
        visited[r][c] = true;

        while (queue.length > 0) {
          const [currR, currC] = queue.shift()!;
          currentGroup.push([currR, currC]);

          const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (const [dr, dc] of neighbors) {
            const nextR = currR + dr;
            const nextC = currC + dc;

            if (
              nextR >= 0 && nextR < numRows &&
              nextC >= 0 && nextC < numCols &&
              !visited[nextR][nextC] &&
              brd[nextR][nextC]?.color === color
            ) {
              visited[nextR][nextC] = true;
              queue.push([nextR, nextC]);
            }
          }
        }

        if (currentGroup.length >= 3) {
          matches.push(currentGroup);
        }
      }
    }
    return matches;
  };

  const clearAndDrop = (
    brd: Block[][],
    blocksToClear: Set<string>,
    specialBlock?: { pos: [number, number]; type: 'bomb' | 'color_bomb' | 'screen_clear' }
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

  const resetGame = () => {
    setScore(0);
    setTimeRemaining(60);
    setComboMultiplier(1);
    setMaxCombo(1);
    resetBoard();
    setIsGameOver(false);
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

  const handleSwipe = (r1: number, c1: number, direction: 'up' | 'down' | 'left' | 'right') => {
    if (timeRemaining === 0) return; // Game over

    let r2 = r1, c2 = c1;
    switch (direction) {
      case 'up': r2--; break;
      case 'down': r2++; break;
      case 'left': c2--; break;
      case 'right': c2++; break;
    }

    if (r2 < 0 || r2 >= numRows || c2 < 0 || c2 >= numCols) {
      return; // Invalid swipe off board
    }

    const swappedBoard = swap(board, r1, c1, r2, c2);
    let boardToProcess = swappedBoard;

    const handleMatch = (isFirstMatch: boolean) => {
      if (comboResetTimer) clearTimeout(comboResetTimer);

      const newCombo = isFirstMatch ? Math.min(comboMultiplier + 1, 99) : comboMultiplier + 1;
      setComboMultiplier(newCombo);
      setMaxCombo(prevMax => Math.max(prevMax, newCombo));

      if (newCombo > 1 && newCombo % 10 === 9) {
        setAnnouncement({ text: `${newCombo} Combo!`, key: Math.random() });
      }

      const newTimer = setTimeout(() => {
        setComboMultiplier(1);
      }, 2000);
      setComboResetTimer(newTimer);
      return newCombo;
    };

    const processCascades = (initialBoard: Block[][]) => {
      let boardState = initialBoard;
      const loop = () => {
        const matches = findMatches(boardState);
        if (matches.length === 0) {
          setBoard(boardState);
          return;
        }

        const currentCombo = handleMatch(false);

        const blocksToClear = new Set<string>();
        matches.forEach(match => match.forEach(([lr, lc]) => blocksToClear.add(`${lr},${lc}`)));

        setScore(s => s + blocksToClear.size * 10 * currentCombo);
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
      const blocksToClearCoords = new Set<string>();
      blocksToClearCoords.add(`${specialBlock.row},${specialBlock.col}`);

      if (specialBlock.specialType === 'bomb') {
        const neighbors = getNeighbors(specialBlock.row, specialBlock.col);
        neighbors.forEach(([nr, nc]) => blocksToClearCoords.add(`${nr},${nc}`));
      } else if (specialBlock.specialType === 'color_bomb') {
        board.flat().forEach(b => {
          if (b.color === otherBlock.color) {
            blocksToClearCoords.add(`${b.row},${b.col}`);
          }
        });
      } else if (specialBlock.specialType === 'screen_clear') {
        const allBlockCoords = new Set<string>();
        board.flat().forEach(b => {
          if (b.color) allBlockCoords.add(`${b.row},${b.col}`);
        });

        const blocksByRow: string[][] = Array(numRows).fill(0).map(() => []);
        board.flat().forEach(b => {
          if(b.color) blocksByRow[b.row].push(b.id);
        });

        const waveDelay = 50;
        for (let i = 0; i < blocksByRow.length; i++) {
          setTimeout(() => {
            setDestroyingBlocks(prev => new Set([...prev, ...blocksByRow[i]]));
          }, i * waveDelay);
        }

        setBoard(swappedBoard); // show the swap first
        setTimeout(() => {
          const newCombo = Math.min(comboMultiplier + 1, 99);
          setComboMultiplier(newCombo);
          setMaxCombo(prevMax => Math.max(prevMax, newCombo));
          setScore(s => s + allBlockCoords.size * 10 * comboMultiplier);

          const nextBoard = clearAndDrop(swappedBoard, allBlockCoords);
          setDestroyingBlocks(new Set());
          processCascades(nextBoard);
        }, (blocksByRow.length * waveDelay) + duration);
        return; // Return early to prevent double processing
      }

      const blockIdsToDestroy = new Set(
        board.flat().filter(b => blocksToClearCoords.has(`${b.row},${b.col}`)).map(b => b.id)
      );
      setDestroyingBlocks(blockIdsToDestroy);

      setBoard(swappedBoard); // show the swap first
      setTimeout(() => {
        const currentCombo = handleMatch(true);
        setScore(s => s + blocksToClearCoords.size * 10 * currentCombo);

        const nextBoard = clearAndDrop(swappedBoard, blocksToClearCoords);
        setDestroyingBlocks(new Set());
        processCascades(nextBoard);
      }, duration);

    } else {
      // Normal Match
      const matches = findMatches(swappedBoard);
      if (matches.length === 0) {
        setBoard(swappedBoard);
        setTimeout(() => setBoard(board), duration); // Swap back. No combo reset here anymore.
        return;
      }

      let specialBlockToCreate: { pos: [number, number]; type: 'bomb' | 'color_bomb' | 'screen_clear' } | undefined;
      const blocksToClear = new Set<string>();
      for (const match of matches) {
        const wasPartOfSwap = match.some(([lr, lc]) => (lr === r1 && lc === c1) || (lr === r2 && lc === c2));
        if (wasPartOfSwap) {
          const pos = match.find(([lr,lc]) => lr === r2 && lc === c2) ? [r2, c2] : [r1, c1];
          if (match.length >= 5) {
            // Check for T/L shape vs line
            let minR = numRows, maxR = -1, minC = numCols, maxC = -1;
            match.forEach(([r, c]) => {
              minR = Math.min(minR, r);
              maxR = Math.max(maxR, r);
              minC = Math.min(minC, c);
              maxC = Math.max(maxC, c);
            });
            const height = maxR - minR + 1;
            const width = maxC - minC + 1;
            if (height > 1 && width > 1) {
              specialBlockToCreate = { pos, type: 'screen_clear' };
            } else {
              specialBlockToCreate = { pos, type: 'color_bomb' };
            }
          }
          else if (match.length === 4) specialBlockToCreate = { pos, type: 'bomb' };
        }
        match.forEach(([lr, lc]) => blocksToClear.add(`${lr},${lc}`));
      }

      setBoard(swappedBoard); // show the swap
      setTimeout(() => {
        const currentCombo = handleMatch(true);
        setScore(s => s + blocksToClear.size * 10 * currentCombo);

        const nextBoard = clearAndDrop(swappedBoard, blocksToClear, specialBlockToCreate);
        processCascades(nextBoard);
      }, duration);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.topHud}>
        <Text style={styles.scoreText}>Score: {score}</Text>
        {comboMultiplier > 1 && <Text style={styles.comboText}>x{comboMultiplier}</Text>}
      </View>
      <View style={styles.boardContainer}>
        <FloatingText announcement={announcement} onAnimationComplete={() => setAnnouncement(null)} />
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
              onSwipe={(direction) => handleSwipe(block.row, block.col, direction)}
              isBeingDestroyed={destroyingBlocks.has(block.id)}
            />
          ))}
        </View>
      </View>
      <Text style={styles.timerText}>Time: {timeRemaining}</Text>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isGameOver}
        onRequestClose={() => { /* Do nothing */ }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Game Over</Text>
            <Text style={styles.modalText}>Final Score: {score}</Text>
            <Text style={styles.modalText}>Max Combo: x{maxCombo}</Text>
            <TouchableOpacity style={styles.playAgainButton} onPress={resetGame}>
              <Text style={styles.playAgainButtonText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
  );
}

function BlockView({ block, onSwipe, isBeingDestroyed }: { block: Block; onSwipe: (direction: 'up' | 'down' | 'left' | 'right') => void; isBeingDestroyed: boolean; }) {
  const x = useSharedValue(block.col * cellSize);
  const y = useSharedValue(block.row * cellSize);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    x.value = withTiming(block.col * cellSize, { duration });
    y.value = withSpring(block.row * cellSize);
  }, [block.row, block.col]);

  useEffect(() => {
    if (isBeingDestroyed) {
      scale.value = withTiming(0, { duration });
      opacity.value = withTiming(0, { duration });
    }
  }, [isBeingDestroyed]);

  const styleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const panGesture = Gesture.Pan()
    .onEnd((e) => {
      const { translationX, translationY } = e;
      const swipeThreshold = cellSize / 4;

      if (Math.abs(translationX) > swipeThreshold || Math.abs(translationY) > swipeThreshold) {
        if (Math.abs(translationX) > Math.abs(translationY)) {
          runOnJS(onSwipe)(translationX > 0 ? 'right' : 'left');
        } else {
          runOnJS(onSwipe)(translationY > 0 ? 'down' : 'up');
        }
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          {
            width: cellSize,
            height: cellSize,
            position: "absolute",
            top: 0,
            left: 0,
          },
          styleAnim,
        ]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: block.specialType === 'screen_clear' ? '#9400D3' : (block.specialType === 'color_bomb' ? 'black' : (block.color || "black")),
            borderRadius: cellSize / 2,
            borderWidth: block.specialType === 'bomb' ? 4 : 1,
            borderColor: block.specialType ? 'white' : "rgba(0,0,0,0.2)",
          }}
        />
      </Animated.View>
    </GestureDetector>
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
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  comboText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFD700', // Gold color for combo
    marginLeft: 10,
  },
  timerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: '100%',
    height: '100%',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  playAgainButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginTop: 10,
  },
  playAgainButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 18,
    paddingHorizontal: 20,
  },
  announcementText: {
    position: 'absolute',
    fontSize: 28,
    fontWeight: 'bold',
    color: 'yellow',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  }
});

function FloatingText({ announcement, onAnimationComplete }: { announcement: { text: string, key: number } | null, onAnimationComplete: () => void }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (announcement) {
      translateY.value = 0;
      opacity.value = 1;
      translateY.value = withTiming(-100, { duration: 1500 });
      opacity.value = withTiming(0, { duration: 1500 }, (finished) => {
        if (finished) {
          runOnJS(onAnimationComplete)();
        }
      });
    }
  }, [announcement]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    };
  });

  if (!announcement) return null;

  return (
    <Animated.View style={[styles.announcementText, animatedStyle]}>
      <Text style={styles.announcementText}>{announcement.text}</Text>
    </Animated.View>
  );
}