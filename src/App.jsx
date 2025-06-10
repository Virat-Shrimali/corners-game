import React, { useState, useEffect, useRef } from 'react';
import p5 from 'p5';
import './index.css';

const positionalWeight = Array.from({length: 7}, (_, i) => 
  Array.from({length: 7}, (_, j) => 4 - Math.max(Math.abs(i - 3), Math.abs(j - 3)))
);

const App = () => {
  const [gameMode, setGameMode] = useState(null);
  const [grid, setGrid] = useState(() => Array(7).fill().map(() => Array(7).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState('red');
  const [redScore, setRedScore] = useState(0);
  const [blueScore, setBlueScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [status, setStatus] = useState("Select Game Mode");
  const p5Ref = useRef(null);
  const canvasRef = useRef(null);
  const gridRef = useRef(grid);
  const [phase, setPhase] = useState('claim'); // 'claim' or 'place'
  const [canPass, setCanPass] = useState(false);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    if (gameMode === 'vsComputer' && currentPlayer === 'blue' && !gameOver) {
      const timer = setTimeout(() => {
        if (phase === 'claim') {
          claimSquare(true);
        } else if (phase === 'place') {
          computerPlaceMark();
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [gameMode, currentPlayer, gameOver, phase]);

  useEffect(() => {
    if (gameMode) {
      const sketch = (p) => {
        p.setup = () => {
          let canvas = p.createCanvas(350, 350);
          canvasRef.current = canvas;
          canvas.parent('game-canvas');
        };

        p.draw = () => {
          p.background(255);
          p.stroke(0);
          p.strokeWeight(2);
          for (let i = 0; i <= 7; i++) {
            p.line(i * 50, 0, i * 50, 350);
            p.line(0, i * 50, 350, i * 50);
          }
          for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
              if (grid[i][j]) {
                let isShaded = grid[i][j].includes('shaded');
                if (grid[i][j].includes('red')) {
                  p.fill(255, 0, 0);
                  p.ellipse(j * 50 + 25, i * 50 + 25, 30, 30);
                  if (isShaded) {
                    p.fill(200, 0, 0);
                    p.ellipse(j * 50 + 25, i * 50 + 25, 15, 15);
                  }
                } else if (grid[i][j].includes('blue')) {
                  p.fill(0, 0, 255);
                  p.ellipse(j * 50 + 25, i * 50 + 25, 30, 30);
                  if (isShaded) {
                    p.fill(0, 0, 200);
                    p.ellipse(j * 50 + 25, i * 50 + 25, 15, 15);
                  }
                }
              }
            }
          }
          if (selectedSquare) {
            p.stroke(0, 255, 0);
            p.strokeWeight(6);
            p.noFill();
            let [x1, y1, x2, y2, x3, y3, x4, y4] = selectedSquare;
            let points = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
            points.sort((a, b) => (a[0] === b[1] ? a[1] - b[1] : a[0] - b[0]));
            p.quad(
              points[0][1] * 50 + 25, points[0][0] * 50 + 25,
              points[1][1] * 50 + 25, points[1][0] * 50 + 25,
              points[2][1] * 50 + 25, points[2][0] * 50 + 25,
              points[3][1] * 50 + 25, points[3][0] * 50 + 25
            );
          }
        };

        p.mousePressed = () => {
          if (gameOver || phase !== 'place' || (gameMode === 'vsComputer' && currentPlayer === 'blue')) return;
          let row = Math.floor(p.mouseY / 50);
          let col = Math.floor(p.mouseX / 50);
          if (row >= 0 && row < 7 && col >= 0 && col < 7 && !grid[row][col]) {
            let newGrid = [...grid];
            newGrid[row] = [...newGrid[row]];
            newGrid[row][col] = currentPlayer;
            setGrid(newGrid);
            if (isBoardFull(newGrid)) {
              setStatus("Calculating final scores...");
              setTimeout(() => countFinalScores(newGrid), 800);
            } else {
              switchPlayer();
            }
          }
        };
      };

      p5Ref.current = new p5(sketch);
      return () => p5Ref.current.remove();
    }
  }, [gameMode, grid, currentPlayer, gameOver, phase, selectedSquare]);

  const findSquares = (player, currentGrid) => {
    let squares = [];
    let playerMarks = [];
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (currentGrid[i][j]?.includes(player)) {
          playerMarks.push([i, j]);
        }
      }
    }
    
    if (playerMarks.length < 4) return squares;
    
    for (let a = 0; a < playerMarks.length; a++) {
      for (let b = a + 1; b < playerMarks.length; b++) {
        for (let c = b + 1; c < playerMarks.length; c++) {
          for (let d = c + 1; d < playerMarks.length; d++) {
            let points = [playerMarks[a], playerMarks[b], playerMarks[c], playerMarks[d]];
            if (isSquare(points)) {
              let sortedPoints = [...points].sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);
              squares.push([
                sortedPoints[0][0], sortedPoints[0][1],
                sortedPoints[1][0], sortedPoints[1][1],
                sortedPoints[2][0], sortedPoints[2][1],
                sortedPoints[3][0], sortedPoints[3][1]
              ]);
            }
          }
        }
      }
    }
    return squares;
  };

  const isSquare = (points) => {
    const epsilon = 1e-6;
    let distances = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        let dx = points[i][0] - points[j][0];
        let dy = points[i][1] - points[j][1];
        let dist = Math.sqrt(dx * dx + dy * dy);
        distances.push(dist);
      }
    }
    distances.sort((a, b) => a - b);
    
    if (Math.abs(distances[0] - distances[1]) > epsilon) return false;
    if (Math.abs(distances[0] - distances[2]) > epsilon) return false;
    if (Math.abs(distances[0] - distances[3]) > epsilon) return false;
    if (Math.abs(distances[4] - distances[5]) > epsilon) return false;
    
    if (Math.abs(distances[4] - (distances[0] * Math.sqrt(2))) > epsilon) return false;
    
    return true;
  };

  const countFinalScores = (finalGrid) => {
    let newGrid = finalGrid.map(row => [...row]);
    let redPoints = 0;
    let bluePoints = 0;
    
    // Function to score squares for a player
    const scorePlayerSquares = (player) => {
      let points = 0;
      let squares = findSquares(player, newGrid);
      while (squares.length > 0) {
        // Find the square with the most unshaded dots
        let bestSquare = squares[0];
        let maxScore = -1;
        squares.forEach(square => {
          let [x1, y1, x2, y2, x3, y3, x4, y4] = square;
          let score = 0;
          if (!newGrid[x1][y1]?.includes('shaded')) score++;
          if (!newGrid[x2][y2]?.includes('shaded')) score++;
          if (!newGrid[x3][y3]?.includes('shaded')) score++;
          if (!newGrid[x4][y4]?.includes('shaded')) score++;
          if (score > maxScore) {
            maxScore = score;
            bestSquare = square;
          }
        });
        
        if (maxScore <= 0) break; // No more unshaded dots to score
        
        // Score the best square and shade its dots
        let [x1, y1, x2, y2, x3, y3, x4, y4] = bestSquare;
        if (!newGrid[x1][y1]?.includes('shaded')) {
          newGrid[x1][y1] = (newGrid[x1][y1] || player) + '-shaded';
          points++;
        }
        if (!newGrid[x2][y2]?.includes('shaded')) {
          newGrid[x2][y2] = (newGrid[x2][y2] || player) + '-shaded';
          points++;
        }
        if (!newGrid[x3][y3]?.includes('shaded')) {
          newGrid[x3][y3] = (newGrid[x3][y3] || player) + '-shaded';
          points++;
        }
        if (!newGrid[x4][y4]?.includes('shaded')) {
          newGrid[x4][y4] = (newGrid[x4][y4] || player) + '-shaded';
          points++;
        }
        
        // Update grid and re-find squares
        setGrid(newGrid);
        setSelectedSquare(bestSquare);
        setTimeout(() => setSelectedSquare(null), 800);
        squares = findSquares(player, newGrid);
      }
      return points;
    };
    
    // Score for both players, alternating to avoid conflicts
    redPoints = scorePlayerSquares('red');
    bluePoints = scorePlayerSquares('blue');
    
    // Update scores and end game
    setRedScore(prev => prev + redPoints);
    setBlueScore(prev => prev + bluePoints);
    setTimeout(() => endGame(), 1000);
  };

  const claimSquare = (isComputer = false) => {
    if (gameOver || phase !== 'claim') return;
    
    const currentGrid = gridRef.current;
    let squares = findSquares(currentPlayer, currentGrid);
    
    if (squares.length > 0) {
      let bestSquare = squares[0];
      let maxScore = -1;
      
      squares.forEach(square => {
        let [x1, y1, x2, y2, x3, y3, x4, y4] = square;
        let score = 0;
        if (!currentGrid[x1][y1].includes('shaded')) score++;
        if (!currentGrid[x2][y2].includes('shaded')) score++;
        if (!currentGrid[x3][y3].includes('shaded')) score++;
        if (!currentGrid[x4][y4].includes('shaded')) score++;
        if (score > maxScore) {
          maxScore = score;
          bestSquare = square;
        }
      });
      
      setSelectedSquare(bestSquare);
      let [x1, y1, x2, y2, x3, y3, x4, y4] = bestSquare;
      
      let newGrid = currentGrid.map(row => [...row]);
      let score = 0;
      
      if (!newGrid[x1][y1].includes('shaded')) { 
        newGrid[x1][y1] += '-shaded'; 
        score++; 
      }
      if (!newGrid[x2][y2].includes('shaded')) { 
        newGrid[x2][y2] += '-shaded'; 
        score++; 
      }
      if (!newGrid[x3][y3].includes('shaded')) { 
        newGrid[x3][y3] += '-shaded'; 
        score++; 
      }
      if (!newGrid[x4][y4].includes('shaded')) { 
        newGrid[x4][y4] += '-shaded'; 
        score++; 
      }
      
      setGrid(newGrid);
      if (currentPlayer === 'red') {
        setRedScore(prev => prev + score);
      } else {
        setBlueScore(prev => prev + score);
      }
      
      setTimeout(() => {
        setSelectedSquare(null);
        setPhase('place');
        setStatus(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn (Place Mark)`);
        setCanPass(false);
      }, 1200);
    } else {
      setPhase('place');
      setStatus(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn (Place Mark)`);
      setCanPass(true);
    }
  };

  const passClaim = () => {
    if (gameOver || phase !== 'claim') return;
    
    setPhase('place');
    setStatus(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn (Place Mark)`);
    setCanPass(true);
  };

  const computerPlaceMark = () => {
    setStatus("Blue's Turn (Thinking...)");
    
    setTimeout(() => {
      const currentGrid = gridRef.current;
      let emptyCells = [];
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          if (!currentGrid[i][j]) emptyCells.push([i, j]);
        }
      }
      
      if (emptyCells.length === 0) {
        switchPlayer();
        return;
      }
      
      let bestMove = null;
      let maxScore = -Infinity;
      
      emptyCells.forEach(([row, col]) => {
        let tempGrid = currentGrid.map(r => [...r]);
        tempGrid[row][col] = 'blue';
        
        let allPossibleSquares = findSquares('blue', tempGrid);
        let claimScore = allPossibleSquares.reduce((max, square) => {
          let unshadedCount = 0;
          for (let k = 0; k < 8; k += 2) {
            let r = square[k];
            let c = square[k + 1];
            if (!tempGrid[r][c].includes('shaded')) unshadedCount++;
          }
          return Math.max(max, unshadedCount);
        }, 0);
        
        let blockScore = 0;
        let opponentTempGrid = currentGrid.map(r => [...r]);
        opponentTempGrid[row][col] = 'red';
        let opponentSquares = findSquares('red', opponentTempGrid);
        if (opponentSquares.length > 0) {
          blockScore = 5;
        }
        
        let positionalScore = positionalWeight[row][col];
        let multiSquareBonus = Math.min(allPossibleSquares.length, 3);
        let totalScore = claimScore * 2 + blockScore + positionalScore + multiSquareBonus;
        
        if (totalScore > maxScore) {
          maxScore = totalScore;
          bestMove = [row, col];
        }
      });
      
      if (!bestMove) {
        bestMove = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      }
      
      let [row, col] = bestMove;
      let newGrid = currentGrid.map(r => [...r]);
      newGrid[row][col] = 'blue';
      
      setGrid(newGrid);
      setStatus("Blue placed a mark");
      
      if (isBoardFull(newGrid)) {
        setStatus("Calculating final scores...");
        setTimeout(() => countFinalScores(newGrid), 800);
      } else {
        switchPlayer();
      }
    }, 800);
  };

  const switchPlayer = () => {
    const nextPlayer = currentPlayer === 'red' ? 'blue' : 'red';
    setCurrentPlayer(nextPlayer);
    setPhase('claim');
    setStatus(`${nextPlayer.charAt(0).toUpperCase() + nextPlayer.slice(1)}'s Turn (Claim Square)`);
    setCanPass(true);
  };

  const isBoardFull = (gridState) => {
    return gridState.every(row => row.every(cell => cell !== null));
  };

  const endGame = () => {
    setGameOver(true);
    let winnerResult = redScore > blueScore ? 'Red' : blueScore > redScore ? 'Blue' : 'Tie';
    setWinner(winnerResult);
    setStatus(`Game Over! Final Scores - Red: ${redScore}, Blue: ${blueScore}`);
  };

  const startGame = (mode) => {
    setGameMode(mode);
    setGrid(Array(7).fill().map(() => Array(7).fill(null)));
    setCurrentPlayer('red');
    setRedScore(0);
    setBlueScore(0);
    setGameOver(false);
    setSelectedSquare(null);
    setPhase('claim');
    setStatus("Red's Turn (Claim Square)");
    setCanPass(true);
    setWinner(null);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-auto">
      <h1 className="text-2xl font-bold text-center mb-4 text-gray-800">Corners Game</h1>
      {!gameMode ? (
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Select Game Mode</h2>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => startGame('twoPlayer')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              2 Players
            </button>
            <button
              onClick={() => startGame('vsComputer')}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              Vs. Computer
            </button>
          </div>
        </div>
      ) : (
        <>
          <div id="game-canvas" className="border border-gray-300 mx-auto"></div>
          <div className="text-center mt-4">
            <div className={`text-lg font-semibold ${gameOver ? 'text-gray-600' : currentPlayer === 'red' ? 'text-red-600' : 'text-blue-600'}`}>
              {status}
            </div>
            {gameOver && winner && (
              <div className={`text-xl font-bold mt-2 ${winner === 'Red' ? 'text-red-600' : winner === 'Blue' ? 'text-blue-600' : 'text-gray-600'}`}>
                {winner === 'Tie' ? 'It’s a Tie!' : `${winner} Wins!`}
              </div>
            )}
            <div className="text-md mt-2">
              <span className="text-red-600 font-medium">Red: {redScore}</span> | 
              <span className="text-blue-600 font-medium"> Blue: {blueScore}</span>
            </div>
            
            {phase === 'claim' && (
              <div className="mt-4">
                <button
                  onClick={() => claimSquare(false)}
                  disabled={gameOver || (gameMode === 'vsComputer' && currentPlayer === 'blue')}
                  className={`px-4 py-2 rounded-lg font-semibold text-white transition duration-300 
                    ${gameOver || (gameMode === 'vsComputer' && currentPlayer === 'blue') 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-500 hover:bg-green-600'}`}
                >
                  Claim Square
                </button>
                {canPass && (
                  <button
                    onClick={passClaim}
                    disabled={gameOver || (gameMode === 'vsComputer' && currentPlayer === 'blue')}
                    className={`ml-2 px-4 py-2 rounded-lg font-semibold text-white transition duration-300 
                      ${gameOver || (gameMode === 'vsComputer' && currentPlayer === 'blue') 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-yellow-500 hover:bg-yellow-600'}`}
                  >
                    Pass Claim
                  </button>
                )}
              </div>
            )}
            
            <button
              onClick={() => startGame(null)}
              className="mt-4 px-4 py-2 rounded-lg font-semibold text-white bg-blue-500 hover:bg-blue-600 transition duration-300"
            >
              Restart Game
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
