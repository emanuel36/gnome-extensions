# Contexto inicial — 2026-10-22

Resumo da sessão que originou este repositório (aberta em `~/Downloads`, 21–22/10/2026).
Serve para continuar o trabalho numa sessão nova dentro do repo.

## Ambiente

- Ubuntu 24.04.3, kernel 7.0, GNOME Shell 46.0, sessão X11, tela 3000x1920.
- Relógio 24h, sistema em inglês (barra mostra "Oct 21"), tema de ícones `Yaru-blue`.
- Calendário: conta Google via GNOME Online Accounts → Evolution Data Server (CalDAV), dois
  calendários: o pessoal e "Device and Data Platform Team".
- Barra superior organizada com Panel Tidy (antes: Top Bar Organizer + Just Perfection).

## Extensões instaladas (`~/.local/share/gnome-shell/extensions`)

| UUID | Versão EGO | Estado | Observação |
|---|---|---|---|
| `Bluetooth-Battery-Meter@maniacx.github.com` | 49 | ativa | |
| `Resource_Monitor@Ory0n` | 28 | removida em 22/10 | substituída por system-monitor |
| `clipboard-history@alexsaveau.dev` | 51 | ativa | |
| `just-perfection-desktop@just-perfection` | 37 | removida em 22/10 | substituída por panel-tidy |
| `network-stats@gnome.noroadsleft.xyz` | 36 | removida em 22/10 | substituída por system-monitor |
| `next-up@artisticat1.github.com` | 8 | removida em 22/10 | substituída pelo repo (ver Decisões) |
| `speech2text-whispercpp@bcelary.github` | 6 | **INITIALIZED** | instalada mas não ativa; causa não investigada |
| `todo.txt@bart.libert.gmail.com` | 44 | ativa | |
| `top-bar-organizer@julian.gse.jsts.xyz` | 16 | removida em 22/10 | substituída por panel-tidy |

`org.gnome.shell enabled-extensions` também lista ~10 extensões que não estão instaladas
(entre elas `claude-status@oakz.org` e `simple-claude-usage@krugerrgabriel.github.io`).
Limpeza ainda não feita.

## Alterações feitas nas cópias instaladas (não estão no repo)

O import do repo é o upstream puro, por decisão do usuário. As mudanças abaixo existem só
nas cópias instaladas e precisam ser refeitas no repo, se continuarem desejadas.

### Next Up (instalada v8)

1. **Bug de horário:** `src/date.js`, `getTimeOfEventAsText` usa `padEnd(2, "0")` nos
   minutos, então 14:05 aparece como "14:50". Trocado para `padStart`. O upstream `main`
   ainda tem o bug.
2. **Ícone:** sempre `x-office-calendar-symbolic` com `icon_size: 12`. Foi removida a troca
   entre `alarm-symbolic` e o confete (`assets/party-popper.png`), junto com o asset, o
   parâmetro `confettiGicon`, `showAlarmIcon`/`showConfettiIcon` e o import de `Gio` em
   `extension.js`.
3. **Sem reuniões:** "Done for today!" virou "No meetings" (o usuário quer texto objetivo).

Como funciona (útil para o redesenho): usa `Calendar.DBusEventSource` do shell, mas nunca
chama `requestRange`. Os eventos chegam pelos sinais `EventsAddedOrUpdated`, que o
`gnome-shell-calendar-server` emite para todos quando o calendário do menu de data pede
um intervalo. O `_loadEvents(true)` chamado a cada 5 s não faz nada. Só mostra eventos de
hoje, ignora eventos de dia inteiro e trunca o título em 35 caracteres. `disable()` sempre
remove o indicador de `_centerBox`, o que é um bug se `which-panel` ≠ 1 (hoje é 1, centro).

Ainda não verificado: o shell não foi reiniciado depois dessas mudanças e não foi tirado
print do resultado.

### Sistema (Evolution Data Server)

O intervalo de sincronização dos dois calendários Google passou de 60 min para 1 min
(extensão `Refresh` das fontes `e92ad57d40fbd0be00b0b59a54f696e37efd71e7` e
`43fcbd2bf9a9d1f2e9613778c4d4dcfb911c8e7c`, via `EDataServer` no Python do sistema,
`/usr/bin/python3`). Para reverter, usar a mesma API com `set_interval_minutes(60)`.

