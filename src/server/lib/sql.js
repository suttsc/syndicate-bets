/** Split a .sql file into individual statements, dropping `--` comments and blank lines. */
export function splitStatements(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}
