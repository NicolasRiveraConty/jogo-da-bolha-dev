# Jogo da Bolha Dev

RPG de ação 3D em blocos (inspirado em Minecraft) que roda 100% no navegador, sem login e sem backend.
Mundo procedural com luz solar, sombras dinâmicas, névoa e nuvens. Ande com WASD, olhe com o mouse,
elimine os mobs em tempo real, derrote o escudeiro Élio e destrua o boss **REAL OFICIAL** no castelo.

Jogue em: https://nicolasriveraconty.github.io/jogo-da-bolha-dev/

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`.

## Build e deploy

```bash
npm run build
```

A pasta `dist/` contém arquivos estáticos. O workflow em `.github/workflows/deploy.yml` publica
automaticamente no GitHub Pages a cada push na `main`.

## Controles

| Tecla | Ação |
| --- | --- |
| `W` `A` `S` `D` | Mover |
| Mouse | Olhar (o cursor fica travado durante o jogo; `ESC` solta e pausa) |
| Botão esquerdo | Atacar |
| Botão direito | Especial do herói |
| `Q` | Cura do herói |
| `Espaço` | Pular / nadar |
| `Shift` | Correr |
| `F5` | Alternar 1ª / 3ª pessoa |
| `M` | Ligar/desligar som |

## Como vencer

1. Siga o **feixe dourado** até a Torre do Escudeiro e derrote **Élio**. Elimine Bugs, Clientes e Reuniões pelo caminho para ganhar XP e subir de nível.
2. Com Élio derrotado, o portão de ouro do castelo se abre. Siga o **feixe vermelho**.
3. Dentro do castelo, destrua o **REAL OFICIAL**. Ele tem fases: *Loop Infinito* (mais rápido, invoca bugs, rajadas triplas de Reels) e come pipoca para recuperar fôlego.

Morrer não é o fim: você renasce no acampamento com HP cheio.

## Heróis

| Herói | Papel | Especial (botão direito) | Cura (Q) |
| --- | --- | --- | --- |
| Nicolas (Conty) | O Estrategista — ágil e equilibrado | Campanha Viral: explosão em área | Networking +35% |
| Pedro (Conty) | O CEO — recebe 22% menos dano | Decisão Executiva: 3x de dano no alvo | Rodada de Investimento +40% |
| Mateus (Fitfolio) | O Shape — maior dano por golpe | Dia de Perna: pisão em área com empurrão | Whey Protein +30% |

## Mobs

| Mob | Comportamento |
| --- | --- |
| Bug em Produção | Aranha verde rápida, ataque corpo a corpo |
| Cliente do Desconto | De terno e óculos escuros, bate com o tablet |
| Reunião Que Podia Ser Email | Mesa flutuante com relógio, atira "Slide 47" à distância |
| Élio, o Fiel Escudeiro | Mini-boss na torre; espada, escudo e cobrança de taxas |
| REAL OFICIAL | Boss final no castelo; coroa, balde de pipoca e Cortes de Reels |

## Estrutura

```
src/
  main.ts            # bootstrap: telas HTML + Game
  style.css          # HUD e telas
  game/
    Game.ts          # renderer, luzes/sombras, céu, loop, combate, IA, boss, fluxo
    World.ts         # geração procedural do mundo voxel, estruturas e malha por chunk
    Blocks.ts        # tipos de bloco e atlas de texturas procedurais (16x16)
    Noise.ts         # simplex noise + RNG determinístico
    Models.ts        # modelos em blocos (humanoide, mobs, armas, texturas pixeladas)
    Mobs.ts          # entidade Mob (vida, knockback, movimento no terreno)
    Player.ts        # física AABB, WASD, pulo, nado, câmera 1ª/3ª pessoa, arma na mão
    Effects.ts       # partículas, projéteis, números de dano e falas
    Data.ts          # heróis, mobs, tabela de XP
  ui/Hud.ts          # HUD e telas (DOM)
  audio/Sfx.ts       # sons e músicas chiptune sintetizados via Web Audio
public/assets/       # retratos dos heróis e fundo do título
```

Tecnologias: [Three.js](https://threejs.org/), Vite, TypeScript. Todas as texturas e modelos são gerados em
tempo de execução — não há arquivos 3D externos.