## Código importado (HEAD do upstream) × GNOME 46

| Extensão | Shell declarado | No GNOME 46 |
|---|---|---|
| clipboard-history | 48–51 | **não roda** (a v51 do EGO instalada roda) |
| todo-txt | 51 | **não roda** (a v44 instalada roda) |
| next-up | 45–47 | roda, sem as correções acima |
| speech2text | 46–47 | a instalada não ativa; investigar |
| demais | incluem 46 | ok |

Algumas precisam de build: network-stats e top-bar-organizer são TypeScript;
clipboard-history, resource-monitor, speech2text e todo-txt têm `Makefile`;
bluetooth-battery-meter tem `install.sh`; just-perfection tem `scripts/`. Next Up
não tem build.

## Decisões já tomadas

- Monorepo com `git subtree --squash` de **todas** as 9 extensões, tratadas como código
  próprio (não fork). Import do branch padrão mais recente, sem as nossas modificações.
- Commits como emanuel36 (configurado no repo), remote pelo alias SSH
  `github.com-emanuel36`. Repo no GitHub ainda não criado; sem push até o usuário pedir.
- O escopo de cada extensão será definido em etapas, com o brainstorming do superpowers.
- Next Up (22/10): UUID próprio `next-up@emanuel36`, mesmo esquema de link; a cópia do EGO
  foi desinstalada. Causa do "No meetings" falso: a fonte de eventos própria nunca pedia
  intervalo ao calendar-server (que guarda um intervalo só, o do menu do relógio); agora
  lê a fonte do `dateMenu`. Visual novo: `14:00 Nome · 2h45` (contagem esmaecida),
  `Nome · 25m left` durante reunião, `+N` para reuniões no mesmo horário, escondida
  quando não há mais nada no dia.
- System Monitor (22/10): `system-monitor@emanuel36`, escrita do zero, substitui Resource
  Monitor e Network Stats (removidos do repo e da máquina). Barra com CPU, RAM e rede;
  popup com top 5 apps por CPU/memória, temperatura e frequência da CPU, cabo/Wi-Fi com
  uso do dia. Top Bar Organizer lança `appIndicator is undefined` ao adicionar itens com
  um appindicator quebrado; o usuário desativou o Organizer. Design em
  `specs/2026-10-22-system-monitor-design.md`.
- Panel Tidy (22/10): `panel-tidy@emanuel36`, escrita do zero, substitui Top Bar Organizer
  e Just Perfection (removidos do repo e da máquina). Ordena os itens da barra e oculta itens e botões do Quick Settings, pela janela
  de preferências (arrastar + switches), sem sobrescrever funções do shell. Ocultos hoje:
  layout de teclado, acessibilidade, Airplane Mode, Night Light, Dark Style e Keyboard.
  O Next Up passou a se registrar com `addToStatusArea` (antes inseria direto na caixa e
  ficava invisível para quem ordena a barra). Design em `specs/2026-10-22-panel-tidy-design.md`.

## Ideias discutidas, ainda não decididas

- Padronizar o visual de todas as extensões.
- Juntar CPU, RAM e rede (Resource Monitor + Network Stats) num indicador só. O resultado
  seria GPL-3.0.
- Trocar os UUIDs (ex.: `next-up@emanuel36...`) e remover `"_generated"` para o EGO não
  sobrescrever o código. Migrar as preferências com `dconf dump`/`dconf load`.
- `install.sh` que compila os schemas e cria links em `~/.local/share/gnome-shell/extensions`.
  Depois, desinstalar as versões do EGO.
- Uma extensão não consegue importar CSS de outra: um padrão visual comum precisaria ser
  copiado para cada uma no build, ou viver numa extensão integrada.
- Adaptar o código novo ao GNOME 46 (clipboard-history, todo-txt) ou reavaliar essas duas.

## Preferências observadas do usuário

- Conversa em português; textos da barra em inglês, como o resto do sistema.
- Quer a barra compacta e objetiva: ícones menores, texto curto ("No meetings" em vez de
  frase).

## Próximo passo

Continuar o brainstorming do escopo. Pergunta em aberto: *o que mais te incomoda na barra
superior no dia a dia?*
