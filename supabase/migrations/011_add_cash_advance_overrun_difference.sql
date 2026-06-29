create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : type d'ecart pour depassement d'avance en especes

alter type stock.difference_type add value if not exists 'advance_overrun';
