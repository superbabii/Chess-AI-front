import React, { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import Swal from 'sweetalert2';
import './ChessGame.css';

const ChessGame = () => {

  // const levels = {
  //   "Two Player 👥": null,
  //   "Easy 🤓": 2,
  //   "Medium 🧐": 8,
  //   "Hard 😵": 18,
  // };

  // Initialize Stockfish worker
  // const stockfish = useMemo(() => new Worker('./stockfish.js'), []);

  const [game, setGame] = useState(new Chess());
  const [gamePosition, setGamePosition] = useState(game.fen());
  const [history, setHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [status, setStatus] = useState('Game in progress');
  const [bestMove, setBestMove] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [stockfishLevel, setStockfishLevel] = useState(2);

  // Function to get Stockfish's move when playing against AI
  // const getAIMove = (currentFen) => {
  //   stockfish.postMessage({
  //     action: 'evaluate',
  //     fen: currentFen,
  //   });

  //   stockfish.onmessage = (event) => {
  //     const { bestmove } = event.data;
  //     if (bestmove) {
  //       const move = game.move({
  //         from: bestmove.slice(0, 2),
  //         to: bestmove.slice(2, 4),
  //         promotion: 'q', // Assume pawn promotion to queen
  //       });
  //       setGamePosition(game.fen());
  //       setHistory(game.history({ verbose: true }));
  //       if (game.isGameOver()) {
  //         setGameOver(true);
  //         // handleGameOver();
  //       }
  //     }
  //   };
  // };

  const evaluatePosition = async (currentFen) => {
    if (game.isGameOver()) {
      console.log("Game is over, no evaluation needed.");
      return;
    }

    try {
      const response = await fetch('http://3.135.227.245:8000/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fen: currentFen }),
      });

      if (response.ok) {
        const data = await response.json();
        setBestMove(data.best_move);
      } else {
        Swal.fire({
          title: 'Error',
          text: 'Failed to evaluate the position.',
          icon: 'error',
        });
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        title: 'Error',
        text: 'An error occurred during evaluation.',
        icon: 'error',
      });
    }
  };

  useEffect(() => {
    if (!gameOver && !game.isGameOver()) {
      evaluatePosition(gamePosition);
    }
  }, [gamePosition, stockfishLevel]); // Include stockfishLevel in dependencies

  useEffect(() => {
    if (game.isGameOver()) {
      setGameOver(true);
      if (game.isCheckmate()) {
        setStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
        Swal.fire({
          title: 'Checkmate!',
          text: `${game.turn() === 'w' ? 'Black' : 'White'} wins the game.`,
          icon: 'success',
          confirmButtonText: 'New Game',
        }).then(() => resetGame());
      } else if (game.isDraw()) {
        setStatus('Draw!');
        Swal.fire({
          title: 'Draw!',
          text: 'The game ended in a draw.',
          icon: 'info',
          confirmButtonText: 'New Game',
        }).then(() => resetGame());
      } else if (game.isStalemate()) {
        setStatus('Stalemate!');
        Swal.fire({
          title: 'Stalemate!',
          text: 'The game ended in a stalemate.',
          icon: 'info',
          confirmButtonText: 'New Game',
        }).then(() => resetGame());
      }
    } else {
      setStatus(`Turn: ${game.turn() === 'w' ? 'White' : 'Black'}`);
    }
  }, [history, game]);

  const onPieceDrop = (sourceSquare, targetSquare, piece) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece[1].toLowerCase() ?? "q",
      });

      if (move === null) {
        throw new Error('Illegal move');
      }

      setGamePosition(game.fen());
      setHistory(game.history({ verbose: true }));

      // If we're in Single Player mode and it's the AI's turn (black), let Stockfish make a move
      // if (stockfishLevel !== null && game.turn() === 'b') {
      //   getAIMove(game.fen());
      // }
    } catch (error) {
      console.error(error.message);
      Swal.fire({
        title: 'Invalid Move',
        text: error.message,
        icon: 'error',
        confirmButtonText: 'Try Again',
      });
    }
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGamePosition(newGame.fen());
    setHistory([]);
    setGameOver(false);
    setStatus('Game in progress');
    setBestMove(null);
  };

  // Complete Undo functionality
  const undoMove = () => {
    game.undo(); // Optionally undo two moves (for both sides)
    setGamePosition(game.fen()); // Update the board position
    setHistory(game.history({ verbose: true })); // Update the history
    setBestMove(null); // Reset bestMove to avoid showing stale move
    setStatus(`Turn: ${game.turn() === 'w' ? 'White' : 'Black'}`); // Update the game status
  };

  const renderMoveHistory = () => {
    return history.map((move, index) => (
      <div key={index} className="move">
        {index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''} {move.san}
      </div>
    ));
  };

  const customSquareStyles = {
    ...(bestMove ? { [bestMove.from]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' } } : {}),
    ...(bestMove ? { [bestMove.to]: { backgroundColor: 'rgba(255, 0, 0, 0.4)' } } : {}),
  };

  const customArrows = bestMove ? [[bestMove.from, bestMove.to]] : [];

  const handleChatSubmit = async () => {
    setLoadingChat(true);
    try {
      const response = await fetch('http://3.135.227.245:8000/llm_chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: chatInput, fen: gamePosition }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatResponse(data.response);
      } else {
        Swal.fire({
          title: 'Error',
          text: 'Failed to fetch response from LLM.',
          icon: 'error',
        });
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        title: 'Error',
        text: 'An error occurred during LLM request.',
        icon: 'error',
      });
    }
    setLoadingChat(false);
  };

  const renderChatBot = () => {
    return (
      <div className="chat-box">
        <div className="chat-response">
          {chatResponse && <p className="ai">{chatResponse}</p>}
          {chatInput && <p className="user">{chatInput}</p>}
        </div>
  
        <textarea
          placeholder="Ask anything about the game..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
        />
  
        <button onClick={handleChatSubmit} disabled={loadingChat}>
          {loadingChat ? 'Loading...' : 'Ask'}
        </button>
      </div>
    );
  };
  
  return (
    <div className="chess-game-container">      
      <div className="main-section">
        <div className="board-section">          
          <div className="top-section">            
            <div className="best-move">
              <h2>Best Move: </h2>
              <p>{bestMove ? `${bestMove.from}${bestMove.to}` : 'No move available'}</p>
            </div>
            <button className="button" onClick={undoMove}>
              Undo
            </button>
            <button className="button" onClick={resetGame}>
              Reset
            </button>
          </div>
          <div className="fen-output">
            <p>{gamePosition}</p>
          </div>
          <div className="game-status">
            <h2>{status}</h2>
          </div>
          {/* <div className="level-section">
            {Object.entries(levels).map(([level, depth]) => (
              <button
                key={level}
                className={`button ${depth === stockfishLevel ? 'active' : ''}`}
                onClick={() => setStockfishLevel(depth)}
              >
                {level}
              </button>
            ))}
          </div> */}
          <Chessboard
            position={gamePosition}
            onPieceDrop={onPieceDrop}
            customSquareStyles={customSquareStyles}
            customArrows={customArrows}
          />
        </div>
        <div className="info-section">
          {/* Tab Bar */}
          <div className="tab-bar">            
            <div
              className={`tab ${activeTab === 'chat' ? 'active-tab' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chess AI Advisor
            </div>
            <div
              className={`tab ${activeTab === 'history' ? 'active-tab' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Move History
            </div>
          </div>

          {/* Conditional Rendering Based on Active Tab */}
          {activeTab === 'chat' ? (
              renderChatBot()
            ) : (            
            <div className="move-history">
              <h2>Move History:</h2>
              {renderMoveHistory()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChessGame;
