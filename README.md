<p align="center"><img src="assets/ocafy-logo-horizontal.svg" alt="Ocafy" width="360"></p>

<p align="center"><strong>Deixa a casa ok.</strong></p>

Ocafy é um web app de gestão doméstica gamificada para casais: rotinas da casa com método, divisão justa das tarefas e progresso visível.

## Funcionalidades

- **Hoje:** anel de progresso da rotina, sequência de dias, nível e XP de cada pessoa, carrossel de cômodos e prioridades do dia.
- **Rotinas:** mais de 35 tarefas com janela de frequência (mínimo e máximo de dias), técnica explicada e plano da semana.
- **Cozinha:** planejamento de refeições com alertas para tirar a proteína do congelador.
- **Gatos:** controle da troca de areia, consumo por mês e estoque de sacos.
- **Projeto Escritório:** trilha de 9 semanas com um objetivo por semana e inventário de itens.
- **Placar:** desafio semanal do casal, níveis e 13 conquistas.
- Modo claro e escuro, dois usuários e desfazer em qualquer registro.

## Tecnologia

Um único arquivo `index.html`: HTML, CSS e JavaScript puro, sem framework e sem etapa de build.

- **Dados:** quando publicado como Claude Artifact, sincroniza entre os dois usuários pelo banco de dados do runtime. Aberto fora do Claude, salva no `localStorage` do navegador.
- **Fontes:** Manrope (Google Fonts).

## Rodar localmente

Abra o `index.html` no navegador ou sirva a pasta:

```bash
npx serve .
```

## App web (Next.js)

```bash
pnpm install
pnpm --filter @ocafy/web dev      # http://localhost:3000
pnpm --filter @ocafy/web build
```

O protótipo `index.html` continua como referência visual. Telas do app: onboarding, Hoje, Rotinas, Cozinha, Gatos, Lojinha, Placar (feed social e conquistas) e Projeto Escritório.

## Marca

| Arquivo | Uso |
|---|---|
| `assets/ocafy-simbolo.svg` | Símbolo (a oca com o coração) |
| `assets/ocafy-icone.svg` | Ícone do app |
| `assets/ocafy-logo-horizontal.svg` | Logotipo principal |
| `assets/ocafy-logo-negativo.svg` | Logotipo para fundo escuro |

Cores: Rosa Ocafy `#FFB7C5` · Rosa Profundo `#C24B68` · Menta `#D5F3D8` · Verde Feito `#9ADBA9` · Blush `#F2C7C7` · Tinta `#2B2226`.

## Próximos passos

- [ ] Autenticação e banco próprio (Supabase ou Firebase)
- [ ] PWA instalável com notificações push (alertas do congelador e da rotina)
- [x] Migração para Next.js mantendo a lógica atual (`apps/web`, Fase 4)
- [ ] Trocar o armazenamento local do `apps/web` (`src/lib/store.ts`) pelo tRPC/Neon (`@ocafy/api`)
