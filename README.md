# Bom de Compras Marketplace OS

Sistema de acompanhamento de marketplace da Bom de Compras — 2026.
Cópia adaptada do Marketplace OS original (multi-canal), reduzida para um único
canal: **Mercado Livre**. Todos os dados começam zerados, prontos para receber
os números reais da operação.

É **um único arquivo HTML autocontido**: sem CDN, sem framework, sem build de
JavaScript, sem servidor. Abre com duplo clique ou é servido como site estático.

## Telas

| Tela | Conteúdo |
|---|---|
| Dashboard | visão consolidada do período |
| Canais | detalhe por canal (hoje: só Mercado Livre) |
| Anual | evolução mês a mês |
| Semanal | evolução semana a semana |
| Comparativos | comparação entre recortes/canais |
| Lançamentos | grade editável dia a dia |
| Metas | metas mensais e anual |
| Dados & Backup | exportação, restauração e origem dos números |
| Apresentação | slides em tela cheia para reunião |
| Glossário | definição das métricas |

## Rodar localmente

Basta abrir `index.html` no navegador. Se preferir servir por HTTP:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Se não tiver Python configurado, o projeto também traz um servidor mínimo em Node:

```bash
node serve.js
# abre http://localhost:8000 (ou a porta definida em $PORT)
```

## Alterar o sistema

**Nunca edite `index.html` direto** — ele é gerado. Edite os arquivos de `src/`
e rode o build:

```bash
python3 build.py
# ou, sem Python: node build.js
```

| Arquivo | Responsabilidade |
|---|---|
| `src/01_head.html` | design system — tokens de cor, tipografia, todos os componentes |
| `src/02_body.html` | estrutura das telas |
| `src/03_core.js` | modelo de dados, agregação, formatação, persistência |
| `src/04_charts.js` | motor de gráficos em canvas (linha, barra, empilhado, anel, sparkline) |
| `src/05_views_a.js` | Dashboard, Canais, Anual |
| `src/06_views_b.js` | Semanal, Comparativos, Lançamentos, Metas, Dados, Glossário |
| `src/07_deck_init.js` | modo apresentação |
| `src/08_shell.js` | navegação, filtros, paleta de comandos, tema |
| `data/full_data.json` | os 365 dias do canal Mercado Livre — hoje zerado |

O build confere que nenhum token de cor ficou sem definição no `:root` base —
esse é o erro que quebraria um dos temas.

## Como os dados funcionam

`data/full_data.json` guarda o diário do canal Mercado Livre — receita, pedidos,
pedidos cancelados, valor cancelado, visitas e investimento em ADS, dia a dia.
**Todo o resto é calculado a partir dele**: mensal, anual, semanal e comparativos.

Hoje todos os 365 dias de 2026 estão zerados. Para popular com dados reais, duas
opções:

1. Editar `data/full_data.json` diretamente (mesmo formato, um array por dia) e
   rodar o build de novo.
2. Lançar manualmente pela tela **Lançamentos** — as edições ficam no
   `localStorage` do navegador, sobrepondo o JSON. Elas **não sincronizam entre
   computadores nem entre pessoas** — cada navegador tem a própria cópia. Use
   *Dados & Backup* para exportar e levar.

A tela **Integrações** já tem um card para o Mercado Livre, mas hoje é só
interface — os botões "Testar" e "Salvar" guardam o token no navegador e não
chamam a API real do Mercado Livre ainda. Conectar de verdade (OAuth do
Mercado Livre + sincronização automática de pedidos/receita) é trabalho futuro.

Se um dia isso precisar virar acesso compartilhado de verdade, o caminho é trocar
o `localStorage` por uma API com banco de dados; o resto do sistema não muda,
porque toda leitura passa pela função `cell()` em `src/03_core.js`.

### Duas ressalvas herdadas do sistema original

1. **Visitas**: se um dia o registro mensal de visitas (relatório da plataforma)
   for maior que a soma do diário lançado, o sistema usa o mensal — senão a taxa
   de conversão sai distorcida.

2. **TACOS, não ACOS.** A métrica de mídia é `Inv. ADS ÷ Receita Total`, que é a
   definição de TACOS. ACOS de verdade exige a receita atribuída aos anúncios,
   que o Mercado Livre expõe separadamente — se isso for lançado no futuro, vale
   revisar essa conta.

## Publicar

A pasta é um projeto estático independente. Na Vercel: importe o repositório,
defina **Root Directory** como `bomdecompras-marketplace`, deixe Framework
Preset em **Other** e Build Command vazio.

O `vercel.json` já envia `X-Robots-Tag: noindex` — o painel tem números
internos e não deve aparecer em buscador.

> **Atenção:** o sistema não tem login. Quem tiver o endereço vê o faturamento
> da operação. Antes de apontar um domínio público, ative *Vercel Authentication*
> (Settings → Deployment Protection) ou proteja por senha.
