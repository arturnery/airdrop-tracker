/**
 * Ordem de dependência das tabelas, compartilhada por backup e restauração.
 *
 * Vive num módulo **sem efeitos**, e isso não é organização: `restaurar.ts`
 * importava esta lista de `backup.ts`, e importar aquele arquivo **executava um
 * backup**, porque ele chama `main()` no nível do módulo. O backup rodava no
 * meio da restauração, capturava o banco já parcialmente apagado e gravava por
 * cima do arquivo bom.
 *
 * Módulo que só exporta dados não tem como fazer isso.
 *
 * Quem é referenciado vem antes de quem referencia: a restauração insere nesta
 * ordem e apaga na inversa, e é ela que faz as chaves estrangeiras aceitarem
 * cada linha.
 */
export const TABELAS = [
  "users",
  "profile_settings",
  "accounts",
  "projects",
  "project_accounts",
  "transactions",
  "token_prices",
  "points_snapshots",
  "tasks",
  "task_occurrences",
  "goals",
  "goal_entries",
  "airdrop_claims",
  "import_batches",
  "feedback",
  "password_reset_requests",
] as const;
