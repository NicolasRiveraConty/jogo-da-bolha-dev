# Jogo da Bolha Dev

RPG por turnos em pixel art que roda 100% no navegador, sem login e sem backend.
Objetivo: atravessar o mapa, derrotar o escudeiro Élio e destruir o boss **REAL OFICIAL**.

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

A pasta `dist/` contém arquivos estáticos. Publique em qualquer host estático:

- **Vercel / Netlify**: aponte para o repositório, comando `npm run build`, pasta `dist`.
- **GitHub Pages**: publique o conteúdo de `dist/` (o `base: './'` no Vite já usa caminhos relativos).

## Estrutura

```
src/
  main.ts              # bootstrap do Phaser
  config.ts            # resolução, fonte, cores
  assets.ts            # manifesto das imagens (com placeholders de fallback)
  data/                # heróis, inimigos, itens, mapa
  battle/BattleEngine  # regras de combate (lógica pura, sem renderização)
  state/GameState      # save em localStorage
  audio/Sfx            # sons e músicas chiptune sintetizados via Web Audio
  ui/                  # painéis, botões, barras, menu com teclado
  scenes/              # Boot, Title, Select, Map, Shop, Battle, End
scripts/process-art.mjs  # recorta fundo magenta dos sprites e otimiza PNGs
public/assets/           # artes finais
art-raw/                 # artes brutas geradas (fonte para reprocessar)
```

## Personagens

| Personagem | Papel | Empresa |
| --- | --- | --- |
| Nicolas | Herói jogável — O Estrategista | Conty |
| Pedro | Herói jogável — O CEO | Conty |
| Mateus | Herói jogável — O Shape | Fitfolio |
| William | Vendedor da loja | Conty |
| Anderson | Dev que faz o "hotfix" (cura) | Conty |
| Élio | Mini-boss — fiel escudeiro, ataca com taxas do app de finanças | — |
| REAL OFICIAL | Boss final — rei dos cortes, come pipoca e ataca com reels | — |

## Controles

- Setas / `A` `D`: mover no mapa e navegar menus
- `ENTER` / `ESPAÇO`: confirmar
- `ESC`: voltar
- Mouse funciona em tudo

## Regenerando artes

Coloque novas imagens em `art-raw/` com os prefixos `bg_`, `hero_`, `enemy_` ou `portrait_`
(sprites em fundo magenta chapado) e rode:

```bash
node scripts/process-art.mjs
```
