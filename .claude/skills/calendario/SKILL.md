---
name: calendario
description: Alimentar ou atualizar o Calendário Editorial da Mentorei (calendario.mentorei.com.br) — colocar artes, carrosséis, reels e anúncios nos dias certos, escrever legendas, mudar datas ou textos de posts. Use sempre que a Juliana mandar artes novas ou pedir mudança no calendário.
---

# Alimentar o calendário editorial

Siga o CLAUDE.md desta pasta. Em resumo:

1. Veja o que já está no calendário antes de propor datas (consulte o Supabase com a chave do `.env`, ou `fila/fila.json` + `fila/enviados.txt`).
2. Receba as artes (anexo, pasta no computador ou .zip em Downloads), olhe cada uma e organize em `artes-recebidas/`.
3. Escreva as legendas que faltarem e proponha dia e horário, espalhando temas parecidos e respeitando as regras do Radar.
4. Mostre à Juliana um resumo curto (tabela simples: dia, horário, post) e espere ela aprovar.
5. Envie com `ferramentas/enviar-fila.ps1` e confira no banco se chegou tudo (quantidade de posts e de arquivos).
6. Responda em linguagem bem simples, sem jargão.

Pedidos de mudança ("troca o post de quinta pelo de sexta", "muda a legenda de tal post"): localize o post no Supabase, mostre o que vai mudar, e só altere depois do "sim" dela.
