# COLHYBRI-GAMES — Claude Code Project Config

## Identite
- Projet: COLHYBRI-GAMES (plateforme gaming)
- Groupe: ONLYMORE Group
- CEO: Florent Gibert
- GitHub: FLOW2203/colhybri-games-src-games-

## Regles absolues
- Supabase ref = `isuzbpzwxcagtnbosgjl` UNIQUEMENT
- JAMAIS `ydzuywqzzbpwytwwfmeq` nulle part
- git config: user.email "onlymore2024@gmail.com" / user.name "Florent Gibert"
- Si un fix echoue 2x → STOP, cat le fichier complet, demander diagnostic

## Stack
- React 18 + Vite + TypeScript
- Phaser 3.80 (game engine)
- Supabase
- Vercel (deploy): prj_USeRDBo8OXsOqlyZ4GVCt8ioKejK

## Pipeline jeux
- P1 MVP (lancement): 14 jeux
- P2 Post-launch: 8 jeux
- P3 Expansion: 4 jeux
- 10 genres: Rhythm, Puzzle, Dive & Dodge, Endurance, Tap Frenzy, Speed Run, Memory, Cooperatif, Builder, Tower Defense

## COMMANDE /dream
Quand l'utilisateur tape /dream, executer :

1. **ORIENT** — cat .claude/memory.md + ls .claude/session/
2. **SIGNAL** — grep -r "ERROR\|WARN\|obsolete\|TODO" .claude/session/*.jsonl 2>/dev/null | head -50
3. **CONSOLIDATE** — Fusionner doublons, convertir dates relatives en absolues, resoudre contradictions
4. **PRUNE** — Supprimer entrees obsoletes, maintenir memory.md < 200 lignes
5. **UPDATE** — Mettre a jour last_dream avec date absolue (ex: 25 Mars 2026 19h)
