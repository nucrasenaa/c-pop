import React, { useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Svg, Polygon, Circle } from "react-native-svg";

// --- Hex Grid Constants ---
const numCols = 7; // The number of columns in the hexagonal grid
const numRows = 8; // The number of rows in the hexagonal grid
const hexSize = Math.floor(Dimensions.get("window").width / (numCols * 1.8)); // Adjust size for screen fit
const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FED766", "#9B59B6"];
const duration = 200;

// --- Hex Grid Utility Functions (Axial Coordinates) ---

// Function to get points for a pointy-topped hexagon polygon
function getHexagonPoints(size: number) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

const hexWidth = Math.sqrt(3) * hexSize;
const hexHeight = 2 * hexSize;

// Function to convert axial coordinates to pixel coordinates for pointy-topped hexes
function axialToPixel(q: number, r: number) {
  const x = hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = hexSize * ((3 / 2) * r);
  return { x, y };
}

// Function to calculate axial distance between two hexes
function axialDistance(q1: number, r1: number, q2: number, r2: number) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

function areNeighbors(q1: number, r1: number, q2: number, r2: number) {
  return axialDistance(q1, r1, q2, r2) === 1;
}

function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

type Block = {
  id: string;
  color: string;
  q: number; // Axial coordinate q
  r: number; // Axial coordinate r
};

export default function App() {
  const [board, setBoard] = useState<Block[]>([]);
  const [selected, setSelected] = useState<{ q: number; r: number } | null>(null);

  useEffect(() => {
    resetBoard();
  }, []);

  const resetBoard = () => {
    const newBoard: Block[] = [];
    // Create a rectangular map of hexagons
    for (let r = 0; r < numRows; r++) {
      const rOffset = Math.floor(r / 2.0);
      for (let q = -rOffset; q < numCols - rOffset; q++) {
         newBoard.push({
          color: randomColor(),
          id: `${q}-${r}-${Math.random()}`,
          q,
          r,
        });
      }
    }
    setBoard(newBoard);
  };

  // --- Game Logic (To be implemented for Hex Grid) ---

  const swapBlocks = (brd: Block[], q1: number, r1: number, q2: number, r2: number) => {
    const block1Index = brd.findIndex(b => b.q === q1 && b.r === r1);
    const block2Index = brd.findIndex(b => b.q === q2 && b.r === r2);
    if (block1Index === -1 || block2Index === -1) return brd;

    const newBoard = [...brd];
    const temp = newBoard[block1Index];
    newBoard[block1Index] = { ...newBoard[block2Index], q: q1, r: r1 };
    newBoard[block2Index] = { ...temp, q: q2, r: r2 };
    return newBoard;
  };

  const getBlock = (brd: Block[], q: number, r: number) => brd.find(b => b.q === q && b.r === r);

  const findMatches = (brd: Block[]) => {
    const matches = new Set<string>();

    // Directions for checking lines in a hex grid (3 axes)
    const directions = [
      { q: 1, r: 0 }, // Horizontal
      { q: 0, r: 1 }, // Diagonal
      { q: 1, r: -1 }, // Other Diagonal
    ];

    for (const block of brd) {
      if (!block.color) continue;

      for (const dir of directions) {
        const line = [block];
        // Check in positive direction
        for (let i = 1; i < Math.max(numCols, numRows); i++) {
          const next = getBlock(brd, block.q + dir.q * i, block.r + dir.r * i);
          if (next && next.color === block.color) line.push(next);
          else break;
        }

        if (line.length >= 3) {
          line.forEach(b => matches.add(b.id));
        }
      }
    }
    return brd.filter(b => matches.has(b.id));
  };

  const clearAndDrop = (brd: Block[], matches: Block[]) => {
    let newBoard = [...brd];
    const matchIds = new Set(matches.map(b => b.id));

    // 1. Remove matched blocks
    newBoard = newBoard.filter(b => !matchIds.has(b.id));

    // 2. Gravity: Blocks fall down in their columns (constant q)
    const columns = new Map<number, Block[]>();
    for (const block of newBoard) {
      if (!columns.has(block.q)) columns.set(block.q, []);
      columns.get(block.q)!.push(block);
    }

    let droppedBoard: Block[] = [];
    for (const [q, blocks] of columns.entries()) {
      // For each column, sort blocks by r to know their vertical order
      blocks.sort((a, b) => a.r - b.r);

      const qOffset = Math.floor(q / 2.0);
      const minR = -qOffset;

      // Re-assign 'r' values from the top of the column
      for(let i=0; i < blocks.length; i++) {
        const newR = minR + i;
        droppedBoard.push({ ...blocks[i], r: newR });
      }
    }

    // 3. Refill board
    let finalBoard = [...droppedBoard];
    for (let q = 0; q < numCols; q++) {
        const qOffset = Math.floor(q / 2.0);
        const minR = -qOffset;
        const colBlocks = finalBoard.filter(b => b.q === q);
        const colSize = colBlocks.length;

        const fillCount = numRows - colSize;
        for (let i=0; i<fillCount; i++) {
            finalBoard.push({
                q,
                r: minR - 1 - i, // Place new blocks above the visible area
                color: randomColor(),
                id: `new-${q}-${i}-${Math.random()}`
            });
        }
    }

    // Animate the new blocks into place
    const finalBoardWithCorrectR = finalBoard.map(block => {
        if(block.id.startsWith("new-")) {
            const qOffset = Math.floor(block.q / 2.0);
            const colBlocks = finalBoard.filter(b => b.q === block.q && !b.id.startsWith("new-"));
            const highestR = colBlocks.reduce((maxR, b) => Math.min(maxR, b.r), -qOffset);
            const newR = highestR - 1;
            const existingRsInCol = colBlocks.map(b => b.r);
            let finalR = newR;
            while(existingRsInCol.includes(finalR)) {
                finalR--;
            }
            // This is getting complicated. Let's simplify the drop logic.
            // For now, let's just re-calculate all 'r' values after a drop.
        }
        return block;
    })


    // Let's try a simpler gravity model.
    const boardAfterClear = brd.filter(b => !matchIds.has(b.id));
    const finalBoardSimple: Block[] = [];

    for (let q = 0; q < numCols; q++) {
        const qOffset = Math.floor(q / 2.0);
        const startR = -qOffset;
        const endR = numRows - qOffset -1;

        const column = boardAfterClear.filter(b => b.q === q).sort((a,b) => b.r - a.r); // from bottom to top
        let currentR = endR;

        for(const block of column) {
            finalBoardSimple.push({ ...block, r: currentR });
            currentR--;
        }

        // Refill
        const fillCount = numRows - column.length;
        for(let i=0; i<fillCount; i++) {
            finalBoardSimple.push({
                q,
                r: currentR,
                color: randomColor(),
                id: `new-${q}-${i}-${Math.random()}`
            })
            currentR--;
        }
    }

    return finalBoardSimple;
  };

  const handlePress = (q: number, r: number) => {
    if (!selected) {
      setSelected({ q, r });
      return;
    }

    const { q: q1, r: r1 } = selected;
    const { q: q2, r: r2 } = { q, r };
    setSelected(null);

    if (!areNeighbors(q1, r1, q2, r2)) {
      return;
    }

    // Optimistically swap
    const swappedBoard = swapBlocks(board, q1, r1, q2, r2);
    setBoard(swappedBoard);

    // Check for matches
    const matches = findMatches(swappedBoard);
    if (matches.length === 0) {
      // If no matches, swap back after a delay
      setTimeout(() => {
        setBoard(board); // Revert to original board state
      }, duration * 2);
      return;
    }

    // Cascading matches
    let boardAfterSwap = swappedBoard;
    let matchesFound = findMatches(boardAfterSwap);

    const handleMatches = () => {
      if (matchesFound.length > 0) {
        const clearedBoard = clearAndDrop(boardAfterSwap, matchesFound);

        setTimeout(() => {
          setBoard(clearedBoard);
          boardAfterSwap = clearedBoard;
          matchesFound = findMatches(clearedBoard);
          handleMatches(); // Check for new matches
        }, duration * 2);

      }
    };

    handleMatches();
  };

  // Calculate board dimensions for centering
  const boardWidth = (numCols + 0.5) * hexWidth;
  const boardHeight = (numRows + 0.5) * hexHeight * 0.75;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View
        style={{
          width: boardWidth,
          height: boardHeight,
          position: "relative",
        }}
      >
        {board.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            selected={selected && selected.q === block.q && selected.r === block.r}
            onPress={() => handlePress(block.q, block.r)}
          />
        ))}
      </View>
    </View>
  );
}

