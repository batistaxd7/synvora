#!/bin/sh
# Junta todos os arquivos SQL, na ordem certa, em supabase/tudo.sql
cd "$(dirname "$0")"
{
  echo "-- Synvora: banco completo. Rode este arquivo inteiro no Supabase (SQL Editor > New query > Run)."
  echo "-- Pode rodar quantas vezes quiser: ele só cria ou atualiza o que falta e não apaga nenhum dado."
  for f in schema.sql permissoes.sql equipe.sql seguranca.sql vendas.sql modulos.sql fotos.sql ceo.sql catalogo.sql fiscal.sql versao.sql; do
    echo; echo "-- ================================================================"; echo "-- $f"; echo "-- ================================================================"
    cat "$f"
  done
} > tudo.sql
