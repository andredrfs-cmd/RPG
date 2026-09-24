// server/server.js
const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });

// Guardaremos os dados de cada jogador conectado usando o socket como chave
// Estrutura de cada player: { id, x, y, color, inputs: { up, down, left, right } }
const players = new Map();

let nextPlayerId = 1;

// Cores simples para diferenciar cada jogador que entrar
const COLORS = ['#00ff00', '#ff0000', '#00ffff', '#ffff00', '#ff00ff', '#ffffff'];

console.log('🚀 Servidor RPG iniciado na porta 8080!');

wss.on('connection', (socket) => {
  const playerId = `player_${nextPlayerId++}`;
  
  // Cria o estado inicial do jogador no mundo (começa no centro do mapa: X: 400, Y: 300)
  const playerState = {
    id: playerId,
    x: 400,
    y: 300,
    speed: 5, // Pixels por tick
    color: COLORS[players.size % COLORS.length],
    inputs: { up: false, down: false, left: false, right: false }
  };

  players.set(socket, playerState);
  console.log(`🟢 ${playerId} conectou!`);

  // Envia ao jogador recém-conectado o seu próprio ID
  socket.send(JSON.stringify({
    type: 'INIT',
    id: playerId
  }));

  // Recebe comandos (teclas) enviados pelo cliente
  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'INPUT') {
        // Atualiza o estado das teclas mantidas pressionadas pelo jogador
        const player = players.get(socket);
        if (player) {
          player.inputs = data.inputs;
        }
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err);
    }
  });

  socket.on('close', () => {
    console.log(`🔴 ${playerId} desconectou.`);
    players.delete(socket);
  });
});

// Loop de Tempo Real (20 Ticks/segundo)
const TICK_RATE = 20;
const TICK_INTERVAL = 1000 / TICK_RATE;
let tickCount = 0;

setInterval(() => {
  tickCount++;

  // 1. Atualiza a lógica do jogo (movimentação de todos os jogadores)
  for (const [socket, player] of players.entries()) {
    if (player.inputs.up) player.y -= player.speed;
    if (player.inputs.down) player.y += player.speed;
    if (player.inputs.left) player.x -= player.speed;
    if (player.inputs.right) player.x += player.speed;

    // Limites da tela (800x600) para o jogador não sumir
    player.x = Math.max(15, Math.min(785, player.x));
    player.y = Math.max(15, Math.min(585, player.y));
  }

  // 2. Prepara o pacote com o estado de TODOS os jogadores
  const playersData = Array.from(players.values()).map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    color: p.color,
    direction: p.direction || 'down',
    isMoving: p.isMoving || false
  }));

  const gameStatePayload = JSON.stringify({
    type: 'TICK_UPDATE',
    tick: tickCount,
    players: playersData
  });

  // 3. Envia o pacote para todo mundo (Broadcast)
  for (const socket of players.keys()) {
    if (socket.readyState === 1) {
      socket.send(gameStatePayload);
    }
  }
}, TICK_INTERVAL);