function BlockView({ block, selected, onPress }: { block: Block; selected: boolean; onPress: () => void }) {
  // Add a small offset to center the grid visually
  const pixel = axialToPixel(block.q, block.r);
  const x = pixel.x + hexWidth / 2;
  const y = pixel.y + hexHeight / 4;

  const animatedX = useSharedValue(x);
  const animatedY = useSharedValue(y);

  useEffect(() => {
    animatedX.value = withTiming(x, { duration });
    animatedY.value = withTiming(y, { duration });
  }, [block.q, block.r, x, y]);

  const styleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedX.value }, { translateY: animatedY.value }],
  }));

  const hexagonPoints = getHexagonPoints(hexSize);

  return (
    <Animated.View
      style={[
        {
          width: hexWidth,
          height: hexHeight,
          position: "absolute",
          zIndex: selected ? 1 : 0,
        },
        styleAnim,
      ]}
    >
      <Pressable onPress={onPress} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Svg height={hexHeight} width={hexWidth} >
            <Polygon
              points={hexagonPoints}
              fill={block.color}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="2"
              transform={`translate(${hexWidth/2}, ${hexHeight/2})`}
            />
             <Circle
              cx={hexWidth / 2}
              cy={hexHeight / 2}
              r={hexSize * 0.6}
              fill={block.color}
              stroke={selected ? "white" : "rgba(255,255,255,0.5)"}
              strokeWidth={selected ? 3 : 2}
            />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#87CEEB", // A cheerful sky blue
    justifyContent: "center",
    alignItems: "center",
  },
});