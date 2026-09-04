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
 *
 * **Tabela nova precisa entrar aqui.** `volume_snapshots` foi criada e ficou de
 * fora: o backup rodava, dizia quantas linhas tinha salvado, e as medições de
 * volume não estavam em nenhuma delas. Backup incompleto é pior que backup
 * nenhum, porque ele dá a sensação de proteção. Quem impede a repetição é
 * `tests/backup-cobre-o-schema.test.ts`, que compara esta lista com as tabelas
 * declaradas no schema e quebra quando falta uma.
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
  "volume_snapshots",
  "catalog_projects",
  "tasks",
  "task_occurrences",
  "goals",
  "goal_entries",
  "airdrop_claims",
  "import_batches",
  "feedback",
  "password_reset_requests",
] as const;

/**
 * Tabelas deixadas de fora de propósito, com o motivo.
 *
 * Só entra aqui o que **não dói perder**. A lista existe para o teste de
 * cobertura distinguir uma ausência decidida de um esquecimento: sem ela, o
 * teste teria só duas saídas, quebrar a cada tabela nova ou não olhar nenhuma.
 *
 * `login_attempts` guarda as falhas de senha dos últimos quinze minutos, para o
 * limite de tentativas. Restaurar isso reimporia um bloqueio já vencido, que é
 * o contrário do que se quer num dia de desastre.
 */
export const FORA_DO_BACKUP: Record<string, string> = {
  login_attempts:
    "estado passageiro do limite de login: restaurar reimporia bloqueio vencido",
};
