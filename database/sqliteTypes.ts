export type SqliteDatabase = {
  execSync(sql: string): void;
  getAllSync(sql: string, ...params: any[]): unknown[];
  getFirstSync?(sql: string, ...params: any[]): unknown;
  runSync(sql: string, ...params: any[]): unknown;
};
